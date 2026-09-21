import { Hono } from "hono"
import { z } from "zod"
import { getStorefront } from "~/lib/storefront"
import { type ApiEnv, jsonError } from "./context"

export const getSteamPrice = async (appId: number) => {
	const response = await fetch(
		`https://store.steampowered.com/api/appdetails?appids=${appId}&filters=basic,price_overview&cc=US&l=english`,
		{ signal: AbortSignal.timeout(10_000) }
	)
	if (!response.ok) throw new Error("Steam prices unavailable")
	const result = z
		.record(
			z.string(),
			z.object({
				success: z.boolean(),
				data: z
					.object({
						is_free: z.boolean().optional(),
						price_overview: z
							.object({
								currency: z.literal("USD"),
								initial: z.number().int().nonnegative(),
								final: z.number().int().nonnegative()
							})
							.optional()
					})
					.optional()
			})
		)
		.parse(await response.json())[String(appId)]
	if (!result?.success) return null
	const price = result.data?.price_overview
	if (!price && !result.data?.is_free) return null
	if (price && price.final > price.initial)
		throw new Error("Invalid Steam price")
	return {
		currency: "USD" as const,
		regular: price?.initial ?? 0,
		current: price?.final ?? 0,
		checkedAt: new Date().toISOString()
	}
}

export const getStorePrice = async (url: string) => {
	const store = getStorefront(url)
	if (!store) throw new Error("Unsupported storefront")
	if (store.provider === "steam") return getSteamPrice(Number(store.id))
	let regular = NaN
	let current = NaN
	if (store.provider === "apple") {
		const response = await fetch(
			`https://itunes.apple.com/lookup?id=${store.id}&country=US`,
			{ signal: AbortSignal.timeout(10_000), redirect: "error" }
		)
		if (!response.ok) throw new Error("App Store prices unavailable")
		const data = z
			.object({
				results: z.array(
					z.object({
						trackId: z.number(),
						currency: z.string().optional(),
						price: z.number().nonnegative().optional()
					})
				)
			})
			.parse(await response.json())
		const app = data.results.find(
			(app) => String(app.trackId) === store.id && app.currency === "USD"
		)
		if (app?.price === undefined) return null
		regular = current = Math.round(app.price * 100)
	} else if (store.provider === "gog") {
		const response = await fetch(
			`https://catalog.gog.com/v1/catalog?query=${encodeURIComponent(store.id.replaceAll("_", " "))}&limit=48&currencyCode=USD&countryCode=US&locale=en-US`,
			{ signal: AbortSignal.timeout(10_000), redirect: "error" }
		)
		if (!response.ok) throw new Error("GOG prices unavailable")
		const data = z
			.object({
				products: z.array(
					z.object({
						slug: z.string(),
						price: z.unknown().optional()
					})
				)
			})
			.parse(await response.json())
		const matched = z
			.object({
				baseMoney: z.object({
					amount: z.string(),
					currency: z.string()
				}),
				finalMoney: z.object({
					amount: z.string(),
					currency: z.string()
				})
			})
			.safeParse(
				data.products.find((product) => product.slug === store.id)
					?.price
			)
		if (!matched.success) return null
		const price = matched.data
		if (
			price.baseMoney.currency !== "USD" ||
			price.finalMoney.currency !== "USD"
		)
			return null
		if (
			!/^\d+(?:\.\d{1,2})?$/.test(price.baseMoney.amount) ||
			!/^\d+(?:\.\d{1,2})?$/.test(price.finalMoney.amount)
		)
			throw new Error("Invalid GOG price")
		regular = Math.round(Number(price.baseMoney.amount) * 100)
		current = Math.round(Number(price.finalMoney.amount) * 100)
	} else if (store.provider === "google") {
		const response = await fetch(store.url, {
			signal: AbortSignal.timeout(10_000),
			redirect: "error"
		})
		if (response.status === 404) return null
		if (!response.ok) throw new Error("Google Play prices unavailable")
		const html = await response.text()
		for (const script of html.matchAll(
			/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
		)) {
			let json: unknown
			try {
				json = JSON.parse(script[1])
			} catch {
				continue
			}
			const app = z
				.object({
					"@type": z.literal("SoftwareApplication"),
					url: z.string(),
					offers: z.union([
						z.object({
							price: z.union([z.string(), z.number()]),
							priceCurrency: z.string(),
							availability: z.string().optional()
						}),
						z.array(
							z.object({
								price: z.union([z.string(), z.number()]),
								priceCurrency: z.string(),
								availability: z.string().optional()
							})
						)
					])
				})
				.safeParse(json)
			if (!app.success || getStorefront(app.data.url)?.id !== store.id)
				continue
			const offers = Array.isArray(app.data.offers)
				? app.data.offers
				: [app.data.offers]
			const offer = offers.find(
				(offer) =>
					offer.priceCurrency === "USD" &&
					(!offer.availability ||
						offer.availability.endsWith("/InStock"))
			)
			if (!offer || !/^\d+(?:\.\d{1,2})?$/.test(String(offer.price)))
				continue
			regular = current = Math.round(Number(offer.price) * 100)
			break
		}
		if (!Number.isFinite(current)) return null
	} else {
		const response = await fetch("https://store.epicgames.com/graphql", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			redirect: "error",
			signal: AbortSignal.timeout(10_000),
			body: JSON.stringify({
				query: 'query Price($query: String!) { Catalog { searchStore(keywords: $query, country: "US", locale: "en-US", count: 40) { elements { productSlug offerType offerMappings { pageSlug } price(country: "US") { totalPrice { originalPrice discountPrice currencyCode } } } } } }',
				variables: {
					query: [
						...new Set(
							store.id
								.replace(/-[a-f0-9]{6,8}$/, "")
								.split(/[-_]+/)
						)
					].join(" ")
				}
			})
		})
		if (!response.ok) throw new Error("Epic prices unavailable")
		const data = z
			.object({
				data: z.object({
					Catalog: z.object({
						searchStore: z.object({
							elements: z.array(
								z.object({
									productSlug: z.string().nullish(),
									offerType: z.string().optional(),
									offerMappings: z
										.array(
											z.object({ pageSlug: z.string() })
										)
										.nullish(),
									price: z.unknown().optional()
								})
							)
						})
					})
				})
			})
			.parse(await response.json())
		const offers = data.data.Catalog.searchStore.elements
		// Namespace mappings include other editions and DLC: only exact offer mappings identify this page.
		const exact = offers.filter((offer) =>
			offer.offerMappings?.some(
				(mapping) => mapping.pageSlug === store.id
			)
		)
		const matches = exact.length
			? exact
			: offers.filter(
					(offer) =>
						offer.offerType === "BASE_GAME" &&
						offer.productSlug?.replace(/\/home$/, "") === store.id
				)
		if (matches.length !== 1) return null
		const matched = z
			.object({
				totalPrice: z.object({
					originalPrice: z.number().int().nonnegative(),
					discountPrice: z.number().int().nonnegative(),
					currencyCode: z.string()
				})
			})
			.safeParse(matches[0].price)
		if (!matched.success || matched.data.totalPrice.currencyCode !== "USD")
			return null
		regular = matched.data.totalPrice.originalPrice
		current = matched.data.totalPrice.discountPrice
	}
	if (
		!Number.isSafeInteger(regular) ||
		!Number.isSafeInteger(current) ||
		current < 0 ||
		regular < current
	)
		throw new Error("Invalid storefront price")
	return {
		currency: "USD" as const,
		regular,
		current,
		checkedAt: new Date().toISOString()
	}
}

export const priceRoutes = new Hono<ApiEnv>()

priceRoutes.get("/store", async (c) => {
	const store = getStorefront(c.req.query("url"))
	if (!store)
		return c.json(jsonError("Use a supported storefront game URL."), 400)
	const key = new Request(
		`${new URL(c.req.url).origin}/api/games/prices/store?url=${encodeURIComponent(store.url)}`
	)
	try {
		const cache = await caches.open("store-prices")
		const cached = await cache.match(key)
		if (cached) return cached
		const data = await getStorePrice(store.url)
		const response = c.json({ data }, 200, {
			"Cache-Control": `public, max-age=${data ? 900 : 120}`
		})
		c.executionCtx.waitUntil(cache.put(key, response.clone()))
		return response
	} catch {
		return c.json(
			jsonError(
				`${store.label} prices unavailable. Try again shortly.`,
				502
			),
			502
		)
	}
})

priceRoutes.get("/:appId", (c) => {
	const input = c.req.param("appId")
	if (!/^[1-9]\d{0,9}$/.test(input))
		return c.json(jsonError("Invalid Steam app ID"), 400)
	return c.redirect(
		`/api/games/prices/store?url=${encodeURIComponent(`https://store.steampowered.com/app/${input}/`)}`,
		307
	)
})

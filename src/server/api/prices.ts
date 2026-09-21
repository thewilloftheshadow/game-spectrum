import { Hono } from "hono"
import { z } from "zod"
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

export const priceRoutes = new Hono<ApiEnv>()

priceRoutes.get("/:appId", async (c) => {
	const input = c.req.param("appId")
	if (!/^[1-9]\d{0,9}$/.test(input))
		return c.json(jsonError("Invalid Steam app ID"), 400)
	const appId = Number(input)
	const key = new Request(
		`${new URL(c.req.url).origin}/api/games/prices/${appId}`
	)
	try {
		const cache = await caches.open("steam-prices")
		const cached = await cache.match(key)
		if (cached) return cached
		const data = await getSteamPrice(appId)
		const response = c.json({ data }, 200, {
			"Cache-Control": `public, max-age=${data ? 900 : 120}`
		})
		c.executionCtx.waitUntil(cache.put(key, response.clone()))
		return response
	} catch {
		return c.json(
			jsonError("Steam prices unavailable. Try again shortly.", 502),
			502
		)
	}
})

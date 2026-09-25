import { Hono } from "hono"
import { type ApiEnv, jsonError } from "./context"

const allowedMediaHosts = [
	"akamaihd.net",
	"discordapp.com",
	"discordapp.net",
	"fastly.steamstatic.com",
	"googleusercontent.com",
	"igdb.com",
	"jtvnw.net",
	"steamstatic.com",
	"user-uploads.gamespectrum.org"
]

export const mediaRoutes = new Hono<ApiEnv>()

mediaRoutes.get("/media", async (c) => {
	let url: URL
	try {
		url = new URL(c.req.query("url") ?? "")
	} catch {
		return c.json(jsonError("Unsupported media URL."), 400)
	}
	if (
		url.hostname.toLowerCase() === "cdn.akamai.steamstatic.com" &&
		url.pathname.startsWith("/steam/apps/")
	) {
		url = new URL(
			`https://shared.fastly.steamstatic.com/store_item_assets${url.pathname}${url.search}`
		)
	}
	if (
		url.href.length > 2048 ||
		url.protocol !== "https:" ||
		url.username ||
		url.password ||
		url.port ||
		!allowedMediaHosts.some(
			(allowed) =>
				url.hostname.toLowerCase() === allowed ||
				url.hostname.toLowerCase().endsWith(`.${allowed}`)
		)
	) {
		return c.json(jsonError("Unsupported media URL."), 400)
	}

	const key = new Request(
		`${new URL(c.req.url).origin}/api/media?url=${encodeURIComponent(url.href)}`
	)
	const cache = await caches.open("media")
	const cached = await cache.match(key)
	if (cached) return cached

	try {
		let upstream: Response | null = null
		for (let redirects = 0; redirects <= 3; redirects++) {
			upstream = await fetch(url, {
				headers: { Accept: "image/*" },
				redirect: "manual",
				signal: AbortSignal.timeout(10_000)
			})
			if (![301, 302, 303, 307, 308].includes(upstream.status)) break
			const location = upstream.headers.get("Location")
			if (!location) return c.json(jsonError("Media unavailable."), 502)
			url = new URL(location, url)
			if (
				url.href.length > 2048 ||
				url.protocol !== "https:" ||
				url.username ||
				url.password ||
				url.port ||
				!allowedMediaHosts.some(
					(allowed) =>
						url.hostname.toLowerCase() === allowed ||
						url.hostname.toLowerCase().endsWith(`.${allowed}`)
				)
			) {
				return c.json(jsonError("Media unavailable."), 502)
			}
		}
		if (!upstream?.ok) return c.json(jsonError("Media unavailable."), 502)

		const type = upstream.headers.get("Content-Type")?.split(";")[0]
		if (!type?.startsWith("image/") || type === "image/svg+xml") {
			return c.json(jsonError("Unsupported media type."), 415)
		}

		const headers = new Headers({
			"Cache-Control":
				"public, max-age=86400, stale-while-revalidate=604800",
			"Content-Type": type,
			"X-Content-Type-Options": "nosniff"
		})
		const length = upstream.headers.get("Content-Length")
		if (length) headers.set("Content-Length", length)
		const etag = upstream.headers.get("ETag")
		if (etag) headers.set("ETag", etag)
		const modified = upstream.headers.get("Last-Modified")
		if (modified) headers.set("Last-Modified", modified)

		const response = new Response(upstream.body, { headers })
		c.executionCtx.waitUntil(cache.put(key, response.clone()))
		return response
	} catch {
		return c.json(jsonError("Media unavailable."), 502)
	}
})

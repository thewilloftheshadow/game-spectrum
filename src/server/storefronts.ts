import { z } from "zod"
import { getStorefront } from "~/lib/storefront"
import { secret, storeUrlSchema } from "./api/context"

export async function getIGDBStoreLinks(env: Cloudflare.Env, ids: number[]) {
	const links = new Map<number, string>()
	const clientId = secret(env, "IGDB_CLIENT_ID")
	const token = secret(env, "IGDB_ACCESS_TOKEN")
	if (!ids.length || !clientId || !token) return links
	const unique = [...new Set(ids)].sort((a, b) => a - b)
	for (let offset = 0; offset < unique.length; offset += 50) {
		const batch = unique.slice(offset, offset + 50)
		try {
			const cache = await caches.open("igdb-store-links")
			const key = new Request(
				`https://api.igdb.com/v4/games?store-links=${batch.join(",")}`
			)
			const cached = await cache.match(key)
			if (cached) {
				for (const [id, url] of z
					.array(z.tuple([z.number(), storeUrlSchema]))
					.parse(await cached.json()))
					links.set(id, url)
				continue
			}
			const response = await fetch("https://api.igdb.com/v4/games", {
				method: "POST",
				headers: {
					"Client-ID": clientId,
					Authorization: `Bearer ${token}`
				},
				body: `fields websites.url,external_games.url; where id = (${batch.join(",")}); limit 50;`,
				signal: AbortSignal.timeout(6_000)
			})
			if (!response.ok) continue
			const games = z
				.array(
					z.object({
						id: z.number(),
						websites: z
							.array(z.object({ url: z.string().optional() }))
							.optional(),
						external_games: z
							.array(z.object({ url: z.string().optional() }))
							.optional()
					})
				)
				.parse(await response.json())
			for (const game of games) {
				const stores = [
					...(game.websites ?? []),
					...(game.external_games ?? [])
				]
					.map((link) => getStorefront(link.url))
					.filter((store) => store !== null)
					.sort(
						(a, b) =>
							["steam", "gog", "epic", "apple", "google"].indexOf(
								a.provider
							) -
							["steam", "gog", "epic", "apple", "google"].indexOf(
								b.provider
							)
					)
				if (stores[0]) links.set(game.id, stores[0].url)
			}
			await cache.put(
				key,
				Response.json(
					[...links].filter(([id]) => batch.includes(id)),
					{ headers: { "Cache-Control": "public, max-age=3600" } }
				)
			)
		} catch {
			/* Metadata failures must not prevent loading a library. */
		}
	}
	return links
}

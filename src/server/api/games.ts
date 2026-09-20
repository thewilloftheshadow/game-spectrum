import { Hono } from "hono"
import { type ApiEnv, requiredSecret } from "./context"

export const gameRoutes = new Hono<ApiEnv>()

gameRoutes.get("/search", async (c) => {
	const query = c.req.query("q")?.trim()
	if (!query) {
		return c.json({ data: [] })
	}

	const steam = await fetch(
		`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=english&cc=US`
	)
		.then((response) => response.json() as Promise<{ items?: unknown[] }>)
		.then((data) =>
			(data.items ?? []).slice(0, 8).map((item) => {
				const game = item as {
					id: number
					name: string
					tiny_image?: string
				}
				return {
					title: game.name,
					source: "steam",
					steamAppId: game.id,
					coverUrl:
						game.tiny_image ??
						`https://cdn.akamai.steamstatic.com/steam/apps/${game.id}/header.jpg`
				}
			})
		)
		.catch(() => [])

	const igdb = await fetch("https://api.igdb.com/v4/games", {
		body: `search "${query.replaceAll('"', "")}"; fields name,first_release_date,cover.image_id; limit 8;`,
		headers: {
			"Client-ID": requiredSecret(c.env, "IGDB_CLIENT_ID"),
			Authorization: `Bearer ${requiredSecret(c.env, "IGDB_ACCESS_TOKEN")}`
		},
		method: "POST"
	})
		.then((response) => (response.ok ? response.json() : []))
		.then((data) =>
			(data as unknown[]).map((item) => {
				const game = item as {
					id: number
					name: string
					first_release_date?: number
					cover?: { image_id?: string }
				}
				return {
					title: game.name,
					source: "igdb",
					igdbId: game.id,
					coverUrl: game.cover?.image_id
						? `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`
						: null,
					releaseYear: game.first_release_date
						? new Date(
								game.first_release_date * 1000
							).getUTCFullYear()
						: null
				}
			})
		)
		.catch(() => [])

	return c.json({
		data: [
			...steam,
			...igdb,
			{ title: query, source: "manual", coverUrl: null }
		]
	})
})

import { and, eq } from "drizzle-orm"
import { Hono } from "hono"
import { getDb } from "../db"
import { gameEntries } from "../db/schema"
import {
	type ApiEnv,
	jsonError,
	requiredSecret,
	requireSession,
	saveGame
} from "./context"

export const steamRoutes = new Hono<ApiEnv>()

steamRoutes.post("/import", async (c) => {
	try {
		const session = await requireSession(c.env, c.req.raw.headers)
		const steamId = (session.user as { steamId?: string | null }).steamId
		if (!steamId) {
			throw new Error("Link Steam before importing your library.")
		}
		const response = await fetch(
			`https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${encodeURIComponent(requiredSecret(c.env, "STEAM_API_KEY"))}&steamid=${encodeURIComponent(steamId)}&include_appinfo=1&include_played_free_games=1&format=json`
		)
		const data = (await response.json()) as {
			response?: {
				games?: { appid: number; name: string; img_icon_url?: string }[]
			}
		}
		const owned = data.response?.games
		if (!owned?.length) {
			throw new Error(
				"Steam library unavailable. Make Steam profile Game Details public, then try again."
			)
		}
		const db = getDb(c.env.DB)
		let imported = 0
		for (const item of owned) {
			const game = await saveGame(db, {
				title: item.name,
				source: "steam",
				steamAppId: item.appid,
				coverUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${item.appid}/header.jpg`
			})
			const existing = await db
				.select()
				.from(gameEntries)
				.where(
					and(
						eq(gameEntries.userId, session.user.id),
						eq(gameEntries.gameId, game.id)
					)
				)
				.get()
			if (!existing) {
				await db.insert(gameEntries).values({
					id: crypto.randomUUID(),
					userId: session.user.id,
					gameId: game.id,
					importedFromSteam: true,
					steamAppId: item.appid
				})
				imported += 1
			}
		}
		return c.json({ data: { imported } })
	} catch (error) {
		return c.json(jsonError((error as Error).message), 400)
	}
})

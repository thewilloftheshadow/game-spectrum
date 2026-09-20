import { Hono } from "hono"
import { z } from "zod"
import { getDb } from "../db"
import { games } from "../db/schema"
import {
	type ApiEnv,
	jsonError,
	requiredSecret,
	requireSession,
	slugify
} from "./context"

export const steamRoutes = new Hono<ApiEnv>()

steamRoutes.post("/import", async (c) => {
	try {
		const session = await requireSession(c.env, c.req.raw.headers)
		const steamId = session.user.steamId
		if (!steamId)
			return c.json(
				jsonError("Link Steam before importing your library."),
				400
			)
		const input = z
			.object({ offset: z.number().int().min(0).default(0) })
			.safeParse(await c.req.json().catch(() => null))
		if (!input.success)
			return c.json(jsonError("Invalid import request."), 400)
		const response = await fetch(
			`https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${encodeURIComponent(requiredSecret(c.env, "STEAM_API_KEY"))}&steamid=${encodeURIComponent(steamId)}&include_appinfo=1&include_played_free_games=1&format=json`,
			{ signal: AbortSignal.timeout(15_000) }
		)
		if (!response.ok)
			return c.json(
				jsonError("Steam is unavailable. Please try again.", 502),
				502
			)
		const data = z
			.object({
				response: z
					.object({
						game_count: z.number().optional(),
						games: z
							.array(
								z.object({
									appid: z.number().int().positive(),
									name: z.string().optional()
								})
							)
							.optional()
					})
					.optional()
			})
			.parse(await response.json())
		if (
			!data.response ||
			(!data.response.games && data.response.game_count !== 0)
		) {
			return c.json(
				jsonError(
					"Steam library unavailable. Set your Steam Game Details to public, then try again."
				),
				400
			)
		}
		const owned = [
			...new Map(
				(data.response.games ?? []).map((game) => [game.appid, game])
			).values()
		].sort((a, b) => a.appid - b.appid)
		const offset = input.data.offset
		const page = owned.slice(offset, offset + 100)
		const db = getDb(c.env.DB)
		let imported = 0
		// Ten games per statement stays below D1's 100-bound-parameter limit.
		// One atomic batch per chunk: catalog upsert, then missing library entries.
		for (let start = 0; start < page.length; start += 10) {
			const chunk = page.slice(start, start + 10)
			const catalog = db
				.insert(games)
				.values(
					chunk.map((item) => {
						const id = crypto.randomUUID()
						const title =
							item.name?.trim() || `Steam App ${item.appid}`
						return {
							id,
							title,
							slug: `${slugify(title)}-${id.slice(0, 6)}`,
							source: "steam" as const,
							steamAppId: item.appid,
							coverUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${item.appid}/header.jpg`
						}
					})
				)
				.onConflictDoNothing({ target: games.steamAppId })
				.toSQL()
			const results = await c.env.DB.batch([
				c.env.DB.prepare(catalog.sql).bind(...catalog.params),
				c.env.DB.prepare(`INSERT INTO game_entries (id, user_id, game_id, imported_from_steam, steam_app_id)
					SELECT lower(hex(randomblob(16))), ?, games.id, 1, games.steam_app_id FROM games
					WHERE games.steam_app_id IN (${chunk.map(() => "?").join(",")})
					AND NOT EXISTS (SELECT 1 FROM game_entries WHERE game_entries.user_id = ? AND game_entries.game_id = games.id)`).bind(
					session.user.id,
					...chunk.map((item) => item.appid),
					session.user.id
				)
			])
			imported += results[1].meta.changes
		}
		const processed = Math.min(offset + page.length, owned.length)
		return c.json({
			data: {
				imported,
				processed,
				total: owned.length,
				nextOffset: processed < owned.length ? processed : null
			}
		})
	} catch (error) {
		if (error instanceof Error && error.message === "Sign in required")
			return c.json(jsonError("Sign in required", 401), 401)
		console.error("Steam library import failed", error)
		return c.json(
			jsonError(
				"Import interrupted. Please try again; games already imported will be kept.",
				500
			),
			500
		)
	}
})

import { and, eq } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"
import { calculateScore } from "~/lib/scoring"
import { getDb } from "../db"
import { gameEntries, games } from "../db/schema"
import {
	type ApiEnv,
	gamePayload,
	jsonError,
	parseScoreBody,
	requireSession,
	saveGame
} from "./context"

export const entryRoutes = new Hono<ApiEnv>()

entryRoutes.get("/entries", async (c) => {
	try {
		const session = await requireSession(c.env, c.req.raw.headers)
		const rows = await getDb(c.env.DB)
			.select({ entry: gameEntries, game: games })
			.from(gameEntries)
			.leftJoin(games, eq(gameEntries.gameId, games.id))
			.where(eq(gameEntries.userId, session.user.id))
		const data = rows
			.map(({ entry, game }) => ({
				...entry,
				game,
				title: game?.title ?? entry.manualTitle ?? "Untitled game",
				coverUrl: entry.coverUrl ?? game?.coverUrl,
				score: calculateScore(entry)
			}))
			.sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
		return c.json({ data })
	} catch (error) {
		return c.json(jsonError((error as Error).message, 401), 401)
	}
})

entryRoutes.post("/entries", async (c) => {
	try {
		const session = await requireSession(c.env, c.req.raw.headers)
		const body = await c.req.json()
		const parsed = gamePayload.parse(body)
		const db = getDb(c.env.DB)
		const game = await saveGame(db, parsed)
		const duplicate = await db
			.select()
			.from(gameEntries)
			.where(
				and(
					eq(gameEntries.userId, session.user.id),
					eq(gameEntries.gameId, game.id)
				)
			)
			.get()

		if (duplicate) {
			return c.json({ data: duplicate })
		}

		const id = crypto.randomUUID()
		const entry = {
			id,
			userId: session.user.id,
			gameId: game.id,
			manualTitle: parsed.source === "manual" ? parsed.title : null,
			coverUrl: parsed.coverUrl ?? null,
			importedFromSteam: false,
			steamAppId: parsed.steamAppId ?? null
		}
		await db.insert(gameEntries).values(entry)
		return c.json({ data: entry })
	} catch (error) {
		return c.json(jsonError((error as Error).message), 400)
	}
})

entryRoutes.patch("/entries/:id", async (c) => {
	try {
		const session = await requireSession(c.env, c.req.raw.headers)
		const body = await c.req.json()
		const scores = parseScoreBody(body)
		const parsed = z
			.object({
				hidden: z.boolean().optional(),
				notes: z.string().max(1200).optional().nullable()
			})
			.parse(body)
		await getDb(c.env.DB)
			.update(gameEntries)
			.set({ ...scores, ...parsed })
			.where(
				and(
					eq(gameEntries.id, c.req.param("id")),
					eq(gameEntries.userId, session.user.id)
				)
			)
		return c.json({ data: { ok: true } })
	} catch (error) {
		return c.json(jsonError((error as Error).message), 400)
	}
})

import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"
import { getDb } from "../db"
import { profiles } from "../db/schema"
import { type ApiEnv, jsonError, requireSession } from "./context"

export const profileRoutes = new Hono<ApiEnv>()

profileRoutes.get("/me", async (c) => {
	try {
		const session = await requireSession(c.env, c.req.raw.headers)
		const profile = await getDb(c.env.DB)
			.select()
			.from(profiles)
			.where(eq(profiles.userId, session.user.id))
			.get()
		return c.json({ data: { user: session.user, profile } })
	} catch (error) {
		return c.json(jsonError((error as Error).message, 401), 401)
	}
})

profileRoutes.patch("/profile", async (c) => {
	try {
		const session = await requireSession(c.env, c.req.raw.headers)
		const body = await c.req.json()
		const parsed = z
			.object({
				slug: z
					.string()
					.min(2)
					.max(40)
					.regex(/^[a-z0-9-]+$/)
					.optional(),
				displayName: z.string().min(1).max(80).optional(),
				bio: z.string().max(800).optional(),
				favoriteGenres: z.array(z.string().max(30)).max(12).optional(),
				isPublic: z.boolean().optional(),
				steamVanity: z.string().max(80).optional().nullable()
			})
			.parse(body)
		const update = {
			...parsed,
			favoriteGenres: parsed.favoriteGenres
				? JSON.stringify(parsed.favoriteGenres)
				: undefined
		}
		await getDb(c.env.DB)
			.update(profiles)
			.set(update)
			.where(eq(profiles.userId, session.user.id))
		return c.json({ data: { ok: true } })
	} catch (error) {
		return c.json(jsonError((error as Error).message), 400)
	}
})

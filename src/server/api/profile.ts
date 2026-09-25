import { and, eq, ne } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"
import { calculateScore } from "~/lib/scoring"
import { getDb } from "../db"
import { gameEntries, profiles } from "../db/schema"
import { type ApiEnv, jsonError, requireSession } from "./context"

export const getMyProfile = async (
	env: Cloudflare.Env,
	session: Awaited<ReturnType<typeof requireSession>>
) => {
	const db = getDb(env.DB)
	const profile = await db
		.select()
		.from(profiles)
		.where(eq(profiles.userId, session.user.id))
		.get()
	const entries = await db
		.select()
		.from(gameEntries)
		.where(eq(gameEntries.userId, session.user.id))
	const library = { ready: 0, unfinished: 0, hidden: 0 }
	for (const entry of entries) {
		if (entry.hidden) library.hidden++
		else if (calculateScore(entry) === null) library.unfinished++
		else library.ready++
	}
	return { user: session.user, profile, library }
}

export const profilePayload = z
	.object({
		slug: z
			.string()
			.trim()
			.toLowerCase()
			.min(2)
			.max(40)
			.regex(
				/^[a-z0-9-]+$/,
				"Use lowercase letters, numbers, or hyphens in your profile URL."
			)
			.optional(),
		displayName: z.string().trim().min(1).max(80).optional(),
		bio: z.string().max(800).optional(),
		isPublic: z.boolean().optional()
	})
	.strict()
	.refine(
		(value) => Object.keys(value).length > 0,
		"No profile changes supplied."
	)

export const profileRoutes = new Hono<ApiEnv>()

profileRoutes.get("/me", async (c) => {
	try {
		const session = await requireSession(c.env, c.req.raw.headers)
		return c.json({ data: await getMyProfile(c.env, session) })
	} catch (error) {
		const unauthorized =
			error instanceof Error && error.message === "Sign in required"
		return c.json(
			jsonError(
				unauthorized
					? "Sign in required"
					: "Unable to load your profile.",
				unauthorized ? 401 : 500
			),
			unauthorized ? 401 : 500
		)
	}
})

profileRoutes.patch("/profile", async (c) => {
	try {
		const session = await requireSession(c.env, c.req.raw.headers)
		const parsed = profilePayload.parse(await c.req.json())
		const db = getDb(c.env.DB)
		if (
			parsed.slug &&
			(await db
				.select({ userId: profiles.userId })
				.from(profiles)
				.where(
					and(
						eq(profiles.slug, parsed.slug),
						ne(profiles.userId, session.user.id)
					)
				)
				.get())
		)
			return c.json(
				jsonError("That profile URL is already taken.", 409),
				409
			)
		const profile = await db
			.update(profiles)
			.set({
				...parsed
			})
			.where(eq(profiles.userId, session.user.id))
			.returning()
			.get()
		if (!profile) return c.json(jsonError("Profile not found.", 404), 404)
		return c.json({ data: { profile } })
	} catch (error) {
		const unauthorized =
			error instanceof Error && error.message === "Sign in required"
		return c.json(
			jsonError(
				unauthorized
					? "Sign in required"
					: error instanceof z.ZodError
						? error.issues[0].message
						: "Unable to save your profile. Please try again.",
				unauthorized ? 401 : 400
			),
			unauthorized ? 401 : 400
		)
	}
})

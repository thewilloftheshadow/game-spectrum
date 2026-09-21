import { eq } from "drizzle-orm"
import { z } from "zod"
import { ratingFields } from "~/lib/scoring"
import { getStorefront } from "~/lib/storefront"
import { getAuth } from "../auth"
import { getDb } from "../db"
import { games, profiles } from "../db/schema"

export type ApiEnv = { Bindings: Cloudflare.Env }

export const secret = (env: Cloudflare.Env, name: string) =>
	(env as unknown as Record<string, string | undefined>)[name]

export const requiredSecret = (env: Cloudflare.Env, name: string) => {
	const value = secret(env, name)
	if (!value) {
		throw new Error(`${name} is required`)
	}
	return value
}

export const slugify = (value: string) =>
	value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "") || crypto.randomUUID().slice(0, 8)

export const jsonError = (message: string, status = 400) => ({
	error: { message },
	status
})

export const requireSession = async (env: Cloudflare.Env, headers: Headers) => {
	const auth = getAuth(env)
	const session = await auth.api.getSession({ headers })
	if (!session) {
		throw new Error("Sign in required")
	}

	const db = getDb(env.DB)
	const existingProfile = await db
		.select()
		.from(profiles)
		.where(eq(profiles.userId, session.user.id))
		.get()

	if (!existingProfile) {
		for (let attempt = 0; attempt < 5; attempt++) {
			const inserted = await db
				.insert(profiles)
				.values({
					userId: session.user.id,
					slug: crypto.randomUUID().slice(0, 8),
					displayName: session.user.name,
					avatarUrl: session.user.image
				})
				.onConflictDoNothing()
				.returning({ userId: profiles.userId })
				.get()
			if (
				inserted ||
				(await db
					.select({ userId: profiles.userId })
					.from(profiles)
					.where(eq(profiles.userId, session.user.id))
					.get())
			)
				break
			if (attempt === 4)
				throw new Error("Unable to create profile. Please try again.")
		}
	}

	return session
}

export const parseScoreBody = (body: Record<string, unknown>) => {
	const values: Record<string, number | null> = {}
	for (const field of ratingFields) {
		if (!(field.key in body)) {
			continue
		}
		if (body[field.key] === null || body[field.key] === "") {
			values[field.key] = null
			continue
		}
		const raw = body[field.key]
		if (typeof raw !== "number" && typeof raw !== "string") {
			throw new Error(`${field.label} must be a number`)
		}
		const value = Number(raw)
		const precision = field.key === "extraPercent" ? 1000 : 10
		if (
			Math.abs(value * precision - Math.round(value * precision)) >
			0.000001
		) {
			throw new Error(`${field.label} has too many decimal places`)
		}
		if (!Number.isFinite(value) || value < 0 || value > field.max) {
			throw new Error(`${field.label} must be between 0 and ${field.max}`)
		}
		values[field.key] = value
	}
	return values
}

export const storeUrlSchema = z
	.string()
	.trim()
	.max(1000)
	.refine(
		(value) => getStorefront(value) !== null,
		"Use a Steam, Epic, GOG, App Store, or Google Play game URL."
	)
	.transform((value) => getStorefront(value)!.url)

export const gamePayload = z.object({
	title: z.string().min(1),
	source: z.enum(["steam", "igdb", "manual"]).default("manual"),
	steamAppId: z.number().int().optional().nullable(),
	igdbId: z.number().int().optional().nullable(),
	coverUrl: z.string().optional().nullable(),
	releaseYear: z.number().int().optional().nullable(),
	storeUrl: storeUrlSchema.nullable().optional()
})

export const saveGame = async (
	db: ReturnType<typeof getDb>,
	payload: z.infer<typeof gamePayload>
) => {
	const id = crypto.randomUUID()
	const row = {
		id,
		title: payload.title,
		slug: `${slugify(payload.title)}-${id.slice(0, 6)}`,
		source: payload.source,
		steamAppId: payload.steamAppId ?? null,
		igdbId: payload.igdbId ?? null,
		coverUrl: payload.coverUrl ?? null,
		releaseYear: payload.releaseYear ?? null
	}
	const identity =
		payload.steamAppId != null
			? eq(games.steamAppId, payload.steamAppId)
			: payload.igdbId != null
				? eq(games.igdbId, payload.igdbId)
				: eq(games.id, id)
	const inserted = await db
		.insert(games)
		.values(row)
		.onConflictDoNothing({
			target:
				payload.steamAppId != null
					? games.steamAppId
					: payload.igdbId != null
						? games.igdbId
						: games.id
		})
		.returning()
		.get()
	const saved =
		inserted ?? (await db.select().from(games).where(identity).get())
	if (!saved) throw new Error("Unable to save game. Please try again.")
	return saved
}

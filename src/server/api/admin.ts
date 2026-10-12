import { and, eq } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"
import { calculateScore } from "~/lib/scoring"
import { getAuth } from "../auth"
import { getDb } from "../db"
import {
	account,
	gameEntries,
	games,
	mergeSuggestions,
	profiles,
	user
} from "../db/schema"
import { type ApiEnv, jsonError, requireSession } from "./context"

const discordAdminId = "439223656200273932"

const adminDataTables = [
	"profiles",
	"games",
	"gameEntries",
	"mergeSuggestions"
] as const

const profileUpdate = z
	.object({
		slug: z.string().min(2).max(40).optional(),
		displayName: z.string().min(1).max(80).optional(),
		avatarUrl: z.string().nullable().optional(),
		bio: z.string().max(800).optional(),
		favoriteGenres: z.string().optional(),
		isPublic: z.boolean().optional(),
		steamVanity: z.string().nullable().optional(),
		playtimeSyncedAt: z.coerce.date().nullable().optional(),
		playtimeSyncAttemptAt: z.coerce.date().nullable().optional()
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0)

const gameUpdate = z
	.object({
		title: z.string().min(1).optional(),
		slug: z.string().min(1).optional(),
		source: z.enum(["steam", "igdb", "manual"]).optional(),
		steamAppId: z.number().int().nullable().optional(),
		igdbId: z.number().int().nullable().optional(),
		coverUrl: z.string().nullable().optional(),
		releaseYear: z.number().int().nullable().optional()
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0)

const gameEntryUpdate = z
	.object({
		userId: z.string().optional(),
		gameId: z.string().nullable().optional(),
		manualTitle: z.string().nullable().optional(),
		coverUrl: z.string().nullable().optional(),
		hidden: z.boolean().optional(),
		importedFromSteam: z.boolean().optional(),
		steamAppId: z.number().int().nullable().optional(),
		playtimeMinutes: z.number().int().nullable().optional(),
		paidPriceCents: z.number().int().nullable().optional(),
		storeUrl: z.string().nullable().optional(),
		funFeeling: z.number().nullable().optional(),
		immersive: z.number().nullable().optional(),
		variety: z.number().nullable().optional(),
		artistry: z.number().nullable().optional(),
		ui: z.number().nullable().optional(),
		narrationTheme: z.number().nullable().optional(),
		authenticity: z.number().nullable().optional(),
		originality: z.number().nullable().optional(),
		music: z.number().nullable().optional(),
		effectsVocals: z.number().nullable().optional(),
		interfaceScore: z.number().nullable().optional(),
		control: z.number().nullable().optional(),
		learningCurve: z.number().nullable().optional(),
		performancePenalty: z.number().nullable().optional(),
		badMomentPenalty: z.number().nullable().optional(),
		inconsistencyPenalty: z.number().nullable().optional(),
		replayabilityBonus: z.number().nullable().optional(),
		extraPercent: z.number().nullable().optional(),
		notes: z.string().nullable().optional()
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0)

const mergeSuggestionUpdate = z
	.object({
		userId: z.string().optional(),
		fromGameId: z.string().nullable().optional(),
		toGameId: z.string().nullable().optional(),
		reason: z.string().min(1).optional(),
		status: z.enum(["open", "dismissed", "merged"]).optional()
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0)

const getAdminUserId = async (env: Cloudflare.Env) =>
	await getDb(env.DB)
		.select({ userId: account.userId })
		.from(account)
		.where(
			and(
				eq(account.providerId, "discord"),
				eq(account.accountId, discordAdminId)
			)
		)
		.get()

const requireAdmin = async (env: Cloudflare.Env, headers: Headers) => {
	const session = await requireSession(env, headers)
	const adminUser = await getAdminUserId(env)
	if (
		!adminUser ||
		adminUser.userId !== session.user.id ||
		session.session.impersonatedBy
	)
		throw new Error("Admin access required")
	return { session, adminUserId: adminUser.userId }
}

export const adminRoutes = new Hono<ApiEnv>()

adminRoutes.get("/admin/users", async (c) => {
	try {
		await requireAdmin(c.env, c.req.raw.headers)
		const users = await getDb(c.env.DB)
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				role: user.role,
				banned: user.banned,
				banReason: user.banReason,
				banExpires: user.banExpires,
				profile: profiles
			})
			.from(user)
			.leftJoin(profiles, eq(profiles.userId, user.id))
			.orderBy(user.createdAt)
		return c.json({ data: users })
	} catch (error) {
		const unauthorized = (error as Error).message === "Sign in required"
		return c.json(
			jsonError(
				unauthorized ? "Sign in required" : "Admin access required",
				unauthorized ? 401 : 403
			),
			unauthorized ? 401 : 403
		)
	}
})

adminRoutes.get("/admin/users/:id", async (c) => {
	try {
		await requireAdmin(c.env, c.req.raw.headers)
		const db = getDb(c.env.DB)
		const target = await db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				role: user.role,
				banned: user.banned,
				banReason: user.banReason,
				banExpires: user.banExpires,
				profile: profiles
			})
			.from(user)
			.leftJoin(profiles, eq(profiles.userId, user.id))
			.where(eq(user.id, c.req.param("id")))
			.get()
		if (!target) return c.json(jsonError("User not found.", 404), 404)
		const entries = await db
			.select({ entry: gameEntries, game: games })
			.from(gameEntries)
			.leftJoin(games, eq(gameEntries.gameId, games.id))
			.where(eq(gameEntries.userId, target.id))
		return c.json({
			data: {
				...target,
				entries: entries.map(({ entry, game }) => ({
					...entry,
					game,
					title: entry.manualTitle ?? game?.title ?? "Untitled game",
					score: calculateScore(entry)
				}))
			}
		})
	} catch (error) {
		const unauthorized = (error as Error).message === "Sign in required"
		return c.json(
			jsonError(
				unauthorized ? "Sign in required" : "Admin access required",
				unauthorized ? 401 : 403
			),
			unauthorized ? 401 : 403
		)
	}
})

adminRoutes.get("/admin/data/:table", async (c) => {
	try {
		await requireAdmin(c.env, c.req.raw.headers)
		const table = c.req.param("table")
		if (
			!adminDataTables.includes(table as (typeof adminDataTables)[number])
		)
			return c.json(jsonError("Unknown app-data table.", 404), 404)
		const db = getDb(c.env.DB)
		const data =
			table === "profiles"
				? await db.select().from(profiles)
				: table === "games"
					? await db.select().from(games)
					: table === "gameEntries"
						? await db
								.select({
									entry: gameEntries,
									gameTitle: games.title,
									ownerName: user.name
								})
								.from(gameEntries)
								.leftJoin(
									games,
									eq(gameEntries.gameId, games.id)
								)
								.innerJoin(
									user,
									eq(gameEntries.userId, user.id)
								)
								.then((rows) =>
									rows.map(
										({ entry, gameTitle, ownerName }) => ({
											...entry,
											gameTitle,
											ownerName
										})
									)
								)
						: await db
								.select({
									suggestion: mergeSuggestions,
									ownerName: user.name
								})
								.from(mergeSuggestions)
								.innerJoin(
									user,
									eq(mergeSuggestions.userId, user.id)
								)
								.then((rows) =>
									rows.map(({ suggestion, ownerName }) => ({
										...suggestion,
										ownerName
									}))
								)
		return c.json({ data })
	} catch (error) {
		const unauthorized = (error as Error).message === "Sign in required"
		return c.json(
			jsonError(
				unauthorized ? "Sign in required" : "Admin access required",
				unauthorized ? 401 : 403
			),
			unauthorized ? 401 : 403
		)
	}
})

adminRoutes.get("/admin/data/:table/:id", async (c) => {
	try {
		await requireAdmin(c.env, c.req.raw.headers)
		const table = c.req.param("table")
		const id = c.req.param("id")
		const db = getDb(c.env.DB)
		const record =
			table === "profiles"
				? await db
						.select()
						.from(profiles)
						.where(eq(profiles.userId, id))
						.get()
				: table === "games"
					? await db
							.select()
							.from(games)
							.where(eq(games.id, id))
							.get()
					: table === "gameEntries"
						? await db
								.select()
								.from(gameEntries)
								.where(eq(gameEntries.id, id))
								.get()
						: table === "mergeSuggestions"
							? await db
									.select()
									.from(mergeSuggestions)
									.where(eq(mergeSuggestions.id, id))
									.get()
							: null
		if (!record) return c.json(jsonError("Record not found.", 404), 404)
		return c.json({ data: record })
	} catch (error) {
		const unauthorized = (error as Error).message === "Sign in required"
		return c.json(
			jsonError(
				unauthorized ? "Sign in required" : "Admin access required",
				unauthorized ? 401 : 403
			),
			unauthorized ? 401 : 403
		)
	}
})

adminRoutes.patch("/admin/data/:table/:id", async (c) => {
	try {
		await requireAdmin(c.env, c.req.raw.headers)
		const table = c.req.param("table")
		const id = c.req.param("id")
		const body: unknown = await c.req.json()
		const db = getDb(c.env.DB)
		let row
		switch (table) {
			case "profiles":
				row = await db
					.update(profiles)
					.set(profileUpdate.parse(body))
					.where(eq(profiles.userId, id))
					.returning()
					.get()
				break
			case "games":
				row = await db
					.update(games)
					.set(gameUpdate.parse(body))
					.where(eq(games.id, id))
					.returning()
					.get()
				break
			case "gameEntries":
				row = await db
					.update(gameEntries)
					.set(gameEntryUpdate.parse(body))
					.where(eq(gameEntries.id, id))
					.returning()
					.get()
				break
			case "mergeSuggestions":
				row = await db
					.update(mergeSuggestions)
					.set(mergeSuggestionUpdate.parse(body))
					.where(eq(mergeSuggestions.id, id))
					.returning()
					.get()
				break
			default:
				return c.json(jsonError("Unknown app-data table.", 404), 404)
		}
		return row
			? c.json({ data: row })
			: c.json(jsonError("Record not found.", 404), 404)
	} catch (error) {
		const unauthorized = (error as Error).message === "Sign in required"
		const forbidden = (error as Error).message === "Admin access required"
		const status = unauthorized
			? 401
			: forbidden
				? 403
				: error instanceof z.ZodError
					? 400
					: 500
		return c.json(
			jsonError(
				unauthorized
					? "Sign in required"
					: forbidden
						? "Admin access required"
						: error instanceof z.ZodError
							? error.issues[0].message
							: "Unable to update this record.",
				status
			),
			status
		)
	}
})

adminRoutes.delete("/admin/data/:table/:id", async (c) => {
	try {
		await requireAdmin(c.env, c.req.raw.headers)
		const table = c.req.param("table")
		const id = c.req.param("id")
		const db = getDb(c.env.DB)
		let deleted
		switch (table) {
			case "profiles":
				deleted = await db
					.delete(profiles)
					.where(eq(profiles.userId, id))
					.returning({ userId: profiles.userId })
					.get()
				break
			case "games":
				deleted = await db
					.delete(games)
					.where(eq(games.id, id))
					.returning({ id: games.id })
					.get()
				break
			case "gameEntries":
				deleted = await db
					.delete(gameEntries)
					.where(eq(gameEntries.id, id))
					.returning({ id: gameEntries.id })
					.get()
				break
			case "mergeSuggestions":
				deleted = await db
					.delete(mergeSuggestions)
					.where(eq(mergeSuggestions.id, id))
					.returning({ id: mergeSuggestions.id })
					.get()
				break
			default:
				return c.json(jsonError("Unknown app-data table.", 404), 404)
		}
		return deleted
			? c.json({ data: { deleted: true } })
			: c.json(jsonError("Record not found.", 404), 404)
	} catch (error) {
		const unauthorized = (error as Error).message === "Sign in required"
		const forbidden = (error as Error).message === "Admin access required"
		const status = unauthorized ? 401 : forbidden ? 403 : 500
		return c.json(
			jsonError(
				unauthorized
					? "Sign in required"
					: forbidden
						? "Admin access required"
						: "Unable to delete this record.",
				status
			),
			status
		)
	}
})

export const adminAuthHandler = async (
	env: Cloudflare.Env,
	request: Request
) => {
	const adminUser = await getAdminUserId(env)
	if (!adminUser)
		return Response.json(
			{ error: "Admin account not linked." },
			{ status: 403 }
		)
	return getAuth(env, [adminUser.userId]).handler(request)
}

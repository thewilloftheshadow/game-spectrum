import { and, eq } from "drizzle-orm"
import { Hono } from "hono"
import { calculateScore } from "~/lib/scoring"
import { getAuth } from "../auth"
import { getDb } from "../db"
import { account, gameEntries, games, profiles, user } from "../db/schema"
import { type ApiEnv, jsonError, requireSession } from "./context"

const discordAdminId = "439223656200273932"

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

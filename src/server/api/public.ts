import { and, eq, or } from "drizzle-orm"
import { Hono } from "hono"
import { calculateScore } from "~/lib/scoring"
import { getDb } from "../db"
import { gameEntries, games, profiles, user } from "../db/schema"
import { type ApiEnv, jsonError, requiredSecret } from "./context"

export const publicProfile = async (env: Cloudflare.Env, userId: string) => {
	const db = getDb(env.DB)
	const profile = await db
		.select({
			profile: {
				slug: profiles.slug,
				displayName: profiles.displayName,
				bio: profiles.bio,
				favoriteGenres: profiles.favoriteGenres
			},
			owner: { image: user.image }
		})
		.from(profiles)
		.innerJoin(user, eq(profiles.userId, user.id))
		.where(and(eq(profiles.userId, userId), eq(profiles.isPublic, true)))
		.get()
	if (!profile) {
		return null
	}
	const rows = await db
		.select({ entry: gameEntries, game: games })
		.from(gameEntries)
		.leftJoin(games, eq(gameEntries.gameId, games.id))
		.where(
			and(eq(gameEntries.userId, userId), eq(gameEntries.hidden, false))
		)
	const entries = rows
		.map(({ entry, game }) => ({
			id: entry.id,
			hidden: entry.hidden,
			funFeeling: entry.funFeeling,
			immersive: entry.immersive,
			variety: entry.variety,
			artistry: entry.artistry,
			ui: entry.ui,
			narrationTheme: entry.narrationTheme,
			authenticity: entry.authenticity,
			originality: entry.originality,
			music: entry.music,
			effectsVocals: entry.effectsVocals,
			interfaceScore: entry.interfaceScore,
			control: entry.control,
			learningCurve: entry.learningCurve,
			performancePenalty: entry.performancePenalty,
			badMomentPenalty: entry.badMomentPenalty,
			inconsistencyPenalty: entry.inconsistencyPenalty,
			replayabilityBonus: entry.replayabilityBonus,
			extraPercent: entry.extraPercent,
			title: game?.title ?? entry.manualTitle ?? "Untitled game",
			coverUrl: entry.coverUrl ?? game?.coverUrl ?? null,
			score: calculateScore(entry)
		}))
		.filter((entry) => entry.score !== null)
		.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
	return { ...profile, entries }
}

export const publicRoutes = new Hono<ApiEnv>()

publicRoutes.get("/u/:slug", async (c) => {
	const profile = await getDb(c.env.DB)
		.select()
		.from(profiles)
		.where(
			and(
				eq(profiles.slug, c.req.param("slug")),
				eq(profiles.isPublic, true)
			)
		)
		.get()
	const data = profile && (await publicProfile(c.env, profile.userId))
	if (!data) {
		return c.json(jsonError("not found", 404), 404)
	}
	return c.json({ data })
})

publicRoutes.get("/steam/:thing", async (c) => {
	const thing = c.req.param("thing")
	let profile = await getDb(c.env.DB)
		.select({ profile: profiles, owner: user })
		.from(profiles)
		.innerJoin(user, eq(profiles.userId, user.id))
		.where(
			and(
				eq(profiles.isPublic, true),
				or(eq(user.steamId, thing), eq(profiles.steamVanity, thing))
			)
		)
		.get()

	if (!profile && !/^\d+$/.test(thing)) {
		const resolved = await fetch(
			`https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${encodeURIComponent(requiredSecret(c.env, "STEAM_API_KEY"))}&vanityurl=${encodeURIComponent(thing)}`
		)
			.then(
				(response) =>
					response.json() as Promise<{
						response?: { success?: number; steamid?: string }
					}>
			)
			.catch(() => null)
		if (resolved?.response?.steamid) {
			profile = await getDb(c.env.DB)
				.select({ profile: profiles, owner: user })
				.from(profiles)
				.innerJoin(user, eq(profiles.userId, user.id))
				.where(
					and(
						eq(profiles.isPublic, true),
						eq(user.steamId, resolved.response.steamid)
					)
				)
				.get()
		}
	}

	const data = profile && (await publicProfile(c.env, profile.profile.userId))
	if (!data) {
		return c.json(jsonError("not found", 404), 404)
	}
	return c.json({ data })
})

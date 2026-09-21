import { and, asc, eq, isNotNull, isNull, lt, or } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "./db"
import { profiles, user } from "./db/schema"
import { requiredSecret } from "./api/context"

export const getOwnedSteamGames = async (
	env: Cloudflare.Env,
	steamId: string,
	includeAppInfo = false
) => {
	const response = await fetch(
		`https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${encodeURIComponent(requiredSecret(env, "STEAM_API_KEY"))}&steamid=${encodeURIComponent(steamId)}&include_appinfo=${includeAppInfo ? 1 : 0}&include_played_free_games=1&format=json`,
		{ signal: AbortSignal.timeout(15_000) }
	)
	if (!response.ok) throw new Error("Steam is unavailable. Please try again.")
	const data = z
		.object({
			response: z
				.object({
					game_count: z.number().optional(),
					games: z
						.array(
							z.object({
								appid: z.number().int().positive(),
								name: z.string().optional(),
								playtime_forever: z
									.number()
									.int()
									.nonnegative()
									.optional()
							})
						)
						.optional()
				})
				.optional()
		})
		.safeParse(await response.json())
	if (!data.success)
		throw new Error("Steam returned an invalid library. Please try again.")
	if (
		!data.data.response ||
		(!data.data.response.games && data.data.response.game_count !== 0)
	)
		throw new Error(
			"Steam library unavailable. Set your Steam Game Details to public, then try again."
		)
	return [
		...new Map(
			(data.data.response.games ?? []).map((game) => [game.appid, game])
		).values()
	].sort((a, b) => a.appid - b.appid)
}

export const prepareSteamPlaytimeUpdate = (
	env: Cloudflare.Env,
	userId: string,
	owned: Awaited<ReturnType<typeof getOwnedSteamGames>>
) =>
	env.DB.prepare(`WITH playtime AS (SELECT CAST(key AS INTEGER) AS app_id, CAST(value AS INTEGER) AS minutes FROM json_each(?))
	UPDATE game_entries SET playtime_minutes = playtime.minutes, updated_at = ? FROM playtime
	WHERE game_entries.user_id = ? AND (game_entries.steam_app_id = playtime.app_id OR
	(game_entries.steam_app_id IS NULL AND game_entries.game_id = (SELECT id FROM games WHERE games.steam_app_id = playtime.app_id)))`).bind(
		JSON.stringify(
			Object.fromEntries(
				owned
					.filter((game) => game.playtime_forever !== undefined)
					.map((game) => [game.appid, game.playtime_forever])
			)
		),
		Date.now(),
		userId
	)

export const syncSteamPlaytime = async (
	env: Cloudflare.Env,
	userId: string,
	steamId: string
) => {
	const db = getDb(env.DB)
	const startedAt = new Date()
	const claimed = await db
		.update(profiles)
		.set({ playtimeSyncAttemptAt: startedAt })
		.where(
			and(
				eq(profiles.userId, userId),
				or(
					isNull(profiles.playtimeSyncAttemptAt),
					lt(
						profiles.playtimeSyncAttemptAt,
						new Date(startedAt.getTime() - 60_000)
					)
				)
			)
		)
		.returning({ userId: profiles.userId })
		.get()
	if (!claimed)
		throw new Error(
			"A sync was just started. Please wait a minute before trying again."
		)
	const owned = await getOwnedSteamGames(env, steamId)
	const syncedAt = new Date()
	// A single JSON parameter keeps large libraries below D1's binding limit.
	const results = await env.DB.batch([
		prepareSteamPlaytimeUpdate(env, userId, owned),
		env.DB.prepare(
			"UPDATE profiles SET playtime_synced_at = ?, updated_at = ? WHERE user_id = ?"
		).bind(syncedAt.getTime(), syncedAt.getTime(), userId)
	])
	return {
		updated: results[0].meta.changes,
		syncedAt: syncedAt.toISOString()
	}
}

export const syncDueSteamPlaytime = async (env: Cloudflare.Env) => {
	const due = new Date(Date.now() - 48 * 60 * 60 * 1000)
	const accounts = await getDb(env.DB)
		.select({ userId: profiles.userId, steamId: user.steamId })
		.from(profiles)
		.innerJoin(user, eq(profiles.userId, user.id))
		.where(
			and(
				isNotNull(user.steamId),
				or(
					isNull(profiles.playtimeSyncedAt),
					lt(profiles.playtimeSyncedAt, due)
				),
				or(
					isNull(profiles.playtimeSyncAttemptAt),
					lt(profiles.playtimeSyncAttemptAt, due)
				)
			)
		)
		.orderBy(asc(profiles.playtimeSyncAttemptAt), asc(profiles.userId))
		.limit(10)
	for (const account of accounts) {
		if (!account.steamId) continue
		try {
			await syncSteamPlaytime(env, account.userId, account.steamId)
		} catch {
			console.warn(
				"Scheduled Steam playtime sync unavailable; retaining saved hours."
			)
		}
	}
}

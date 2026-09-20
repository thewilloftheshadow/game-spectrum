import { and, eq, or } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"
import { calculateScore, ratingFields } from "~/lib/scoring"
import { getAuth } from "./auth"
import { getDb } from "./db"
import { gameEntries, games, profiles, user } from "./db/schema"

export const api = new Hono<{ Bindings: Cloudflare.Env }>()

const secret = (env: Cloudflare.Env, name: string) =>
	(env as unknown as Record<string, string | undefined>)[name]

const requiredSecret = (env: Cloudflare.Env, name: string) => {
	const value = secret(env, name)
	if (!value) {
		throw new Error(`${name} is required`)
	}
	return value
}

const slugify = (value: string) =>
	value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "") || crypto.randomUUID().slice(0, 8)

const jsonError = (message: string, status = 400) => ({
	error: { message },
	status
})

const requireSession = async (env: Cloudflare.Env, headers: Headers) => {
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
		await db.insert(profiles).values({
			userId: session.user.id,
			slug: `${slugify(session.user.name)}-${session.user.id.slice(0, 6)}`,
			displayName: session.user.name,
			avatarUrl: session.user.image
		})
	}

	return session
}

const parseScoreBody = (body: Record<string, unknown>) => {
	const values: Record<string, number | null> = {}
	for (const field of ratingFields) {
		if (!(field.key in body)) {
			continue
		}
		if (body[field.key] === null || body[field.key] === "") {
			values[field.key] = null
			continue
		}
		const value = Math.round(Number(body[field.key]) * 10) / 10
		if (!Number.isFinite(value) || value < 0 || value > field.max) {
			throw new Error(`${field.label} must be between 0 and ${field.max}`)
		}
		values[field.key] = value
	}
	return values
}

const gamePayload = z.object({
	title: z.string().min(1),
	source: z.enum(["steam", "igdb", "manual"]).default("manual"),
	steamAppId: z.number().int().optional().nullable(),
	igdbId: z.number().int().optional().nullable(),
	coverUrl: z.string().optional().nullable(),
	releaseYear: z.number().int().optional().nullable()
})

const saveGame = async (
	db: ReturnType<typeof getDb>,
	payload: z.infer<typeof gamePayload>
) => {
	const existing = payload.steamAppId
		? await db
				.select()
				.from(games)
				.where(eq(games.steamAppId, payload.steamAppId))
				.get()
		: payload.igdbId
			? await db
					.select()
					.from(games)
					.where(eq(games.igdbId, payload.igdbId))
					.get()
			: null

	if (existing) {
		return existing
	}

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
	await db.insert(games).values(row)
	return row
}

api.all("/api/auth/*", (c) => getAuth(c.env).handler(c.req.raw))

api.get("/api", (c) => c.json({ data: { ok: true } }))

api.get("/api/me", async (c) => {
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

api.patch("/api/profile", async (c) => {
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

api.get("/api/entries", async (c) => {
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

api.post("/api/entries", async (c) => {
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

api.patch("/api/entries/:id", async (c) => {
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

api.get("/api/games/search", async (c) => {
	const query = c.req.query("q")?.trim()
	if (!query) {
		return c.json({ data: [] })
	}

	const steam = await fetch(
		`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=english&cc=US`
	)
		.then((response) => response.json() as Promise<{ items?: unknown[] }>)
		.then((data) =>
			(data.items ?? []).slice(0, 8).map((item) => {
				const game = item as {
					id: number
					name: string
					tiny_image?: string
				}
				return {
					title: game.name,
					source: "steam",
					steamAppId: game.id,
					coverUrl:
						game.tiny_image ??
						`https://cdn.akamai.steamstatic.com/steam/apps/${game.id}/header.jpg`
				}
			})
		)
		.catch(() => [])

	const igdb = await fetch("https://api.igdb.com/v4/games", {
		body: `search "${query.replaceAll('"', "")}"; fields name,first_release_date,cover.image_id; limit 8;`,
		headers: {
			"Client-ID": requiredSecret(c.env, "IGDB_CLIENT_ID"),
			Authorization: `Bearer ${requiredSecret(c.env, "IGDB_ACCESS_TOKEN")}`
		},
		method: "POST"
	})
		.then((response) => (response.ok ? response.json() : []))
		.then((data) =>
			(data as unknown[]).map((item) => {
				const game = item as {
					id: number
					name: string
					first_release_date?: number
					cover?: { image_id?: string }
				}
				return {
					title: game.name,
					source: "igdb",
					igdbId: game.id,
					coverUrl: game.cover?.image_id
						? `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`
						: null,
					releaseYear: game.first_release_date
						? new Date(
								game.first_release_date * 1000
							).getUTCFullYear()
						: null
				}
			})
		)
		.catch(() => [])

	return c.json({
		data: [
			...steam,
			...igdb,
			{ title: query, source: "manual", coverUrl: null }
		]
	})
})

api.post("/api/steam/import", async (c) => {
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

const publicProfile = async (env: Cloudflare.Env, userId: string) => {
	const db = getDb(env.DB)
	const profile = await db
		.select({ profile: profiles, owner: user })
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
			...entry,
			game,
			title: game?.title ?? entry.manualTitle ?? "Untitled game",
			coverUrl: entry.coverUrl ?? game?.coverUrl,
			score: calculateScore(entry)
		}))
		.filter((entry) => entry.score !== null)
		.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
	return { ...profile, entries }
}

api.get("/api/public/u/:slug", async (c) => {
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

api.get("/api/public/steam/:thing", async (c) => {
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

api.notFound((c) => c.json({ error: { message: "not found" } }, 404))

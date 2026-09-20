import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"
import { getAuth } from "../auth"
import { getDb } from "../db"
import { account } from "../db/schema"
import {
	type ApiEnv,
	jsonError,
	requiredSecret,
	requireSession
} from "./context"

export const getConnectedAccounts = async (
	env: Cloudflare.Env,
	headers: Headers
) => {
	const session = await requireSession(env, headers)
	const rows = await getDb(env.DB)
		.select({
			id: account.id,
			providerId: account.providerId,
			accountId: account.accountId
		})
		.from(account)
		.where(eq(account.userId, session.user.id))
	const auth = getAuth(env)
	return Promise.all(
		rows.map(async (row) => {
			try {
				if (row.providerId === "steam") {
					const response = await fetch(
						`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${encodeURIComponent(requiredSecret(env, "STEAM_API_KEY"))}&steamids=${encodeURIComponent(row.accountId)}`,
						{ signal: AbortSignal.timeout(10_000) }
					)
					if (!response.ok)
						throw new Error("Steam profile unavailable")
					const data = z
						.object({
							response: z.object({
								players: z.array(
									z.object({
										steamid: z.string(),
										personaname: z.string()
									})
								)
							})
						})
						.parse(await response.json())
					const player = data.response.players.find(
						(player) => player.steamid === row.accountId
					)
					return {
						...row,
						details: player
							? { name: player.personaname, email: null }
							: null
					}
				}
				if (
					row.providerId === "discord" ||
					row.providerId === "twitch"
				) {
					const info = await auth.api.accountInfo({
						headers,
						query: { accountId: row.id }
					})
					return {
						...row,
						details: {
							name: info.user.name ?? null,
							email: info.user.email ?? null
						}
					}
				}
			} catch {
				// Keep the connection visible when a provider is temporarily unavailable.
			}
			return { ...row, details: null }
		})
	)
}

export const accountRoutes = new Hono<ApiEnv>()

accountRoutes.get("/accounts", async (c) => {
	try {
		return c.json({
			data: await getConnectedAccounts(c.env, c.req.raw.headers)
		})
	} catch (error) {
		if (error instanceof Error && error.message === "Sign in required")
			return c.json(jsonError("Sign in required", 401), 401)
		console.error("Unable to load account connections", error)
		return c.json(
			jsonError("Unable to load account connections.", 500),
			500
		)
	}
})

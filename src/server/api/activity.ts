import { getCookies } from "better-auth/cookies"
import { serializeSignedCookie } from "better-call"
import { Hono } from "hono"
import { getAuth } from "../auth"
import {
	type ApiEnv,
	jsonError,
	requiredSecret,
	requireSession
} from "./context"

const discordTokenUrl = "https://discord.com/api/v10/oauth2/token"
const discordMeUrl = "https://discord.com/api/v10/users/@me"

const exchangeDiscordActivityCode = async (
	env: Cloudflare.Env,
	code: string
) => {
	const response = await fetch(discordTokenUrl, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: requiredSecret(env, "DISCORD_CLIENT_ID"),
			client_secret: requiredSecret(env, "DISCORD_CLIENT_SECRET"),
			grant_type: "authorization_code",
			code
		})
	})

	if (!response.ok) throw new Error("DISCORD_ACTIVITY_CODE_EXCHANGE_FAILED")

	const token = (await response.json()) as {
		access_token?: string
		refresh_token?: string
		expires_in?: number
		scope?: string
	}
	if (!token.access_token || !token.expires_in)
		throw new Error("DISCORD_ACTIVITY_INVALID_TOKEN")

	return {
		accessToken: token.access_token,
		refreshToken: token.refresh_token ?? null,
		expiresAt: new Date(Date.now() + token.expires_in * 1000),
		scope: token.scope ?? "identify email guilds"
	}
}

const discordAvatarUrl = (id: string, avatar?: string | null) =>
	avatar
		? `https://cdn.discordapp.com/avatars/${id}/${avatar}.${avatar.startsWith("a_") ? "gif" : "png"}`
		: null

const getDiscordActivityUser = async (
	token: Awaited<ReturnType<typeof exchangeDiscordActivityCode>>
) => {
	const response = await fetch(discordMeUrl, {
		headers: { Authorization: `Bearer ${token.accessToken}` }
	})
	if (!response.ok) throw new Error("DISCORD_ACTIVITY_USER_FETCH_FAILED")

	const user = (await response.json()) as {
		id?: string
		username?: string
		global_name?: string | null
		email?: string | null
		verified?: boolean
		avatar?: string | null
	}
	if (!user.id || !user.username)
		throw new Error("DISCORD_ACTIVITY_INVALID_USER")

	return {
		id: user.id,
		name: user.global_name || user.username,
		email: user.email ?? `${user.id}@discord.gamespectrum.org`,
		emailVerified: user.verified ?? !!user.email,
		image: discordAvatarUrl(user.id, user.avatar),
		profile: user
	}
}

const syncDiscordActivityUser = async (
	env: Cloudflare.Env,
	token: Awaited<ReturnType<typeof exchangeDiscordActivityCode>>,
	discordUser: Awaited<ReturnType<typeof getDiscordActivityUser>>
) => {
	const auth = getAuth(env)
	const context = await auth.$context
	const account = await context.internalAdapter.findAccountByKey({
		providerId: "discord",
		accountId: discordUser.id
	})
	let user = account
		? await context.internalAdapter.findUserById(account.userId)
		: null

	if (!user) {
		user =
			(
				await context.internalAdapter.findUserByEmail(
					discordUser.email,
					{
						includeAccounts: false
					}
				)
			)?.user ??
			(await context.internalAdapter.createUser(
				{
					email: discordUser.email,
					emailVerified: discordUser.emailVerified,
					image: discordUser.image,
					name: discordUser.name
				},
				{
					method: "oauth",
					oauth: {
						providerId: "discord",
						profile: discordUser.profile
					}
				}
			))
	}

	if (account) {
		await Promise.all([
			context.internalAdapter.updateAccount(account.id, {
				accessToken: token.accessToken,
				accessTokenExpiresAt: token.expiresAt,
				refreshToken: token.refreshToken,
				scope: token.scope
			}),
			context.internalAdapter.updateUser(user.id, {
				image: discordUser.image,
				name: discordUser.name
			})
		])
	} else {
		await context.internalAdapter.linkAccount({
			accountId: discordUser.id,
			accessToken: token.accessToken,
			accessTokenExpiresAt: token.expiresAt,
			providerId: "discord",
			refreshToken: token.refreshToken,
			scope: token.scope,
			userId: user.id
		})
	}

	return { auth, context, user }
}

const appendSessionCookie = async (
	response: Response,
	auth: ReturnType<typeof getAuth>,
	context: Awaited<ReturnType<typeof getAuth>["$context"]>,
	userId: string
) => {
	const session = await context.internalAdapter.createSession(userId)
	const cookie = getCookies(auth.options).sessionToken
	response.headers.append(
		"Set-Cookie",
		await serializeSignedCookie(
			cookie.name,
			session.token,
			context.secret,
			{
				...cookie.attributes,
				maxAge: context.sessionConfig.expiresIn,
				partitioned: true,
				sameSite: "none",
				secure: true
			}
		)
	)
}

export const activityAuthRoutes = new Hono<ApiEnv>()

activityAuthRoutes.post("/activity-link-discord", async (c) => {
	const { code } = (await c.req.json().catch(() => ({}))) as {
		code?: string
	}
	if (!code) return c.json(jsonError("missing code", 400), 400)

	try {
		const session = await requireSession(c.env, c.req.raw.headers)
		const token = await exchangeDiscordActivityCode(c.env, code)
		const discordUser = await getDiscordActivityUser(token)
		const auth = getAuth(c.env)
		const context = await auth.$context
		const account = await context.internalAdapter.findAccountByKey({
			accountId: discordUser.id,
			providerId: "discord"
		})

		if (account && account.userId !== session.user.id) {
			return c.json(
				{
					error: {
						code: "ACCOUNT_ALREADY_LINKED_TO_DIFFERENT_USER",
						message:
							"This Discord account belongs to another Game Spectrum account."
					},
					merge: {
						provider: "Discord"
					}
				},
				409
			)
		}

		if (account) {
			await context.internalAdapter.updateAccount(account.id, {
				accessToken: token.accessToken,
				accessTokenExpiresAt: token.expiresAt,
				refreshToken: token.refreshToken,
				scope: token.scope
			})
		} else {
			await context.internalAdapter.linkAccount({
				accountId: discordUser.id,
				accessToken: token.accessToken,
				accessTokenExpiresAt: token.expiresAt,
				providerId: "discord",
				refreshToken: token.refreshToken,
				scope: token.scope,
				userId: session.user.id
			})
		}

		return c.json({ data: { ok: true } })
	} catch (failure) {
		if (failure instanceof Error && failure.message === "Sign in required")
			return c.json(jsonError("Sign in required", 401), 401)
		console.error("Discord Activity account linking failed", failure)
		return c.json(jsonError("Unable to connect Discord.", 500), 500)
	}
})

activityAuthRoutes.post("/activity-token", async (c) => {
	const { code } = (await c.req.json().catch(() => ({}))) as {
		channelId?: string | null
		code?: string
		guildId?: string | null
	}
	if (!code) return c.json({ error: { message: "missing code" } }, 400)

	try {
		const token = await exchangeDiscordActivityCode(c.env, code)
		const discordUser = await getDiscordActivityUser(token)
		const { auth, context, user } = await syncDiscordActivityUser(
			c.env,
			token,
			discordUser
		)
		const response = c.json({ access_token: token.accessToken })
		await appendSessionCookie(response, auth, context, user.id)
		return response
	} catch (failure) {
		console.error("Discord Activity OAuth failed", failure)
		return c.json({ error: { message: "activity_auth_failed" } }, 401)
	}
})

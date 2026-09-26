import { passkey } from "@better-auth/passkey"
import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { betterAuth } from "better-auth"
import { admin } from "better-auth/plugins"
import { steamOpenID } from "better-auth-steam"
import { getDb } from "./db"
import * as schema from "./db/schema"

const secret = (env: Cloudflare.Env, name: string) =>
	(env as unknown as Record<string, string | undefined>)[name]

const requiredSecret = (env: Cloudflare.Env, name: string) => {
	const value = secret(env, name)
	if (!value) {
		throw new Error(`${name} is required`)
	}
	return value
}

export const authBaseURL = "https://www.gamespectrum.org"

const trustedOrigins = (request?: Request) => {
	const origins = [authBaseURL, "http://localhost:5173"]
	const origin = request?.headers.get("origin")
	if (origin) {
		try {
			const { hostname } = new URL(origin)
			if (hostname.endsWith(".discordsays.com")) origins.push(origin)
		} catch {
			// Ignore invalid Origin headers.
		}
	}
	return origins
}

export function getAuth(env: Cloudflare.Env) {
	const baseURL = secret(env, "BETTER_AUTH_URL") ?? authBaseURL
	return betterAuth({
		baseURL,
		secret: requiredSecret(env, "BETTER_AUTH_SECRET"),
		trustedOrigins,
		database: drizzleAdapter(getDb(env.DB), {
			provider: "sqlite",
			schema
		}),
		socialProviders: {
			discord: {
				clientId: requiredSecret(env, "DISCORD_CLIENT_ID"),
				clientSecret: requiredSecret(env, "DISCORD_CLIENT_SECRET")
			},
			twitch: {
				clientId: requiredSecret(env, "TWITCH_CLIENT_ID"),
				clientSecret: requiredSecret(env, "TWITCH_CLIENT_SECRET"),
				redirectURI: `${baseURL.replace(/\/$/, "")}/api/auth/twitch/callback`
			}
		},
		account: {
			accountLinking: {
				enabled: true,
				trustedProviders: ["discord", "steam", "twitch"],
				allowDifferentEmails: true
			}
		},
		plugins: [
			admin(),
			passkey(),
			steamOpenID({
				apiKey: requiredSecret(env, "STEAM_API_KEY"),
				syntheticEmailDomain: "gamespectrum.org"
			})
		]
	})
}

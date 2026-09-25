import { Client, EntryPointCommand } from "@buape/carbon"
import { createHandler } from "@buape/carbon/adapters/fetch"
import { Hono } from "hono"
import { authBaseURL } from "../auth"
import { type ApiEnv, requiredSecret } from "./context"

class LaunchCommand extends EntryPointCommand {
	name = "launch"
	description = "Launch Game Spectrum"
}

const getCarbonHandler = (env: Cloudflare.Env) =>
	createHandler(
		new Client(
			{
				baseUrl: `${authBaseURL}/api/carbon`,
				clientId: requiredSecret(env, "DISCORD_CLIENT_ID"),
				deploySecret: requiredSecret(env, "CARBON_DEPLOY_SECRET"),
				publicKey: requiredSecret(env, "DISCORD_PUBLIC_KEY"),
				token: requiredSecret(env, "DISCORD_BOT_TOKEN")
			},
			{ commands: [new LaunchCommand()] }
		)
	)

export const carbonRoutes = new Hono<ApiEnv>()

carbonRoutes.get("/carbon", (c) => c.json({ data: { ok: true } }))

carbonRoutes.post("/carbon", (c) => {
	const url = new URL(c.req.url)
	url.pathname = "/api/carbon/interactions"
	return getCarbonHandler(c.env)(new Request(url, c.req.raw), c.executionCtx)
})

carbonRoutes.all("/carbon/*", (c) =>
	getCarbonHandler(c.env)(c.req.raw, c.executionCtx)
)

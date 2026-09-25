import { EntryPointCommand } from "@buape/carbon"
import { Hono } from "hono"
import { type ApiEnv, jsonError, requiredSecret } from "./context"

class LaunchCommand extends EntryPointCommand {
	name = "launch"
	description = "Launch Game Spectrum"
}

const discordApi = "https://discord.com/api/v10"
const deploySecret = "spectrum"

export const carbonRoutes = new Hono<ApiEnv>()

carbonRoutes.get("/carbon", (c) => c.json({ data: { ok: true } }))
carbonRoutes.get("/carbon/interactions", (c) => c.json({ data: { ok: true } }))

carbonRoutes.post("/carbon/interactions", async (c) => {
	const body = (await c.req.json().catch(() => null)) as {
		type?: number
	} | null
	if (body?.type === 1) return c.json({ type: 1 })
	return c.json({ type: 12 })
})

carbonRoutes.get("/carbon/deploy", async (c) => {
	if (c.req.query("secret") !== deploySecret) {
		return c.text("Unauthorized", 401)
	}
	const response = await fetch(
		`${discordApi}/applications/${requiredSecret(c.env, "DISCORD_CLIENT_ID")}/commands`,
		{
			method: "PUT",
			headers: {
				Authorization: `Bot ${requiredSecret(c.env, "DISCORD_BOT_TOKEN")}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify([new LaunchCommand().serialize()])
		}
	)
	if (!response.ok) {
		console.error("Carbon command deploy failed", await response.text())
		return c.json(jsonError("Deploy failed."), 502)
	}
	return c.json({ data: { ok: true } })
})

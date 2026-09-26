import { Hono } from "hono"
import { getAuth } from "./auth"
import { activityAuthRoutes } from "./api/activity"
import { carbonRoutes } from "./api/carbon"
import { entryRoutes } from "./api/entries"
import { accountRoutes } from "./api/accounts"
import { gameRoutes } from "./api/games"
import { type ApiEnv } from "./api/context"
import { profileRoutes } from "./api/profile"
import { publicRoutes } from "./api/public"
import { steamRoutes } from "./api/steam"
import { mediaRoutes } from "./api/media"
import { priceRoutes } from "./api/prices"

export const api = new Hono<ApiEnv>()

api.use("/api/*", async (c, next) => {
	await next()
	if (
		(!c.req.path.startsWith("/api/games/prices/") &&
			!c.req.path.startsWith("/api/media")) ||
		!c.res.ok
	)
		c.header("Cache-Control", "no-store")
})

api.route("/api/auth", activityAuthRoutes)
api.all("/api/auth/twitch/callback", (c) => {
	const url = new URL(c.req.url)
	url.pathname = "/api/auth/callback/twitch"
	return getAuth(c.env).handler(new Request(url, c.req.raw))
})
api.all("/api/auth/*", (c) => getAuth(c.env).handler(c.req.raw))
api.route("/api", carbonRoutes)
api.get("/api", (c) => c.json({ data: { ok: true } }))
api.route("/api", profileRoutes)
api.route("/api", accountRoutes)
api.route("/api", entryRoutes)
api.route("/api", mediaRoutes)
api.route("/api/games", gameRoutes)
api.route("/api/games/prices", priceRoutes)
api.route("/api/steam", steamRoutes)
api.route("/api/public", publicRoutes)

api.notFound((c) => c.json({ error: { message: "not found" } }, 404))

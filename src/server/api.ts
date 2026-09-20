import { Hono } from "hono"
import { getAuth } from "./auth"
import { entryRoutes } from "./api/entries"
import { gameRoutes } from "./api/games"
import { type ApiEnv } from "./api/context"
import { profileRoutes } from "./api/profile"
import { publicRoutes } from "./api/public"
import { steamRoutes } from "./api/steam"

export const api = new Hono<ApiEnv>()

api.all("/api/auth/*", (c) => getAuth(c.env).handler(c.req.raw))
api.get("/api", (c) => c.json({ data: { ok: true } }))
api.route("/api", profileRoutes)
api.route("/api", entryRoutes)
api.route("/api/games", gameRoutes)
api.route("/api/steam", steamRoutes)
api.route("/api/public", publicRoutes)

api.notFound((c) => c.json({ error: { message: "not found" } }, 404))

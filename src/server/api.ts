import { Hono } from "hono"

export const api = new Hono<{ Bindings: Cloudflare.Env }>()

api.get("/api", (c) => c.json({ data: { ok: true } }))

api.notFound((c) => c.json({ error: { message: "not found" } }, 404))

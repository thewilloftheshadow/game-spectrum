import { createRequestHandler, RouterContextProvider } from "react-router"
import { cloudflareContext } from "~/lib/router-context"
import { api } from "~/server/api"
import { syncDueSteamPlaytime } from "~/server/steam"

const requestHandler = createRequestHandler(
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE
)

export default {
	async scheduled(_event, env, ctx) {
		ctx.waitUntil(syncDueSteamPlaytime(env))
	},
	async fetch(request, env, ctx) {
		const pathname = new URL(request.url).pathname

		if (pathname === "/api" || pathname.startsWith("/api/")) {
			return api.fetch(request, env, ctx)
		}

		const publicMatch = pathname.match(/^\/(u|steam)\/([^/]+)\/?$/)
		if (publicMatch) {
			const checkURL = new URL(request.url)
			checkURL.pathname = `/api/public/${publicMatch[1]}/${publicMatch[2]}`
			const check = await api.fetch(
				new Request(checkURL, request),
				env,
				ctx
			)
			if (!check.ok) {
				return new Response(
					check.status === 404 ? "not found" : "Profile unavailable",
					{
						status: check.status === 404 ? 404 : 503,
						headers: { "Cache-Control": "no-store" }
					}
				)
			}
		}

		const context = new RouterContextProvider()
		context.set(cloudflareContext, { env, ctx })
		const response = await requestHandler(request, context)
		if (publicMatch) response.headers.set("Cache-Control", "no-store")
		return response
	}
} satisfies ExportedHandler<Cloudflare.Env>

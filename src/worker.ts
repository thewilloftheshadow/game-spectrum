import { createRequestHandler } from "react-router"
import { api } from "~/server/api"

const requestHandler = createRequestHandler(
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE
)

export default {
	async fetch(request, env, ctx) {
		const pathname = new URL(request.url).pathname

		if (pathname === "/api" || pathname.startsWith("/api/")) {
			return api.fetch(request, env, ctx)
		}

		const publicMatch = pathname.match(/^\/(u|steam)\/([^/]+)$/)
		if (publicMatch) {
			const checkURL = new URL(request.url)
			checkURL.pathname = `/api/public/${publicMatch[1]}/${publicMatch[2]}`
			const check = await api.fetch(
				new Request(checkURL, request),
				env,
				ctx
			)
			if (check.status === 404) {
				return new Response("not found", { status: 404 })
			}
		}

		return requestHandler(request)
	}
} satisfies ExportedHandler<Cloudflare.Env>

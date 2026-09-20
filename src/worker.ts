import { createRequestHandler } from "react-router"
import { api } from "~/server/api"

const requestHandler = createRequestHandler(
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE
)

export default {
	fetch(request, env, ctx) {
		const pathname = new URL(request.url).pathname

		if (pathname === "/api" || pathname.startsWith("/api/")) {
			return api.fetch(request, env, ctx)
		}

		return requestHandler(request)
	}
} satisfies ExportedHandler<Cloudflare.Env>

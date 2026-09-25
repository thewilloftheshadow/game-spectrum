import { createContext } from "react-router"

export const cloudflareContext = createContext<{
	env: Cloudflare.Env
	ctx: ExecutionContext
}>()

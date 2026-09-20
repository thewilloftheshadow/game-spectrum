import { fileURLToPath, URL } from "node:url"
import { cloudflare } from "@cloudflare/vite-plugin"
import { reactRouter } from "@react-router/dev/vite"
import { defineConfig } from "vite"

export default defineConfig({
	plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), reactRouter()],
	resolve: {
		alias: {
			"~": fileURLToPath(new URL("./src", import.meta.url))
		}
	}
})

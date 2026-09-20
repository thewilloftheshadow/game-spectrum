import { passkeyClient } from "@better-auth/passkey/client"
import { createAuthClient } from "better-auth/react"
import { adminClient } from "better-auth/client/plugins"
import { steamOpenIDClient } from "better-auth-steam/client"

export const authClient = createAuthClient({
	baseURL:
		typeof window === "undefined"
			? "https://www.gamespectrum.org"
			: window.location.origin,
	plugins: [adminClient(), passkeyClient(), steamOpenIDClient()]
})

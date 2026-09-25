import {
	PostHogErrorBoundary,
	PostHogProvider,
	usePostHog
} from "@posthog/react"
import posthog from "posthog-js"
import { StrictMode, startTransition, useEffect } from "react"
import { authClient } from "~/lib/auth-client"
import { hydrateRoot } from "react-dom/client"
import { HydratedRouter } from "react-router/dom"

const posthogProjectToken = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN
const posthogHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST
let identifiedUserId: string | null = null

function PostHogIdentity() {
	const posthogClient = usePostHog()
	const { data: session, isPending } = authClient.useSession()

	useEffect(() => {
		if (isPending) return

		const user = session?.user
		if (!user) {
			if (identifiedUserId) {
				posthogClient.reset()
				identifiedUserId = null
			}
			return
		}

		if (identifiedUserId === user.id) return
		if (identifiedUserId) posthogClient.reset()

		posthogClient.identify(user.id, {
			email: user.email,
			name: user.name,
			...(user.role ? { role: user.role } : {})
		})
		identifiedUserId = user.id
	}, [isPending, posthogClient, session])

	return null
}

if (!posthogProjectToken) {
	if (import.meta.env.DEV) {
		throw new Error(
			"VITE_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_PUBLIC_POSTHOG_PROJECT_TOKEN is configured"
		)
	}
} else if (!posthogHost) {
	if (import.meta.env.DEV) {
		throw new Error(
			"VITE_PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_PUBLIC_POSTHOG_HOST is configured"
		)
	}
} else {
	posthog.init(posthogProjectToken, {
		api_host: posthogHost,
		defaults: "2026-01-30",
		logs: {
			serviceName: "game-spectrum-web",
			environment: import.meta.env.MODE
		}
	})
}

startTransition(() => {
	hydrateRoot(
		document,
		<StrictMode>
			<PostHogProvider client={posthog}>
				{posthogProjectToken && posthogHost ? (
					<PostHogIdentity />
				) : null}
				<PostHogErrorBoundary>
					<HydratedRouter />
				</PostHogErrorBoundary>
			</PostHogProvider>
		</StrictMode>
	)
})

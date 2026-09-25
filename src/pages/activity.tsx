import { DiscordSDK } from "@discord/embedded-app-sdk"
import { useEffect, useState } from "react"
import {
	type LoaderFunctionArgs,
	useLoaderData,
	useNavigate
} from "react-router"
import { setDiscordSdk } from "~/lib/discord-sdk"
import { cloudflareContext } from "~/lib/router-context"

const getSecret = (env: Cloudflare.Env, name: string) =>
	(env as unknown as Record<string, string | undefined>)[name] ?? null

export function loader({ context }: LoaderFunctionArgs) {
	const { env } = context.get(cloudflareContext)
	return { clientId: getSecret(env, "DISCORD_CLIENT_ID") }
}

export function ActivityBootstrap({ clientId }: { clientId: string | null }) {
	const [error, setError] = useState<string | null>(null)
	const navigate = useNavigate()

	useEffect(() => {
		let cancelled = false

		async function launchAppChannel() {
			if (!clientId)
				throw new Error("Discord client ID is not configured.")

			const discordSdk = new DiscordSDK(clientId)
			await discordSdk.ready()
			setDiscordSdk(discordSdk)

			const { code } = await discordSdk.commands.authorize({
				client_id: clientId,
				response_type: "code",
				state: "",
				prompt: "none",
				scope: ["identify", "email", "guilds"]
			})

			const response = await fetch("/api/auth/activity-token", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify({
					channelId: discordSdk.channelId,
					code,
					guildId: discordSdk.guildId
				})
			})
			const result = (await response.json()) as {
				access_token?: string
				error?: { message?: string }
			}

			if (!response.ok || !result.access_token) {
				throw new Error(
					result.error?.message ?? "Discord Activity sign-in failed."
				)
			}

			const auth = await discordSdk.commands.authenticate({
				access_token: result.access_token
			})
			if (!auth)
				throw new Error("Discord Activity authentication failed.")

			if (!cancelled) {
				const profileShare = /^profile:(.+)$/.exec(
					discordSdk.customId ?? ""
				)
				const destinationUrl = new URL(
					profileShare
						? `/u/${encodeURIComponent(profileShare[1])}`
						: "/dashboard",
					window.location.origin
				)
				destinationUrl.searchParams.set("activity", "1")
				if (discordSdk.guildId)
					destinationUrl.searchParams.set(
						"guild_id",
						discordSdk.guildId
					)
				if (discordSdk.channelId)
					destinationUrl.searchParams.set(
						"channel_id",
						discordSdk.channelId
					)
				navigate(`${destinationUrl.pathname}${destinationUrl.search}`, {
					replace: true
				})
			}
		}

		launchAppChannel().catch((failure) => {
			if (!cancelled)
				setError(
					failure instanceof Error
						? failure.message
						: "Discord Activity sign-in failed."
				)
		})

		return () => {
			cancelled = true
		}
	}, [clientId, navigate])

	if (!error)
		return (
			<main
				id="main"
				className="page"
				aria-busy="true"
				aria-label="Loading Game Spectrum"
			>
				<div className="skeleton" aria-hidden="true" />
			</main>
		)

	return (
		<main id="main" className="page">
			<h1 className="title">Unable To Open Game Spectrum</h1>
			<p className="error" role="alert">
				{error}
			</p>
		</main>
	)
}

export default function ActivityPage() {
	const { clientId } = useLoaderData<typeof loader>()
	return <ActivityBootstrap clientId={clientId} />
}

import { usePostHog } from "@posthog/react"
import { useState } from "react"
import { getDiscordSdk } from "~/lib/discord-sdk"
import styles from "./copy-profile-link.module.css"

export function CopyProfileLink({
	slug,
	compact = false
}: {
	slug: string
	compact?: boolean
}) {
	const posthog = usePostHog()
	const [copied, setCopied] = useState("")
	const [shared, setShared] = useState("")
	const [fallback, setFallback] = useState("")
	const discordSdk = getDiscordSdk()
	return (
		<span className={styles.copy}>
			<button
				type="button"
				className="secondary"
				title={discordSdk ? "Share Profile Link" : "Copy Profile Link"}
				aria-label={
					discordSdk ? "Share Profile Link" : "Copy Profile Link"
				}
				onClick={async () => {
					const url = new URL(
						`/u/${encodeURIComponent(slug)}`,
						window.location.origin
					).href
					if (discordSdk) {
						try {
							const result = await discordSdk.commands.shareLink({
								custom_id: `profile:${slug}`,
								message: "Check out my Game Spectrum profile."
							})
							if (
								import.meta.env
									.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN &&
								import.meta.env.VITE_PUBLIC_POSTHOG_HOST
							) {
								if (result.didCopyLink)
									posthog.capture("profile_link_copied")
								if (result.didSendMessage)
									posthog.capture("profile_link_shared")
							}
							setCopied(result.didCopyLink ? slug : "")
							setShared(result.didSendMessage ? slug : "")
							setFallback("")
							return
						} catch {
							setShared("")
						}
					}
					try {
						await navigator.clipboard.writeText(url)
						if (
							import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN &&
							import.meta.env.VITE_PUBLIC_POSTHOG_HOST
						)
							posthog.capture("profile_link_copied")
						setCopied(slug)
						setFallback("")
					} catch {
						setCopied("")
						setFallback(url)
					}
				}}
			>
				{compact ? (
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.4"
						aria-hidden="true"
					>
						<path
							d={
								copied === slug || shared === slug
									? "m3 8 3 3 7-7"
									: "M6 5h7v9H6zM10 5V2H3v9h3"
							}
						/>
					</svg>
				) : shared === slug ? (
					"Shared"
				) : copied === slug ? (
					"Copied"
				) : discordSdk ? (
					"Share Link"
				) : (
					"Copy Link"
				)}
			</button>
			<span className="sr-only" role="status">
				{shared === slug
					? "Profile link shared"
					: copied === slug
						? "Profile link copied"
						: ""}
			</span>
			{fallback && (
				<span className={styles.fallback}>
					<span>Copy this link:</span>
					<input
						className="input"
						aria-label="Profile link to copy"
						value={
							new URL(`/u/${encodeURIComponent(slug)}`, fallback)
								.href
						}
						readOnly
						autoFocus
						onFocus={(event) => event.target.select()}
					/>
					<button
						className="quiet"
						type="button"
						onClick={() => setFallback("")}
					>
						Close
					</button>
				</span>
			)}
		</span>
	)
}

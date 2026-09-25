import { usePostHog } from "@posthog/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Link, NavLink, useSearchParams } from "react-router"
import { PlatformIcon } from "~/components/platform-icon"
import type { getConnectedAccounts } from "~/server/api/accounts"
import { authClient } from "~/lib/auth-client"
import { apiQueryOptions } from "~/lib/api-client"
import { getDiscordSdk } from "~/lib/discord-sdk"
import styles from "./accounts.module.css"

export function meta() {
	return [{ title: "Accounts | Game Spectrum" }]
}

const providers = ["steam", "discord", "twitch"] as const

export default function AccountsPage() {
	const posthog = usePostHog()
	const queryClient = useQueryClient()
	const [params] = useSearchParams()
	const [pending, setPending] = useState<string | null>(null)
	const [error, setError] = useState("")
	const [mergePrompt, setMergePrompt] = useState(
		[
			"ACCOUNT_ALREADY_LINKED_TO_DIFFERENT_USER",
			"STEAM_ACCOUNT_ALREADY_LINKED"
		].includes(params.get("error") ?? "")
	)
	const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
	const accounts = useQuery({
		...apiQueryOptions<{
			data: Awaited<ReturnType<typeof getConnectedAccounts>>
		}>(["accounts"], "accounts"),
		staleTime: 60_000
	})
	const passkeys = useQuery({
		queryKey: ["passkeys"],
		queryFn: async () => {
			const result = await authClient.passkey.listUserPasskeys()
			if (result.error)
				throw new Error(
					result.error.message || "Unable to load passkeys."
				)
			return result.data
		}
	})

	const connectProvider = async (provider: (typeof providers)[number]) => {
		const name =
			provider === "steam"
				? "Steam"
				: provider === "discord"
					? "Discord"
					: "Twitch"
		setError("")
		setPending(provider)
		try {
			const discordSdk = getDiscordSdk()
			if (discordSdk && provider === "discord") {
				const { code } = await discordSdk.commands.authorize({
					client_id: discordSdk.clientId,
					prompt: "none",
					response_type: "code",
					scope: ["identify", "email", "guilds"],
					state: ""
				})
				const response = await fetch(
					"/api/auth/activity-link-discord",
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						credentials: "same-origin",
						body: JSON.stringify({ code })
					}
				)
				if (response.status === 409) {
					setMergePrompt(true)
					return
				}
				if (!response.ok) throw new Error()
				await queryClient.invalidateQueries({ queryKey: ["accounts"] })
				return
			}

			if (discordSdk) {
				const response = await fetch(
					provider === "steam"
						? "/api/auth/steam/link"
						: "/api/auth/link-social",
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						credentials: "same-origin",
						body: JSON.stringify(
							provider === "steam"
								? {
										callbackURL: "/accounts",
										errorCallbackURL: "/accounts"
									}
								: {
										callbackURL: "/accounts",
										disableRedirect: true,
										errorCallbackURL: "/accounts",
										provider
									}
						)
					}
				)
				const result = (await response.json()) as { url?: string }
				if (!response.ok || !result.url) throw new Error()
				await discordSdk.commands.openExternalLink({ url: result.url })
				setError("Finish in browser.")
				return
			}

			const result =
				provider === "steam"
					? await authClient.steam.link({
							callbackURL: "/accounts",
							errorCallbackURL: "/accounts"
						})
					: await authClient.linkSocial({
							provider,
							callbackURL: "/accounts",
							errorCallbackURL: "/accounts"
						})
			if (result.error) {
				if (
					[
						"ACCOUNT_ALREADY_LINKED_TO_DIFFERENT_USER",
						"STEAM_ACCOUNT_ALREADY_LINKED"
					].includes(result.error.code ?? "")
				) {
					setMergePrompt(true)
					return
				}
				throw new Error(result.error.message)
			}
		} catch (failure) {
			setError(
				failure instanceof Error && failure.message
					? failure.message
					: `Unable to connect ${name}.`
			)
		} finally {
			setPending(null)
		}
	}

	return (
		<main id="main" className="page narrow">
			<div className="heading">
				<h1 className="title">Account</h1>
				<button
					className="quiet"
					disabled={!!pending}
					onClick={async () => {
						setPending("signout")
						setError("")
						try {
							const result = await authClient.signOut()
							if (result.error)
								throw new Error(
									result.error.message ||
										"Unable to sign out."
								)
							if (
								import.meta.env
									.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN &&
								import.meta.env.VITE_PUBLIC_POSTHOG_HOST
							)
								posthog.reset()
							queryClient.clear()
							window.location.assign("/")
						} catch (failure) {
							setError(
								failure instanceof Error
									? failure.message
									: "Unable to sign out."
							)
						} finally {
							setPending(null)
						}
					}}
				>
					Sign Out
				</button>
			</div>
			<nav className="tabs" aria-label="Account Settings">
				<NavLink to="/accounts" end>
					Connections
				</NavLink>
				<NavLink to="/accounts/profile">Profile</NavLink>
			</nav>
			{(error || (params.has("error") && !mergePrompt)) && (
				<p className="error" role="alert">
					{error || "Unable to connect account. Please try again."}
				</p>
			)}
			{mergePrompt && (
				<section className="section">
					<h2>Merge Accounts?</h2>
					<p>
						This platform is linked to another Game Spectrum
						account.
					</p>
					<div className="actions">
						<button
							className="secondary"
							onClick={async () => {
								const url =
									"https://www.gamespectrum.org/login?next=/accounts"
								const discordSdk = getDiscordSdk()
								if (discordSdk)
									await discordSdk.commands.openExternalLink({
										url
									})
								else window.location.assign(url)
							}}
						>
							Merge
						</button>
						<button
							className="quiet"
							onClick={() => setMergePrompt(false)}
						>
							Cancel
						</button>
					</div>
				</section>
			)}
			{accounts.error && (
				<p className="error" role="alert">
					{accounts.error.message}
				</p>
			)}
			{providers.map((provider) => {
				const linked = accounts.data?.data.find(
					(account) => account.providerId === provider
				)
				const name =
					provider === "steam"
						? "Steam"
						: provider === "discord"
							? "Discord"
							: "Twitch"
				return (
					<section className="row" key={provider}>
						<div className={styles.identity}>
							<PlatformIcon provider={provider} />
							<div>
								<h2>{name}</h2>
								{linked ? (
									<>
										{linked.details?.name && (
											<p>{linked.details.name}</p>
										)}
										<p>
											{linked.details?.email ||
												`${provider === "steam" ? "Steam ID" : "Account ID"}: ${linked.accountId}`}
										</p>
										{!linked.details && (
											<p>Profile details unavailable.</p>
										)}
									</>
								) : (
									<p>
										{accounts.isPending
											? "Loading…"
											: accounts.error
												? "Unavailable"
												: "Not connected"}
									</p>
								)}
							</div>
						</div>
						{!linked ? (
							<button
								className="secondary"
								disabled={
									!!pending ||
									accounts.isPending ||
									!!accounts.error
								}
								onClick={() => connectProvider(provider)}
							>
								{pending === provider
									? "Connecting…"
									: `Connect ${name}`}
							</button>
						) : provider === "steam" ? (
							<Link to="/import" className="secondary">
								Import Library
							</Link>
						) : null}
					</section>
				)
			})}
			<section className="section">
				<div className="heading">
					<h2>Passkeys</h2>
					<button
						className="secondary"
						disabled={!!pending}
						onClick={async () => {
							setError("")
							setPending("passkey")
							try {
								const result =
									await authClient.passkey.addPasskey()
								if (result?.error)
									throw new Error(
										result.error.message ||
											"Unable to add passkey."
									)
								await queryClient.invalidateQueries({
									queryKey: ["passkeys"]
								})
							} catch (failure) {
								setError(
									failure instanceof Error
										? failure.message
										: "Unable to add passkey."
								)
							} finally {
								setPending(null)
							}
						}}
					>
						Add Passkey
					</button>
				</div>
				{passkeys.error && (
					<p className="error" role="alert">
						{passkeys.error.message}
					</p>
				)}
				{passkeys.isPending ? (
					<p className="status">Loading…</p>
				) : passkeys.data?.length === 0 ? (
					<p className="status">No Passkeys.</p>
				) : (
					passkeys.data?.map((key) => (
						<div className="row" key={key.id}>
							<span>{key.name || "Passkey"}</span>
							<div className="actions">
								{confirmRemove === key.id ? (
									<>
										<button
											className="secondary"
											disabled={!!pending}
											onClick={async () => {
												setPending(key.id)
												setError("")
												try {
													const result =
														await authClient.passkey.deletePasskey(
															{ id: key.id }
														)
													if (result.error)
														throw new Error(
															result.error
																.message ||
																"Unable to remove passkey."
														)
													await queryClient.invalidateQueries(
														{
															queryKey: [
																"passkeys"
															]
														}
													)
													setConfirmRemove(null)
												} catch (failure) {
													setError(
														failure instanceof Error
															? failure.message
															: "Unable to remove passkey."
													)
												} finally {
													setPending(null)
												}
											}}
										>
											Confirm Removal
										</button>
										<button
											className="quiet"
											onClick={() =>
												setConfirmRemove(null)
											}
										>
											Cancel
										</button>
									</>
								) : (
									<button
										className="quiet"
										disabled={
											!accounts.data?.data.length &&
											(passkeys.data?.length ?? 0) < 2
										}
										onClick={() => setConfirmRemove(key.id)}
									>
										Remove
									</button>
								)}
							</div>
						</div>
					))
				)}
			</section>
		</main>
	)
}

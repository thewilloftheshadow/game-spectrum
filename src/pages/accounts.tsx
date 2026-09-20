import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Link, NavLink, useSearchParams } from "react-router"
import { PlatformIcon } from "~/components/platform-icon"
import type { getConnectedAccounts } from "~/server/api/accounts"
import { authClient } from "~/lib/auth-client"
import { apiQueryOptions } from "~/lib/api-client"
import styles from "./accounts.module.css"
import ui from "~/styles/ui.module.css"

export function meta() {
	return [{ title: "Accounts | Game Spectrum" }]
}

export default function AccountsPage() {
	const queryClient = useQueryClient()
	const [params] = useSearchParams()
	const [pending, setPending] = useState<string | null>(null)
	const [error, setError] = useState("")
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
	return (
		<main id="main" className={`${ui.page} ${ui.narrow}`}>
			<div className={ui.heading}>
				<h1 className={ui.title}>Account</h1>
				<button
					className={ui.quiet}
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
					Sign out
				</button>
			</div>
			<nav className={ui.tabs} aria-label="Account settings">
				<NavLink to="/accounts" end>
					Connections
				</NavLink>
				<NavLink to="/accounts/profile">Profile</NavLink>
			</nav>
			{(error || params.has("error")) && (
				<p className={ui.error} role="alert">
					{error || "Unable to connect account. Please try again."}
				</p>
			)}
			{accounts.error && (
				<p className={ui.error} role="alert">
					{accounts.error.message}
				</p>
			)}
			{(["steam", "discord", "twitch"] as const).map((provider) => {
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
					<section className={ui.row} key={provider}>
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
								className={ui.secondary}
								disabled={
									!!pending ||
									accounts.isPending ||
									!!accounts.error
								}
								onClick={async () => {
									setError("")
									setPending(provider)
									try {
										const result =
											provider === "steam"
												? await authClient.steam.link({
														callbackURL:
															"/accounts",
														errorCallbackURL:
															"/accounts"
													})
												: await authClient.linkSocial({
														provider,
														callbackURL:
															"/accounts",
														errorCallbackURL:
															"/accounts"
													})
										if (result.error)
											throw new Error(
												result.error.message ||
													`Unable to connect ${name}.`
											)
									} catch (failure) {
										setError(
											failure instanceof Error
												? failure.message
												: `Unable to connect ${name}.`
										)
									} finally {
										setPending(null)
									}
								}}
							>
								{pending === provider
									? "Connecting…"
									: `Connect ${name}`}
							</button>
						) : provider === "steam" ? (
							<Link to="/import" className={ui.secondary}>
								Import library
							</Link>
						) : null}
					</section>
				)
			})}
			<section className={ui.section}>
				<div className={ui.heading}>
					<h2>Passkeys</h2>
					<button
						className={ui.secondary}
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
						Add passkey
					</button>
				</div>
				{passkeys.error && (
					<p className={ui.error} role="alert">
						{passkeys.error.message}
					</p>
				)}
				{passkeys.isPending ? (
					<p className={ui.status}>Loading…</p>
				) : passkeys.data?.length === 0 ? (
					<p className={ui.status}>No passkeys.</p>
				) : (
					passkeys.data?.map((key) => (
						<div className={ui.row} key={key.id}>
							<span>{key.name || "Passkey"}</span>
							<div className={ui.actions}>
								{confirmRemove === key.id ? (
									<>
										<button
											className={ui.secondary}
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
											Confirm removal
										</button>
										<button
											className={ui.quiet}
											onClick={() =>
												setConfirmRemove(null)
											}
										>
											Cancel
										</button>
									</>
								) : (
									<button
										className={ui.quiet}
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

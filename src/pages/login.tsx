import { useState } from "react"
import { Link, Navigate, useSearchParams } from "react-router"
import { authClient } from "~/lib/auth-client"
import { PlatformIcon } from "~/components/platform-icon"
import ui from "~/styles/ui.module.css"
import styles from "./login.module.css"

export function meta() {
	return [{ title: "Sign in | Game Spectrum" }]
}

export default function LoginPage() {
	const { data: session } = authClient.useSession()
	const [params] = useSearchParams()
	const requested = params.get("next")
	const next =
		requested === "/accounts" ||
		requested === "/accounts/profile" ||
		requested === "/import"
			? requested
			: "/dashboard"
	const [pending, setPending] = useState<string | null>(null)
	const [error, setError] = useState("")
	if (session) return <Navigate to={next} replace />
	return (
		<main id="main" className={styles.page}>
			<div className={styles.art} aria-hidden="true" />
			<section className={styles.form}>
				<h1>Sign in</h1>
				<div className={styles.providers}>
					{(["steam", "discord", "twitch", "passkey"] as const).map(
						(provider) => (
							<button
								key={provider}
								disabled={pending !== null}
								onClick={async () => {
									setError("")
									setPending(provider)
									try {
										const result =
											provider === "steam"
												? await authClient.steam.login({
														callbackURL: "/import",
														errorCallbackURL:
															"/login"
													})
												: provider === "passkey"
													? await authClient.signIn.passkey()
													: await authClient.signIn.social(
															{
																provider,
																callbackURL:
																	next,
																errorCallbackURL:
																	"/login"
															}
														)
										if (result.error)
											throw new Error(
												result.error.message ||
													"Sign-in failed."
											)
										if (provider === "passkey")
											window.location.assign(next)
									} catch (failure) {
										setError(
											failure instanceof Error
												? failure.message
												: "Sign-in failed."
										)
									} finally {
										setPending(null)
									}
								}}
								aria-busy={pending === provider}
							>
								<PlatformIcon provider={provider} />
								<span>
									{provider === "passkey"
										? "Use a passkey"
										: `Continue with ${provider === "steam" ? "Steam" : provider === "discord" ? "Discord" : "Twitch"}`}
								</span>
								{pending === provider && (
									<span
										className={styles.pending}
										aria-hidden="true"
									>
										…
									</span>
								)}
							</button>
						)
					)}
				</div>
				{(error || params.has("error")) && (
					<p role="alert" className={ui.error}>
						{error || "Sign-in failed. Please try again."}
					</p>
				)}
				<Link className={styles.back} to="/">
					Back to home
				</Link>
			</section>
		</main>
	)
}

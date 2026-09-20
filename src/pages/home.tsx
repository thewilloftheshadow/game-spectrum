import { authClient } from "~/lib/auth-client"

export default function HomePage() {
	return (
		<main className="container">
			<section className="grid">
				<div>
					<p>Personal rankings, not review scores.</p>
					<h1>Turn your played games into your own Game Spectrum.</h1>
					<p>
						Rate mechanics, visuals, personality, audio, control,
						penalties, and bonuses. Import Steam, add missing games,
						then share a clean public page when it is ready.
					</p>
					<div role="group">
						<button
							type="button"
							onClick={() =>
								authClient.signIn.social({
									callbackURL: "/dashboard",
									provider: "discord"
								})
							}
						>
							Continue with Discord
						</button>
						<button
							className="secondary"
							type="button"
							onClick={() =>
								authClient.signIn.social({
									callbackURL: "/dashboard",
									provider: "twitch"
								})
							}
						>
							Continue with Twitch
						</button>
						<button
							className="contrast"
							type="button"
							onClick={() =>
								authClient.steam.login({
									callbackURL: "/dashboard"
								})
							}
						>
							Continue with Steam
						</button>
					</div>
					<button
						className="contrast"
						type="button"
						onClick={() => authClient.signIn.passkey({})}
					>
						Continue with passkey
					</button>
				</div>
				<article>
					<h2>Score model</h2>
					<ul>
						<li>100 points across five main categories.</li>
						<li>Up to 35 penalty points.</li>
						<li>
							Replayability bonus and up to a 1.1 extra
							multiplier.
						</li>
						<li>Incomplete games stay private/unrated.</li>
					</ul>
				</article>
			</section>
		</main>
	)
}

import styles from "./about.module.css"

export function meta() {
	return [{ title: "Terms & Privacy | Game Spectrum" }]
}

export default function TermsPage() {
	return (
		<main id="main" className="page narrow">
			<h1 className="title">Terms & Privacy</h1>
			<article className={styles.copy}>
				<p>Effective September 25, 2026.</p>

				<h2>Terms</h2>
				<p>
					Game Spectrum lets you track, rate, customize, and share
					your game list. Use it lawfully. Do not abuse the service,
					attack it, scrape it heavily, upload harmful files, or use
					it to harass people.
				</p>
				<p>
					You own the content you add. You give Game Spectrum
					permission to store and display it so the app can work,
					including public profile pages when you enable them.
				</p>
				<p>
					Game Spectrum is provided as-is. It may change, break, lose
					data, or go offline. We are not liable for losses from using
					it.
				</p>

				<h2>Privacy</h2>
				<p>
					We store account info needed to sign you in, connected
					platform IDs, profile details, game ratings, notes, prices,
					playtime, and uploaded images.
				</p>
				<p>
					If you make your profile public, your public name, avatar,
					bio, and visible completed ratings may be shown to anyone
					with the link.
				</p>
				<p>
					We use Discord, Steam, Twitch, IGDB, Cloudflare, and
					supported store APIs to run the app. We do not sell personal
					data.
				</p>
				<p>
					To delete your account or data, contact the site owner. Some
					cached or backup copies may take time to disappear.
				</p>
			</article>
		</main>
	)
}

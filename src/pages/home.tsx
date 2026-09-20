import { useState } from "react"
import { Link } from "react-router"
import { authClient } from "~/lib/auth-client"
import ui from "~/styles/ui.module.css"
import styles from "./home.module.css"

const games = [
	{ title: "Outer Wilds", image: "/art/outer-wilds.jpg" },
	{ title: "Disco Elysium", image: "/art/disco-elysium.jpg" },
	{ title: "Hollow Knight", image: "/art/hollow-knight.jpg" },
	{ title: "Celeste", image: "/art/celeste.jpg" }
]

export default function HomePage() {
	const [selected, setSelected] = useState(0)
	const { data: session } = authClient.useSession()
	return (
		<main id="main">
			<section className={styles.hero}>
				<img
					key={games[selected].image}
					className={styles.art}
					src={games[selected].image}
					alt={`${games[selected].title} artwork`}
					width={1300}
					height={419}
					fetchPriority="high"
				/>
				<div className={styles.content}>
					<h1>
						Game
						<br />
						Spectrum
					</h1>
					<Link
						className={ui.button}
						to={session ? "/dashboard" : "/login"}
					>
						{session ? "My library" : "Create a list"}
						<span aria-hidden="true">↗</span>
					</Link>
				</div>
				<span className={styles.caption}>{games[selected].title}</span>
			</section>
			<div
				className={styles.filmstrip}
				role="group"
				aria-label="Featured game artwork"
			>
				{games.map((game, index) => (
					<button
						key={game.title}
						aria-pressed={selected === index}
						onClick={() => setSelected(index)}
					>
						<img src={game.image} alt="" width={86} height={58} />
						<span>{game.title}</span>
					</button>
				))}
			</div>
			<footer className={styles.footer}>
				<Link to="/about">About Game Spectrum</Link>
			</footer>
		</main>
	)
}

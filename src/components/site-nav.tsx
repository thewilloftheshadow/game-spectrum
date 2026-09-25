import { NavLink, Link } from "react-router"
import { authClient } from "~/lib/auth-client"
import styles from "./site-nav.module.css"

export function SiteNav() {
	const { data: session, isPending } = authClient.useSession()
	return (
		<header className={styles.header}>
			<a className={styles.skip} href="#main">
				Skip To Content
			</a>
			<Link
				className={styles.brand}
				to="/"
				aria-label="Game Spectrum home"
			>
				Game<span>Spectrum</span>
			</Link>
			<nav className={styles.nav} aria-label="Main navigation">
				<NavLink to="/dashboard">My Library</NavLink>
				<NavLink to="/about">About</NavLink>
				<NavLink to="/terms">Terms</NavLink>
				{session ? (
					<NavLink to="/accounts" className={styles.account}>
						Account
					</NavLink>
				) : !isPending ? (
					<NavLink to="/login" className={styles.account}>
						Sign In
					</NavLink>
				) : (
					<span
						className={styles.placeholder}
						aria-label="Loading account"
					/>
				)}
			</nav>
		</header>
	)
}

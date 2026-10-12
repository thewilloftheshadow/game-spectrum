import { NavLink } from "react-router"
import styles from "~/pages/admin.module.css"

export function AdminNav({ active }: { active: "accounts" | "data" }) {
	return (
		<nav className={styles.nav} aria-label="Admin">
			<NavLink
				to="/admin"
				end
				aria-current={active === "accounts" ? "page" : undefined}
			>
				Accounts
			</NavLink>
			<NavLink
				to="/admin/data"
				aria-current={active === "data" ? "page" : undefined}
			>
				App data
			</NavLink>
		</nav>
	)
}

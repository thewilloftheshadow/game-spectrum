import { Navigate, Outlet, useLocation } from "react-router"
import { authClient } from "~/lib/auth-client"
import ui from "~/styles/ui.module.css"

export default function AccountLayout() {
	const { data: session, isPending, error } = authClient.useSession()
	const location = useLocation()
	if (isPending)
		return (
			<main
				id="main"
				className={ui.page}
				aria-busy="true"
				aria-label="Loading account"
			>
				<div className={ui.skeleton} />
			</main>
		)
	if (error)
		return (
			<main id="main" className={ui.page}>
				<p className={ui.error} role="alert">
					Unable to load your account.
				</p>
				<button
					className={ui.secondary}
					onClick={() => window.location.reload()}
				>
					Retry
				</button>
			</main>
		)
	if (!session)
		return (
			<Navigate
				to={`/login?next=${encodeURIComponent(location.pathname)}`}
				replace
			/>
		)
	return <Outlet />
}

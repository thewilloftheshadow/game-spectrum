import { Navigate, Outlet, useLocation } from "react-router"
import { authClient } from "~/lib/auth-client"

export default function AccountLayout() {
	const { data: session, isPending, error } = authClient.useSession()
	const location = useLocation()
	if (isPending)
		return (
			<main
				id="main"
				className="page"
				aria-busy="true"
				aria-label="Loading account"
			>
				<div className="skeleton" />
			</main>
		)
	if (error)
		return (
			<main id="main" className="page">
				<p className="error" role="alert">
					Unable to load your account.
				</p>
				<button
					className="secondary"
					onClick={() => window.location.reload()}
				>
					Retry
				</button>
			</main>
		)
	if (!session) {
		const params = new URLSearchParams(location.search)
		if (params.get("activity") === "1")
			return <Navigate to="/activity" replace />
		return (
			<Navigate
				to={`/login?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`}
				replace
			/>
		)
	}
	return <Outlet />
}

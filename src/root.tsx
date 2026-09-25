import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"
import {
	isRouteErrorResponse,
	Link,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useRouteError,
	useLocation
} from "react-router"
import { SiteNav } from "~/components/site-nav"
import "./globals.css"
import "./styles/primitives.css"

export function meta() {
	return [
		{ title: "Game Spectrum" },
		{ name: "description", content: "Personal game rankings." }
	]
}

export default function Root() {
	const [queryClient] = useState(() => new QueryClient())
	const { pathname, search } = useLocation()
	const params = new URLSearchParams(search)
	const activityLaunch =
		pathname === "/" &&
		(params.has("frame_id") || params.has("instance_id"))
	const navHidden =
		activityLaunch ||
		["/activity", "/dashboard"].includes(pathname.replace(/\/+$/, ""))
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta
					name="viewport"
					content="width=device-width, initial-scale=1"
				/>
				<Meta />
				<Links />
			</head>
			<body>
				<QueryClientProvider client={queryClient}>
					{!navHidden && <SiteNav />}
					<Outlet />
				</QueryClientProvider>
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	)
}

export function ErrorBoundary() {
	const error = useRouteError()
	const notFound = isRouteErrorResponse(error) && error.status === 404
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta
					name="viewport"
					content="width=device-width, initial-scale=1"
				/>
				<Meta />
				<Links />
			</head>
			<body>
				<main id="main" className="page">
					<h1 className="title">
						{notFound
							? "Page not found"
							: "Unable to load this page"}
					</h1>
					<Link to="/" className="secondary">
						Home
					</Link>
				</main>
				<Scripts />
			</body>
		</html>
	)
}

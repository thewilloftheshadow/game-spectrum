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
	useRouteError
} from "react-router"
import { SiteNav } from "~/components/site-nav"
import ui from "~/styles/ui.module.css"
import "./globals.css"

export function meta() {
	return [
		{ title: "Game Spectrum" },
		{ name: "description", content: "Personal game rankings." }
	]
}

export default function Root() {
	const [queryClient] = useState(() => new QueryClient())
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
					<SiteNav />
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
				<main id="main" className={ui.page}>
					<h1 className={ui.title}>
						{notFound
							? "Page not found"
							: "Unable to load this page"}
					</h1>
					<Link to="/" className={ui.secondary}>
						Home
					</Link>
				</main>
				<Scripts />
			</body>
		</html>
	)
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router"
import "./globals.scss"

export function meta() {
	return [
		{ title: "Game Spectrum" },
		{
			name: "description",
			content:
				"Personal game rankings powered by the Game Spectrum sheet."
		}
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
					<div className="site-shell">
						<nav className="container site-nav">
							<ul>
								<li>
									<strong>Game Spectrum</strong>
								</li>
							</ul>
							<ul>
								<li>
									<a href="/about">About</a>
								</li>
								<li>
									<a href="/dashboard">Dashboard</a>
								</li>
							</ul>
						</nav>
						<Outlet />
					</div>
				</QueryClientProvider>
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	)
}

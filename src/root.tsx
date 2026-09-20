import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router"
import "./globals.css"

export function meta() {
	return [
		{ title: "Buape Template" },
		{ name: "description", content: "A React Router template." }
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
					<Outlet />
				</QueryClientProvider>
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	)
}

import { index, route, type RouteConfig } from "@react-router/dev/routes"

export default [
	index("pages/home.tsx"),
	route("about", "pages/about.tsx"),
	route("dashboard", "pages/dashboard.tsx"),
	route("u/:slug", "pages/user-profile.tsx"),
	route("steam/:thing", "pages/steam-profile.tsx")
] satisfies RouteConfig

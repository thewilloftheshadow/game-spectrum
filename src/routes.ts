import {
	index,
	layout,
	route,
	type RouteConfig
} from "@react-router/dev/routes"

export default [
	index("pages/home.tsx"),
	route("login", "pages/login.tsx"),
	route("about", "pages/about.tsx"),
	layout("pages/account-layout.tsx", [
		route("dashboard", "pages/dashboard.tsx"),
		route("import", "pages/import.tsx"),
		route("accounts", "pages/accounts.tsx"),
		route("accounts/profile", "pages/profile-settings.tsx")
	]),
	route("u/:slug", "pages/user-profile.tsx"),
	route("steam/:thing", "pages/steam-profile.tsx")
] satisfies RouteConfig

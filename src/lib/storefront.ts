export function getStorefront(value: string | null | undefined) {
	if (!value || value.length > 1000) return null
	let url: URL
	try {
		url = new URL(value.trim())
	} catch {
		return null
	}
	if (
		!["https:", "http:"].includes(url.protocol) ||
		url.username ||
		url.password ||
		url.port
	)
		return null
	if (url.hostname === "store.steampowered.com") {
		const id = url.pathname.match(/^\/app\/([1-9]\d{0,9})(?:\/|$)/)?.[1]
		if (id)
			return {
				provider: "steam" as const,
				label: "Steam",
				id,
				url: `https://store.steampowered.com/app/${id}/`
			}
	}
	if (["www.gog.com", "gog.com"].includes(url.hostname)) {
		const id = url.pathname
			.match(/^\/(?:[a-z]{2}\/)?game\/([a-z0-9_]+)\/?$/i)?.[1]
			.toLowerCase()
		if (id)
			return {
				provider: "gog" as const,
				label: "GOG",
				id,
				url: `https://www.gog.com/en/game/${id}`
			}
	}
	if (url.hostname === "store.epicgames.com") {
		const id = url.pathname
			.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?p\/([a-z0-9_-]+)\/?$/i)?.[1]
			.toLowerCase()
		if (id)
			return {
				provider: "epic" as const,
				label: "Epic",
				id,
				url: `https://store.epicgames.com/en-US/p/${id}`
			}
	}
	if (["apps.apple.com", "itunes.apple.com"].includes(url.hostname)) {
		const id = url.pathname.match(
			/^\/(?:[a-z]{2}\/)?app\/(?:[^/]+\/)?id([1-9]\d{0,14})\/?$/i
		)?.[1]
		if (id)
			return {
				provider: "apple" as const,
				label: "App Store",
				id,
				url: `https://apps.apple.com/us/app/id${id}`
			}
	}
	if (
		url.hostname === "play.google.com" &&
		/^\/store\/apps\/details(?:\/[^/]+)?\/?$/.test(url.pathname)
	) {
		const id = url.searchParams.get("id")
		if (id && /^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+$/.test(id))
			return {
				provider: "google" as const,
				label: "Google Play",
				id,
				url: `https://play.google.com/store/apps/details?id=${encodeURIComponent(id)}&hl=en_US&gl=US`
			}
	}
	return null
}

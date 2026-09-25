import type { AnchorHTMLAttributes, MouseEvent } from "react"
import { getDiscordSdk } from "~/lib/discord-sdk"

export function Link({
	href,
	onClick,
	rel,
	target,
	...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
	const handleClick = async (event: MouseEvent<HTMLAnchorElement>) => {
		onClick?.(event)

		if (
			event.defaultPrevented ||
			event.button !== 0 ||
			event.metaKey ||
			event.altKey ||
			event.ctrlKey ||
			event.shiftKey ||
			!href ||
			!["http:", "https:"].includes(event.currentTarget.protocol)
		) {
			return
		}

		const discordSdk = getDiscordSdk()
		if (!discordSdk) return

		event.preventDefault()

		try {
			await discordSdk.commands.openExternalLink({
				url: event.currentTarget.href
			})
		} catch {
			window.open(
				event.currentTarget.href,
				"_blank",
				"noopener,noreferrer"
			)
		}
	}

	return (
		<a
			href={href}
			target={target}
			rel={target === "_blank" ? (rel ?? "noreferrer") : rel}
			onClick={handleClick}
			{...props}
		/>
	)
}

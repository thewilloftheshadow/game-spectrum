import type { ImgHTMLAttributes } from "react"

export function Image({
	fallbackSrc,
	onError,
	src,
	...props
}: ImgHTMLAttributes<HTMLImageElement> & { fallbackSrc?: string | null }) {
	const imageSrc =
		typeof src === "string" && src.startsWith("https://")
			? `/api/media?url=${encodeURIComponent(src)}`
			: src
	const fallback =
		typeof fallbackSrc === "string" && fallbackSrc.startsWith("https://")
			? `/api/media?url=${encodeURIComponent(fallbackSrc)}`
			: (fallbackSrc ?? undefined)

	return (
		<img
			{...props}
			src={imageSrc}
			data-fallback-src={fallback || undefined}
			onError={(event) => {
				onError?.(event)
				if (event.isDefaultPrevented()) return
				const next = event.currentTarget.dataset.fallbackSrc
				if (next && event.currentTarget.getAttribute("src") !== next) {
					event.currentTarget.src = next
					delete event.currentTarget.dataset.fallbackSrc
				} else {
					event.currentTarget.hidden = true
				}
			}}
		/>
	)
}

import { useState } from "react"
import styles from "./copy-profile-link.module.css"

export function CopyProfileLink({
	slug,
	compact = false
}: {
	slug: string
	compact?: boolean
}) {
	const [copied, setCopied] = useState("")
	const [fallback, setFallback] = useState("")
	return (
		<span className={styles.copy}>
			<button
				type="button"
				className="secondary"
				title="Copy profile link"
				aria-label="Copy profile link"
				onClick={async () => {
					const url = new URL(
						`/u/${encodeURIComponent(slug)}`,
						window.location.origin
					).href
					try {
						await navigator.clipboard.writeText(url)
						setCopied(slug)
						setFallback("")
					} catch {
						setCopied("")
						setFallback(url)
					}
				}}
			>
				{compact ? (
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.4"
						aria-hidden="true"
					>
						<path
							d={
								copied === slug
									? "m3 8 3 3 7-7"
									: "M6 5h7v9H6zM10 5V2H3v9h3"
							}
						/>
					</svg>
				) : copied === slug ? (
					"Copied"
				) : (
					"Copy link"
				)}
			</button>
			<span className="sr-only" role="status">
				{copied === slug ? "Profile link copied" : ""}
			</span>
			{fallback && (
				<span className={styles.fallback}>
					<span>Copy this link:</span>
					<input
						className="input"
						aria-label="Profile link to copy"
						value={
							new URL(`/u/${encodeURIComponent(slug)}`, fallback)
								.href
						}
						readOnly
						autoFocus
						onFocus={(event) => event.target.select()}
					/>
					<button
						className="quiet"
						type="button"
						onClick={() => setFallback("")}
					>
						Close
					</button>
				</span>
			)}
		</span>
	)
}

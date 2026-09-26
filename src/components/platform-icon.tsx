import styles from "./platform-icon.module.css"

export function PlatformIcon({
	provider
}: {
	provider: "steam" | "discord" | "twitch" | "passkey" | "epic" | "gog"
}) {
	if (provider === "passkey")
		return (
			<svg
				className={styles.icon}
				width="22"
				height="22"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.7"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<circle cx="8" cy="8" r="5" />
				<path d="m11.5 11.5 9 9M17 17l3-3m-6 0 3-3" />
			</svg>
		)
	return (
		<img
			className={`${styles.icon} ${styles.brand}`}
			src={`/icons/${provider}.svg`}
			width={22}
			height={22}
			alt=""
			aria-hidden="true"
		/>
	)
}

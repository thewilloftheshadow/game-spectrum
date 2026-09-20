import { useQuery } from "@tanstack/react-query"
import { useParams } from "react-router"
import { SpectrumTable } from "~/components/spectrum-table"
import { apiQueryOptions } from "~/lib/api-client"
import type { publicProfile } from "~/server/api/public"
import ui from "~/styles/ui.module.css"
import styles from "./public-profile.module.css"

export default function PublicProfilePage({
	source
}: {
	source: "u" | "steam"
}) {
	const params = useParams()
	const id = source === "u" ? params.slug : params.thing
	const profile = useQuery(
		apiQueryOptions<{
			data: NonNullable<Awaited<ReturnType<typeof publicProfile>>>
		}>(
			["public", source, id],
			`public/${source}/${encodeURIComponent(id ?? "")}`
		)
	)
	if (profile.isPending)
		return (
			<main
				id="main"
				className={ui.page}
				aria-busy="true"
				aria-label="Loading profile"
			>
				<div className={ui.skeleton} />
			</main>
		)
	if (profile.error || !profile.data)
		return (
			<main id="main" className={ui.page}>
				<h1 className={ui.title}>Profile unavailable</h1>
			</main>
		)
	const { data } = profile.data
	const ranks = Object.fromEntries(
		data.entries.map((entry, index) => [entry.id, index + 1])
	)
	return (
		<main id="main" className={ui.page}>
			<header className={styles.profile}>
				{data.owner.image && (
					<img src={data.owner.image} alt="" width={64} height={64} />
				)}
				<div>
					<h1 className={ui.title}>{data.profile.displayName}</h1>
					{data.profile.bio && (
						<p className={styles.bio}>{data.profile.bio}</p>
					)}
					{JSON.parse(data.profile.favoriteGenres).length > 0 && (
						<p className={styles.genres}>
							{(
								JSON.parse(
									data.profile.favoriteGenres
								) as string[]
							).join(" / ")}
						</p>
					)}
				</div>
			</header>
			{data.entries.length ? (
				<SpectrumTable entries={data.entries} ranks={ranks} />
			) : (
				<p className={ui.empty}>No rated games.</p>
			)}
		</main>
	)
}

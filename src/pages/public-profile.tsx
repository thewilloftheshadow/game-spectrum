import { useQuery } from "@tanstack/react-query"
import { Link, useParams } from "react-router"
import { useState } from "react"
import { CopyProfileLink } from "~/components/copy-profile-link"
import { authClient } from "~/lib/auth-client"
import { myProfileQuery } from "~/lib/profile"
import { SpectrumTable } from "~/components/spectrum-table"
import { apiQueryOptions } from "~/lib/api-client"
import type { publicProfile } from "~/server/api/public"
import styles from "./public-profile.module.css"

export default function PublicProfilePage({
	source
}: {
	source: "u" | "steam"
}) {
	const params = useParams()
	const { data: session } = authClient.useSession()
	const me = useQuery({ ...myProfileQuery, enabled: !!session })
	const [find, setFind] = useState("")
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
				className="page"
				aria-busy="true"
				aria-label="Loading profile"
			>
				<div className="skeleton" />
			</main>
		)
	if (profile.error || !profile.data)
		return (
			<main id="main" className="page">
				<h1 className="title">Profile unavailable</h1>
			</main>
		)
	const { data } = profile.data
	const owner = !!session && me.data?.data.profile?.slug === data.profile.slug
	const genres = JSON.parse(data.profile.favoriteGenres) as string[]
	const avatar = data.profile.avatarUrl ?? data.owner.image
	const filtered = data.entries.filter((entry) =>
		entry.title.toLowerCase().includes(find.toLowerCase())
	)
	const ranks = Object.fromEntries(
		data.entries.map((entry, index) => [entry.id, index + 1])
	)
	return (
		<main id="main" className={styles.page}>
			<header className={styles.profile}>
				{avatar && <img src={avatar} alt="" width={56} height={56} />}
				<div className={styles.identity}>
					<h1>{data.profile.displayName}</h1>
					<p className={styles.count}>
						{data.entries.length} rated{" "}
						{data.entries.length === 1 ? "game" : "games"}
					</p>
					{data.profile.bio && (
						<p className={styles.bio}>{data.profile.bio}</p>
					)}
					{genres.length > 0 && (
						<p className={styles.genres}>{genres.join(" / ")}</p>
					)}
				</div>
				<div className={styles.actions}>
					<CopyProfileLink slug={data.profile.slug} />
					{owner && (
						<Link className="quiet" to="/accounts/profile">
							Edit profile
						</Link>
					)}
				</div>
			</header>
			{data.entries.length ? (
				<>
					<div className={styles.tools}>
						<label>
							<span className="sr-only">Search rated games</span>
							<input
								className="input"
								type="search"
								placeholder="Search rated games"
								value={find}
								onChange={(event) =>
									setFind(event.target.value)
								}
							/>
						</label>
						{owner && (
							<Link className="quiet" to="/dashboard">
								Edit ratings
							</Link>
						)}
					</div>
					{filtered.length ? (
						<SpectrumTable
							entries={data.entries}
							visibleEntries={filtered}
							ranks={ranks}
						/>
					) : (
						<p className={styles.empty}>No matching games.</p>
					)}
				</>
			) : (
				<div className={styles.empty}>
					<p>No completed ratings to share yet.</p>
					{owner && (
						<Link className="secondary" to="/dashboard">
							Rate your games
						</Link>
					)}
				</div>
			)}
		</main>
	)
}

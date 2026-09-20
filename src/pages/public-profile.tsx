import { useQuery } from "@tanstack/react-query"
import { useParams } from "react-router"
import { apiClient } from "~/lib/api-client"

type PublicEntry = {
	id: string
	title: string
	coverUrl?: string | null
	score: number
}

type PublicProfile = {
	profile: {
		bio: string
		displayName: string
		slug: string
		steamVanity?: string | null
	}
	owner: {
		image?: string | null
		steamId?: string | null
	}
	entries: PublicEntry[]
}

export default function PublicProfilePage({
	source
}: {
	source: "u" | "steam"
}) {
	const params = useParams()
	const id = source === "u" ? params.slug : params.thing
	const profile = useQuery({
		queryKey: ["public", source, id],
		queryFn: () =>
			apiClient<{ data: PublicProfile }>(`public/${source}/${id}`)
	})

	if (profile.isLoading) {
		return (
			<main className="container">
				<p aria-busy="true">Loading spectrum…</p>
			</main>
		)
	}

	if (profile.error || !profile.data) {
		return (
			<main className="container">
				<h1>404</h1>
				<p>This Game Spectrum is private or does not exist.</p>
			</main>
		)
	}

	const data = profile.data.data

	return (
		<main className="container">
			<header>
				{data.owner.image && (
					<img alt="" className="cover" src={data.owner.image} />
				)}
				<p>Game Spectrum</p>
				<h1>{data.profile.displayName}</h1>
				{data.profile.bio && <p>{data.profile.bio}</p>}
			</header>
			{data.entries.length === 0 && (
				<article>
					<p>No rated public games yet.</p>
				</article>
			)}
			{data.entries.map((entry, index) => (
				<article className="game-card" key={entry.id}>
					{entry.coverUrl ? (
						<img alt="" src={entry.coverUrl} />
					) : (
						<span className="cover" />
					)}
					<div>
						<p>#{index + 1}</p>
						<h2>{entry.title}</h2>
						<strong className="score-pill">{entry.score}</strong>
					</div>
				</article>
			))}
		</main>
	)
}

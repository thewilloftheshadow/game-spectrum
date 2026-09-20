import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { Link } from "react-router"
import { SpectrumTable, type SpectrumGame } from "~/components/spectrum-table"
import { apiJson, apiQueryOptions } from "~/lib/api-client"
import type { gamePayload } from "~/server/api/context"
import type { z } from "zod"
import ui from "~/styles/ui.module.css"
import styles from "./dashboard.module.css"

export function meta() {
	return [{ title: "My library | Game Spectrum" }]
}

export default function DashboardPage() {
	const queryClient = useQueryClient()
	const [query, setQuery] = useState("")
	const [searchTerm, setSearchTerm] = useState("")
	const [filter, setFilter] = useState("All")
	const [adding, setAdding] = useState(false)
	const [find, setFind] = useState("")
	useEffect(() => {
		const timer = setTimeout(() => setSearchTerm(query.trim()), 250)
		return () => clearTimeout(timer)
	}, [query])
	const entries = useQuery({
		...apiQueryOptions<{ data: SpectrumGame[] }>(["entries"], "entries"),
		refetchOnWindowFocus: false
	})
	const search = useQuery({
		...apiQueryOptions<{ data: z.infer<typeof gamePayload>[] }>(
			["game-search", searchTerm],
			`games/search?q=${encodeURIComponent(searchTerm)}`
		),
		enabled: adding && searchTerm.length >= 2,
		staleTime: 60_000,
		retry: false
	})
	const add = useMutation({
		mutationFn: (game: z.infer<typeof gamePayload>) =>
			apiJson("entries", game),
		onSuccess: async () => {
			setQuery("")
			setFilter("All")
			setFind("")
			await queryClient.invalidateQueries({ queryKey: ["entries"] })
		}
	})
	const all = entries.data?.data ?? []
	const ranked = all
		.filter((entry) => entry.score !== null && !entry.hidden)
		.sort((a, b) => b.score! - a.score!)
	const ranks = Object.fromEntries(
		ranked.map((entry, index) => [entry.id, index + 1])
	)
	const filtered = all.filter(
		(entry) =>
			entry.title.toLowerCase().includes(find.toLowerCase()) &&
			(filter === "All" ||
				(filter === "Rated" && entry.score !== null && !entry.hidden) ||
				(filter === "Unrated" && entry.score === null) ||
				(filter === "Hidden" && entry.hidden))
	)
	return (
		<main id="main" className={ui.page}>
			<div className={ui.heading}>
				<h1 className={ui.title}>My library</h1>
				<div className={ui.actions}>
					<Link to="/import" className={ui.secondary}>
						Import Steam library
					</Link>
					<button
						className={ui.button}
						aria-expanded={adding}
						aria-controls="add-games"
						onClick={() => setAdding(!adding)}
					>
						{adding ? "Close search" : "Add game"}
					</button>
				</div>
			</div>
			{adding && (
				<section
					id="add-games"
					className={styles.add}
					aria-label="Add game"
				>
					<label className={ui.field}>
						Find a game
						<input
							className={ui.input}
							type="search"
							autoFocus
							value={query}
							onChange={(event) => setQuery(event.target.value)}
						/>
					</label>
					{search.isFetching && (
						<p className={ui.status} role="status">
							Searching…
						</p>
					)}
					{search.error && (
						<p className={ui.error} role="alert">
							Search unavailable. You can still add a game
							manually.
						</p>
					)}
					{searchTerm === query.trim() &&
						search.data?.data
							.filter((game) => game.source !== "manual")
							.map((game) => (
								<div
									className={styles.result}
									key={`${game.source}-${game.steamAppId ?? game.igdbId}`}
								>
									{game.coverUrl ? (
										<img
											src={game.coverUrl}
											alt=""
											width={70}
											height={42}
										/>
									) : (
										<span />
									)}
									<div>
										<strong>{game.title}</strong>
										<span>
											{game.source === "steam"
												? "Steam"
												: "IGDB"}
											{game.releaseYear
												? ` / ${game.releaseYear}`
												: ""}
										</span>
									</div>
									<button
										className={ui.secondary}
										disabled={add.isPending}
										onClick={() => add.mutate(game)}
										aria-label={`Add ${game.title}`}
									>
										Add
									</button>
								</div>
							))}
					{query.trim() && (
						<div className={styles.manual}>
							<span>{query.trim()}</span>
							<button
								className={ui.secondary}
								disabled={add.isPending}
								onClick={() =>
									add.mutate({
										title: query.trim(),
										source: "manual"
									})
								}
							>
								Add manually
							</button>
						</div>
					)}
					{add.error && (
						<p className={ui.error} role="alert">
							{add.error.message}
						</p>
					)}
				</section>
			)}
			<div className={styles.toolbar}>
				<div
					className={styles.filters}
					role="group"
					aria-label="Library filter"
				>
					{["All", "Rated", "Unrated", "Hidden"].map((value) => (
						<button
							key={value}
							aria-pressed={filter === value}
							onClick={() => setFilter(value)}
						>
							{value}
						</button>
					))}
				</div>
				<label className={styles.find}>
					<span className={ui.srOnly}>Search library</span>
					<input
						className={ui.input}
						type="search"
						placeholder="Search library"
						value={find}
						onChange={(event) => setFind(event.target.value)}
					/>
				</label>
			</div>
			{entries.isPending ? (
				<div
					className={ui.skeleton}
					aria-busy="true"
					aria-label="Loading library"
				/>
			) : entries.error ? (
				<div>
					<p className={ui.error} role="alert">
						Unable to load your library.
					</p>
					<button
						className={ui.secondary}
						onClick={() => entries.refetch()}
					>
						Retry
					</button>
				</div>
			) : filtered.length ? (
				<SpectrumTable entries={filtered} editable ranks={ranks} />
			) : (
				<p className={ui.empty}>
					{all.length ? "No matching games." : "No games yet."}
				</p>
			)}
		</main>
	)
}

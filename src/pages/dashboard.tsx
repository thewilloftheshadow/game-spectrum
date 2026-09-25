import { usePostHog } from "@posthog/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { Link } from "react-router"
import { CopyProfileLink } from "~/components/copy-profile-link"
import { Image } from "~/components/image"
import { SpectrumTable, type SpectrumGame } from "~/components/spectrum-table"
import { posthogLogger } from "~/lib/posthog-logger"
import { myProfileQuery } from "~/lib/profile"
import { getStorefront } from "~/lib/storefront"
import type { syncSteamPlaytime } from "~/server/steam"
import { apiJson, apiQueryOptions } from "~/lib/api-client"
import type { gamePayload } from "~/server/api/context"
import type { z } from "zod"
import styles from "./dashboard.module.css"

export function meta() {
	return [{ title: "My Library | Game Spectrum" }]
}

export default function DashboardPage() {
	const posthog = usePostHog()
	const queryClient = useQueryClient()
	const toolbarRef = useRef<HTMLElement>(null)
	const [query, setQuery] = useState("")
	const [searchTerm, setSearchTerm] = useState("")
	const [filter, setFilter] = useState("All")
	const [adding, setAdding] = useState(false)
	const [find, setFind] = useState("")
	useEffect(() => {
		const toolbar = toolbarRef.current
		const page = toolbar?.closest("main")
		if (!toolbar || !page) return
		const observer = new ResizeObserver(() => {
			page.style.setProperty(
				"--spectrum-viewport-width",
				`${document.documentElement.clientWidth}px`
			)
			page.style.setProperty(
				"--spectrum-toolbar-height",
				`${toolbar.getBoundingClientRect().height}px`
			)
		})
		observer.observe(toolbar)
		observer.observe(document.documentElement)
		return () => observer.disconnect()
	}, [])
	useEffect(() => {
		const timer = setTimeout(() => setSearchTerm(query.trim()), 250)
		return () => clearTimeout(timer)
	}, [query])
	const entries = useQuery({
		...apiQueryOptions<{ data: SpectrumGame[] }>(["entries"], "entries"),
		refetchOnWindowFocus: false
	})
	const me = useQuery(myProfileQuery)
	const sync = useMutation({
		mutationFn: () =>
			apiJson<{ data: Awaited<ReturnType<typeof syncSteamPlaytime>> }>(
				"steam/playtime/sync",
				{}
			),
		onSuccess: (result) => {
			if (
				import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN &&
				import.meta.env.VITE_PUBLIC_POSTHOG_HOST
			)
				posthog.capture("steam_playtime_synced", {
					games_updated: result.data.updated
				})
			return Promise.all([
				queryClient.invalidateQueries({ queryKey: ["entries"] }),
				queryClient.invalidateQueries({ queryKey: ["me"] }),
				queryClient.invalidateQueries({ queryKey: ["public"] })
			])
		}
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
		onSuccess: async (_, game) => {
			if (
				import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN &&
				import.meta.env.VITE_PUBLIC_POSTHOG_HOST
			)
				posthog.capture("game_added", { source: game.source })
			posthogLogger.info("game added to library", { source: game.source })
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
		<main id="main" className={styles.page}>
			<h1 className="sr-only">My Library</h1>
			<SpectrumTable
				entries={all}
				visibleEntries={filtered}
				editable
				ranks={ranks}
				className={styles.sheet}
				toolbar={(saveButton) => (
					<header
						ref={toolbarRef}
						className={styles.toolbar}
						aria-label="Library Controls"
					>
						<label className={styles.find}>
							<span className="sr-only">Search Library</span>
							<input
								className="input"
								type="search"
								placeholder="Search Library"
								value={find}
								onChange={(event) =>
									setFind(event.target.value)
								}
							/>
						</label>
						<label className={styles.filter}>
							<span className="sr-only">Library Filter</span>
							<select
								className="select"
								value={filter}
								onChange={(event) =>
									setFilter(event.target.value)
								}
							>
								{["All", "Rated", "Unrated", "Hidden"].map(
									(value) => (
										<option key={value} value={value}>
											{value}
										</option>
									)
								)}
							</select>
						</label>
						<div className={styles.actions}>
							<Link to="/import" className="secondary">
								Import
							</Link>
							<button
								className="secondary"
								type="button"
								aria-expanded={adding}
								aria-controls="add-games"
								onClick={() => setAdding(!adding)}
							>
								{adding ? "Close Search" : "Add Game"}
							</button>
							{me.data?.data.user.steamId && (
								<button
									className="secondary"
									type="button"
									disabled={sync.isPending}
									aria-label="Sync Steam Playtime"
									title={`Updates automatically every 48 hours. Last synced: ${me.data.data.profile?.playtimeSyncedAt ? new Date(String(me.data.data.profile.playtimeSyncedAt)).toLocaleString() : "never"}`}
									onClick={() => sync.mutate()}
								>
									{sync.isPending
										? "Syncing…"
										: sync.isSuccess
											? "Synced"
											: "Sync Playtime"}
								</button>
							)}
							<Link to="/accounts/profile" className="quiet">
								Settings
							</Link>
							{me.data?.data.profile?.isPublic && (
								<CopyProfileLink
									slug={me.data.data.profile.slug}
									compact
								/>
							)}
							{saveButton}
						</div>
					</header>
				)}
			>
				{sync.error && (
					<div className={styles.status}>
						<p className="error" role="alert">
							{sync.error.message}
						</p>
					</div>
				)}
				{sync.isSuccess && (
					<span className="sr-only" role="status">
						Playtime synced for {sync.data.data.updated} games.
					</span>
				)}
				{adding && (
					<section
						id="add-games"
						className={styles.add}
						aria-label="Add Game"
					>
						<label className="field">
							Find A Game
							<input
								className="input"
								type="search"
								autoFocus
								value={query}
								onChange={(event) =>
									setQuery(event.target.value)
								}
							/>
						</label>
						{search.isFetching && (
							<p className="status" role="status">
								Searching…
							</p>
						)}
						{search.error && (
							<p className="error" role="alert">
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
											<Image
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
													: (getStorefront(
															game.storeUrl
														)?.label ?? "IGDB")}
												{game.releaseYear
													? ` / ${game.releaseYear}`
													: ""}
											</span>
										</div>
										<button
											className="secondary"
											type="button"
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
									className="secondary"
									type="button"
									disabled={add.isPending}
									onClick={() =>
										add.mutate({
											title: query.trim(),
											source: "manual"
										})
									}
								>
									Add Manually
								</button>
							</div>
						)}
						{add.error && (
							<p className="error" role="alert">
								{add.error.message}
							</p>
						)}
					</section>
				)}
				{entries.isPending ? (
					<p className={styles.status} role="status">
						Loading Library…
					</p>
				) : entries.error ? (
					<div className={styles.status}>
						<p className="error" role="alert">
							Unable to load your library.
						</p>
						<button
							className="secondary"
							onClick={() => entries.refetch()}
						>
							Retry
						</button>
					</div>
				) : !filtered.length ? (
					<p className={styles.status}>
						{all.length ? "No matching games." : "No games yet."}
					</p>
				) : null}
			</SpectrumTable>
		</main>
	)
}

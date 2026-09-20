import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type FormEvent, useState } from "react"
import { apiClient, apiJson } from "~/lib/api-client"
import { authClient } from "~/lib/auth-client"
import { ratingFields } from "~/lib/scoring"

type GameResult = {
	title: string
	source: "steam" | "igdb" | "manual"
	steamAppId?: number
	igdbId?: number
	coverUrl?: string | null
	releaseYear?: number | null
}

type Entry = Record<string, unknown> & {
	id: string
	title: string
	coverUrl?: string | null
	hidden: boolean
	score: number | null
}

export default function DashboardPage() {
	const queryClient = useQueryClient()
	const session = authClient.useSession()
	const [query, setQuery] = useState("")
	const [profile, setProfile] = useState({
		bio: "",
		displayName: "",
		isPublic: false,
		slug: "",
		steamVanity: ""
	})

	const me = useQuery({
		queryKey: ["me"],
		queryFn: () => apiClient<{ data: { profile: typeof profile } }>("me")
	})
	const entries = useQuery({
		queryKey: ["entries"],
		queryFn: () => apiClient<{ data: Entry[] }>("entries")
	})
	const search = useQuery({
		enabled: query.trim().length > 1,
		queryKey: ["game-search", query],
		queryFn: () =>
			apiClient<{ data: GameResult[] }>(
				`games/search?q=${encodeURIComponent(query)}`
			)
	})

	const currentProfile = me.data?.data.profile ?? profile
	const addGame = useMutation({
		mutationFn: (game: GameResult) => apiJson("entries", game),
		onSuccess: () => {
			setQuery("")
			queryClient.invalidateQueries({ queryKey: ["entries"] })
		}
	})
	const updateProfile = useMutation({
		mutationFn: (event: FormEvent<HTMLFormElement>) => {
			event.preventDefault()
			return apiJson(
				"profile",
				{
					bio: profile.bio || currentProfile.bio,
					displayName:
						profile.displayName || currentProfile.displayName,
					isPublic: profile.isPublic,
					slug: profile.slug || currentProfile.slug,
					steamVanity: profile.steamVanity || null
				},
				{ method: "PATCH" }
			)
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] })
	})
	const importSteam = useMutation({
		mutationFn: () => apiJson("steam/import", {}),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["entries"] })
	})

	if (session.isPending || me.isLoading) {
		return (
			<main className="container">
				<p aria-busy="true">Loading your spectrum…</p>
			</main>
		)
	}

	if (!session.data) {
		return (
			<main className="container">
				<h1>Sign in required</h1>
				<p>
					Use Discord, Steam, or a passkey before editing your list.
				</p>
				<a href="/" role="button">
					Go sign in
				</a>
			</main>
		)
	}

	return (
		<main className="container">
			<header>
				<p>Dashboard</p>
				<h1>Your Game Spectrum</h1>
			</header>

			<section className="grid">
				<article>
					<h2>Profile</h2>
					<form onSubmit={(event) => updateProfile.mutate(event)}>
						<label>
							Display name
							<input
								defaultValue={currentProfile.displayName}
								onChange={(event) =>
									setProfile({
										...profile,
										displayName: event.target.value
									})
								}
							/>
						</label>
						<label>
							Custom slug
							<input
								defaultValue={currentProfile.slug}
								onChange={(event) =>
									setProfile({
										...profile,
										slug: event.target.value
									})
								}
							/>
						</label>
						<label>
							Steam vanity
							<input
								defaultValue={currentProfile.steamVanity ?? ""}
								onChange={(event) =>
									setProfile({
										...profile,
										steamVanity: event.target.value
									})
								}
							/>
						</label>
						<label>
							Bio
							<textarea
								defaultValue={currentProfile.bio}
								onChange={(event) =>
									setProfile({
										...profile,
										bio: event.target.value
									})
								}
							/>
						</label>
						<label>
							<input
								defaultChecked={currentProfile.isPublic}
								type="checkbox"
								onChange={(event) =>
									setProfile({
										...profile,
										isPublic: event.target.checked
									})
								}
							/>{" "}
							Public page
						</label>
						<button type="submit">Save profile</button>
					</form>
					<p>
						Public URLs: <code>/u/{currentProfile.slug}</code> and{" "}
						<code>
							/steam/
							{currentProfile.steamVanity || "your-steam-id"}
						</code>
					</p>
				</article>

				<article>
					<h2>Accounts</h2>
					<div role="group">
						<button
							type="button"
							onClick={() =>
								authClient.signIn.social({
									callbackURL: "/dashboard",
									provider: "discord"
								})
							}
						>
							Add Discord
						</button>
						<button
							className="secondary"
							type="button"
							onClick={() =>
								authClient.signIn.social({
									callbackURL: "/dashboard",
									provider: "twitch"
								})
							}
						>
							Add Twitch
						</button>
						<button
							className="contrast"
							type="button"
							onClick={() =>
								authClient.steam.link({
									callbackURL: "/dashboard"
								})
							}
						>
							Link Steam
						</button>
					</div>
					<div role="group">
						<button
							type="button"
							onClick={() => authClient.passkey.addPasskey()}
						>
							Add passkey
						</button>
						<button
							className="contrast"
							type="button"
							onClick={() => importSteam.mutate()}
						>
							Import Steam library
						</button>
					</div>
					{importSteam.error && <p>{importSteam.error.message}</p>}
				</article>
			</section>

			<section>
				<h2>Add games</h2>
				<input
					placeholder="Search Steam, then IGDB, or add missing game"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
				/>
				{search.data?.data.map((game) => (
					<div
						className="search-result"
						key={`${game.source}-${game.title}`}
					>
						{game.coverUrl ? (
							<img alt="" className="cover" src={game.coverUrl} />
						) : (
							<span />
						)}
						<div>
							<strong>{game.title}</strong>
							<p>
								{game.source.toUpperCase()}
								{game.releaseYear
									? ` · ${game.releaseYear}`
									: ""}
							</p>
						</div>
						<button
							type="button"
							onClick={() => addGame.mutate(game)}
						>
							Add
						</button>
					</div>
				))}
			</section>

			<section>
				<h2>Ranked list</h2>
				<DuplicateHints entries={entries.data?.data ?? []} />
				{entries.data?.data.map((entry, index) => (
					<GameEntry key={entry.id} entry={entry} index={index} />
				))}
			</section>
		</main>
	)
}

function DuplicateHints({ entries }: { entries: Entry[] }) {
	const duplicateTitles = Object.entries(
		entries.reduce<Record<string, number>>((counts, entry) => {
			const key = entry.title.toLowerCase().replace(/[^a-z0-9]+/g, "")
			counts[key] = (counts[key] ?? 0) + 1
			return counts
		}, {})
	).filter(([, count]) => count > 1)

	if (duplicateTitles.length === 0) {
		return null
	}

	return (
		<article>
			<strong>Possible duplicates</strong>
			<p>
				Some entries have identical normalized names. Review before
				merging; separate games should stay separate.
			</p>
		</article>
	)
}

function GameEntry({ entry, index }: { entry: Entry; index: number }) {
	const queryClient = useQueryClient()
	const [values, setValues] = useState<Record<string, string>>({})
	const update = useMutation({
		mutationFn: () =>
			apiJson(
				`entries/${entry.id}`,
				{
					...Object.fromEntries(
						Object.entries(values).map(([key, value]) => [
							key,
							value
						])
					),
					hidden: entry.hidden
				},
				{ method: "PATCH" }
			),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["entries"] })
	})
	const hide = useMutation({
		mutationFn: () =>
			apiJson(
				`entries/${entry.id}`,
				{ hidden: !entry.hidden },
				{ method: "PATCH" }
			),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["entries"] })
	})

	return (
		<article>
			<div className="game-card">
				{entry.coverUrl ? (
					<img alt="" src={entry.coverUrl} />
				) : (
					<span className="cover" />
				)}
				<div>
					<header>
						<p>#{index + 1}</p>
						<h3>{entry.title}</h3>
						<p>
							<span className="score-pill">
								{entry.score === null ? "Unrated" : entry.score}
							</span>{" "}
							{entry.hidden
								? "Hidden"
								: "Visible when rated + public"}
						</p>
					</header>
					<div className="field-grid">
						{ratingFields.map((field) => (
							<label key={field.key} title={field.description}>
								{field.group}: {field.label} / {field.max}
								<input
									defaultValue={
										(entry[field.key] as number | null) ??
										""
									}
									max={field.max}
									min={0}
									step={0.1}
									type="number"
									onChange={(event) =>
										setValues({
											...values,
											[field.key]: event.target.value
										})
									}
								/>
							</label>
						))}
					</div>
					<div role="group">
						<button type="button" onClick={() => update.mutate()}>
							Save scores
						</button>
						<button
							className="secondary"
							type="button"
							onClick={() => hide.mutate()}
						>
							{entry.hidden ? "Unhide" : "Hide"}
						</button>
					</div>
					{update.error && <p>{update.error.message}</p>}
				</div>
			</div>
		</article>
	)
}

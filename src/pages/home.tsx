import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { apiQueryOptions } from "~/lib/api-client"
import type { SpectrumGame } from "~/components/spectrum-table"
import { type LoaderFunctionArgs, Link, useLoaderData } from "react-router"
import { Image } from "~/components/image"
import { authClient } from "~/lib/auth-client"
import { cloudflareContext } from "~/lib/router-context"
import { ActivityBootstrap } from "~/pages/activity"
import styles from "./home.module.css"

const getSecret = (env: Cloudflare.Env, name: string) =>
	(env as unknown as Record<string, string | undefined>)[name] ?? null

export function loader({ context, request }: LoaderFunctionArgs) {
	const url = new URL(request.url)
	const activityLaunch =
		url.searchParams.has("frame_id") || url.searchParams.has("instance_id")
	const { env } = context.get(cloudflareContext)
	return {
		activityClientId: activityLaunch
			? getSecret(env, "DISCORD_CLIENT_ID")
			: null,
		activityLaunch
	}
}

const games = [
	{ title: "Outer Wilds", image: "/art/outer-wilds.jpg" },
	{ title: "Disco Elysium", image: "/art/disco-elysium.jpg" },
	{ title: "Hollow Knight", image: "/art/hollow-knight.jpg" },
	{ title: "Celeste", image: "/art/celeste.jpg" }
]

export default function HomePage() {
	const { activityClientId, activityLaunch } = useLoaderData<typeof loader>()
	const [selected, setSelected] = useState(0)
	const { data: session } = authClient.useSession()
	const entries = useQuery({
		...apiQueryOptions<{ data: SpectrumGame[] }>(["entries"], "entries"),
		enabled: !!session,
		refetchOnWindowFocus: false
	})
	const personal = (session ? (entries.data?.data ?? []) : [])
		.filter((entry) => entry.score !== null)
		.sort((a, b) => b.score! - a.score!)
		.slice(0, 4)
		.map((entry) => ({
			id: entry.id,
			title: entry.title,
			image: entry.steamAppId
				? `https://cdn.akamai.steamstatic.com/steam/apps/${entry.steamAppId}/library_hero.jpg`
				: entry.coverUrl,
			fallbackImage: entry.coverUrl
		}))
	const featured = [
		...personal,
		...games
			.filter(
				(game) =>
					!personal.some(
						(entry) =>
							entry.title.toLowerCase() ===
							game.title.toLowerCase()
					)
			)
			.map((game) => ({ ...game, id: game.title, fallbackImage: null }))
	].slice(0, 4)
	const active = featured[selected] ?? featured[0]
	if (activityLaunch && activityClientId) {
		return <ActivityBootstrap clientId={activityClientId} />
	}
	return (
		<main id="main">
			<section className={styles.hero}>
				{active.image && (
					<Image
						key={active.image}
						className={styles.art}
						src={active.image}
						fallbackSrc={active.fallbackImage}
						alt={`${active.title} artwork`}
						width={1300}
						height={419}
						fetchPriority="high"
					/>
				)}
				<div className={styles.content}>
					<h1>
						Game
						<br />
						Spectrum
					</h1>
					<Link
						className="button"
						to={session ? "/dashboard" : "/login"}
					>
						{session ? "My Library" : "Create A List"}
						<span aria-hidden="true">↗</span>
					</Link>
				</div>
				<span className={styles.caption}>{active.title}</span>
			</section>
			<div
				className={styles.filmstrip}
				role="group"
				aria-label="Featured Game Artwork"
			>
				{featured.map((game, index) => (
					<button
						key={game.id}
						aria-pressed={selected === index}
						onClick={() => setSelected(index)}
					>
						{game.image && (
							<Image
								src={game.image}
								fallbackSrc={game.fallbackImage}
								alt=""
								width={86}
								height={58}
							/>
						)}
						<span>{game.title}</span>
					</button>
				))}
			</div>
			<footer className={styles.footer}>
				<Link to="/about">About Game Spectrum</Link>
			</footer>
		</main>
	)
}

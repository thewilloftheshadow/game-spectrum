import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, NavLink } from "react-router"
import { apiJson, apiQueryOptions } from "~/lib/api-client"
import type { profiles } from "~/server/db/schema"
import ui from "~/styles/ui.module.css"

export function meta() {
	return [{ title: "Profile settings | Game Spectrum" }]
}

export default function ProfileSettingsPage() {
	const queryClient = useQueryClient()
	const me = useQuery({
		...apiQueryOptions<{
			data: {
				profile: Pick<
					typeof profiles.$inferSelect,
					| "slug"
					| "displayName"
					| "bio"
					| "favoriteGenres"
					| "isPublic"
				>
			}
		}>(["me"], "me"),
		refetchOnWindowFocus: false
	})
	const save = useMutation({
		mutationFn: (form: FormData) =>
			apiJson(
				"profile",
				{
					displayName: String(form.get("displayName") || "").trim(),
					slug: String(form.get("slug") || "")
						.trim()
						.toLowerCase(),
					bio: String(form.get("bio") || ""),
					favoriteGenres: String(form.get("favoriteGenres") || "")
						.split(",")
						.map((genre) => genre.trim())
						.filter(Boolean),
					isPublic: form.get("isPublic") === "on"
				},
				{ method: "PATCH" }
			),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] })
	})
	const profile = me.data?.data.profile
	return (
		<main id="main" className={`${ui.page} ${ui.narrow}`}>
			<div className={ui.heading}>
				<h1 className={ui.title}>Account</h1>
				{profile?.isPublic && (
					<Link className={ui.secondary} to={`/u/${profile.slug}`}>
						View profile ↗
					</Link>
				)}
			</div>
			<nav className={ui.tabs} aria-label="Account settings">
				<NavLink to="/accounts" end>
					Connections
				</NavLink>
				<NavLink to="/accounts/profile">Profile</NavLink>
			</nav>
			{me.isPending && (
				<div
					className={ui.skeleton}
					aria-label="Loading profile"
					aria-busy="true"
				/>
			)}
			{me.error && (
				<p className={ui.error} role="alert">
					{me.error.message}
				</p>
			)}
			{profile && (
				<form
					className={ui.form}
					onSubmit={(event) => {
						event.preventDefault()
						save.mutate(new FormData(event.currentTarget))
					}}
				>
					<label className={ui.field}>
						Display name
						<input
							className={ui.input}
							name="displayName"
							autoComplete="nickname"
							defaultValue={profile.displayName}
							required
							maxLength={80}
						/>
					</label>
					<label className={ui.field}>
						Profile URL
						<div className={ui.actions}>
							<span className={ui.muted}>/u/</span>
							<input
								className={ui.input}
								name="slug"
								defaultValue={profile.slug}
								pattern="[a-z0-9\-]{2,40}"
								required
								minLength={2}
								maxLength={40}
								autoCapitalize="none"
								spellCheck={false}
								aria-label="Profile slug"
							/>
						</div>
					</label>
					<label className={ui.field}>
						Bio
						<textarea
							className={ui.textarea}
							name="bio"
							defaultValue={profile.bio}
							maxLength={800}
						/>
					</label>
					<label className={ui.field}>
						Favorite genres
						<input
							className={ui.input}
							name="favoriteGenres"
							defaultValue={(
								JSON.parse(profile.favoriteGenres) as string[]
							).join(", ")}
							placeholder="Adventure, puzzle, RPG"
						/>
					</label>
					<label className={ui.checkbox}>
						<input
							type="checkbox"
							name="isPublic"
							defaultChecked={profile.isPublic}
						/>
						Public profile
					</label>
					{save.error && (
						<p className={ui.error} role="alert">
							{save.error.message}
						</p>
					)}
					<div className={ui.actions}>
						<button
							className={ui.button}
							disabled={save.isPending}
							type="submit"
						>
							{save.isPending ? "Saving…" : "Save profile"}
						</button>
					</div>
				</form>
			)}
		</main>
	)
}

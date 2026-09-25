import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, NavLink } from "react-router"
import type { z } from "zod"
import { CopyProfileLink } from "~/components/copy-profile-link"
import { apiJson } from "~/lib/api-client"
import { myProfileQuery } from "~/lib/profile"
import type { profilePayload } from "~/server/api/profile"
import type { profiles } from "~/server/db/schema"
import styles from "./profile-settings.module.css"

export function meta() {
	return [{ title: "Profile settings | Game Spectrum" }]
}

export default function ProfileSettingsPage() {
	const queryClient = useQueryClient()
	const me = useQuery({ ...myProfileQuery, refetchOnWindowFocus: false })
	const save = useMutation({
		mutationFn: (changes: z.infer<typeof profilePayload>) =>
			apiJson<{ data: { profile: typeof profiles.$inferSelect } }>(
				"profile",
				changes,
				{ method: "PATCH" }
			),
		onSuccess: async (result) => {
			queryClient.setQueryData(myProfileQuery.queryKey, (current) =>
				current
					? {
							data: {
								...current.data,
								profile: result.data.profile
							}
						}
					: current
			)
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["me"] }),
				queryClient.invalidateQueries({ queryKey: ["public"] })
			])
		}
	})
	const profile = me.data?.data.profile
	const visibilityChange = save.variables?.isPublic !== undefined
	return (
		<main id="main" className="page narrow">
			<div className="heading">
				<h1 className="title">My profile</h1>
				{profile?.isPublic && (
					<div className="actions">
						<Link className="secondary" to={`/u/${profile.slug}`}>
							View profile
						</Link>
						<CopyProfileLink slug={profile.slug} />
					</div>
				)}
			</div>
			<nav className="tabs" aria-label="Account settings">
				<NavLink to="/accounts" end>
					Connections
				</NavLink>
				<NavLink to="/accounts/profile">Profile</NavLink>
			</nav>
			{me.isPending && (
				<div
					className="skeleton"
					aria-label="Loading profile"
					aria-busy="true"
				/>
			)}
			{me.error && (
				<p className="error" role="alert">
					{me.error.message}
				</p>
			)}
			{profile && (
				<>
					<section
						className={styles.sharing}
						aria-label="Profile sharing"
					>
						<div className={styles.visibility}>
							<label className="checkbox">
								<input
									type="checkbox"
									checked={
										save.isPending && visibilityChange
											? save.variables?.isPublic
											: profile.isPublic
									}
									disabled={save.isPending}
									onChange={(event) =>
										save.mutate({
											isPublic: event.target.checked
										})
									}
								/>
								Public profile
							</label>
							<span className="status" role="status">
								{save.isPending && visibilityChange
									? "Saving visibility…"
									: profile.isPublic
										? "Public"
										: "Private"}
							</span>
						</div>
						<p className={styles.hint}>
							{profile.isPublic
								? "Completed ratings are visible at your profile link."
								: "Your profile link returns “not found” until you make it public."}{" "}
							Hidden games stay private. Shared games show your
							saved Paid amount, or the current store price when
							unset.
						</p>
						<p className={styles.counts}>
							{me.data?.data.library.ready ?? 0}{" "}
							{profile.isPublic ? "shared" : "ready to share"}
							<span> / </span>
							{me.data?.data.library.unfinished ?? 0} unfinished
							<span> / </span>
							{me.data?.data.library.hidden ?? 0} hidden
						</p>
						{save.error && visibilityChange && (
							<p className="error" role="alert">
								{save.error.message}
							</p>
						)}
					</section>
					<form
						className="form"
						key={profile.slug}
						onChange={() => {
							if (!save.isPending) save.reset()
						}}
						onSubmit={(event) => {
							event.preventDefault()
							const form = new FormData(event.currentTarget)
							save.mutate({
								displayName: String(
									form.get("displayName") || ""
								).trim(),
								slug: String(form.get("slug") || "")
									.trim()
									.toLowerCase(),
								bio: String(form.get("bio") || ""),
								favoriteGenres: String(
									form.get("favoriteGenres") || ""
								)
									.split(",")
									.map((genre) => genre.trim())
									.filter(Boolean)
							})
						}}
					>
						<fieldset
							className={styles.fields}
							disabled={save.isPending}
						>
							<label className="field">
								Display name
								<input
									className="input"
									name="displayName"
									autoComplete="nickname"
									defaultValue={profile.displayName}
									required
									maxLength={80}
								/>
							</label>
							<label className="field">
								Profile URL
								<div className={styles.slug}>
									<span>/u/</span>
									<input
										className="input"
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
							<label className="field">
								Bio
								<textarea
									className="textarea"
									name="bio"
									defaultValue={profile.bio}
									maxLength={800}
								/>
							</label>
							<label className="field">
								Favorite genres
								<input
									className="input"
									name="favoriteGenres"
									defaultValue={(
										JSON.parse(
											profile.favoriteGenres
										) as string[]
									).join(", ")}
									placeholder="Adventure, puzzle, RPG"
								/>
							</label>
						</fieldset>
						{save.error && !visibilityChange && (
							<p className="error" role="alert">
								{save.error.message}
							</p>
						)}
						<div className="actions">
							<button
								className="button"
								disabled={save.isPending}
								type="submit"
							>
								{save.isPending && !visibilityChange
									? "Saving…"
									: "Save profile"}
							</button>
							<span className="status" role="status">
								{save.isSuccess && !visibilityChange
									? "Profile saved"
									: ""}
							</span>
						</div>
					</form>
				</>
			)}
		</main>
	)
}

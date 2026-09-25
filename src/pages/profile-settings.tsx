import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { Link, NavLink } from "react-router"
import type { z } from "zod"
import { CopyProfileLink } from "~/components/copy-profile-link"
import { Image } from "~/components/image"
import { apiClient, apiJson } from "~/lib/api-client"
import { myProfileQuery } from "~/lib/profile"
import type { profilePayload } from "~/server/api/profile"
import type { profiles } from "~/server/db/schema"
import styles from "./profile-settings.module.css"

export function meta() {
	return [{ title: "Profile Settings | Game Spectrum" }]
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
	const avatarUpload = useMutation({
		mutationFn: (file: File) => {
			const body = new FormData()
			body.set("avatar", file)
			return apiClient<{
				data: { profile: typeof profiles.$inferSelect }
			}>("profile/avatar", { body, method: "POST" })
		},
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
	const avatarReset = useMutation({
		mutationFn: () =>
			apiClient<{ data: { profile: typeof profiles.$inferSelect } }>(
				"profile/avatar",
				{ method: "DELETE" }
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
	const avatar = profile?.avatarUrl ?? me.data?.data.user.image
	const avatarPending = avatarUpload.isPending || avatarReset.isPending
	const [isPublic, setIsPublic] = useState(false)
	useEffect(() => {
		if (profile) setIsPublic(profile.isPublic)
	}, [profile])

	return (
		<main id="main" className="page narrow">
			<div className="heading">
				<h1 className="title">My Profile</h1>
				{profile?.isPublic && (
					<div className="actions">
						<Link className="secondary" to={`/u/${profile.slug}`}>
							View Profile
						</Link>
						<CopyProfileLink slug={profile.slug} />
					</div>
				)}
			</div>
			<nav className="tabs" aria-label="Account Settings">
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
							isPublic,
							...(isPublic
								? {
										slug: String(form.get("slug") || "")
											.trim()
											.toLowerCase(),
										bio: String(form.get("bio") || "")
									}
								: {})
						})
					}}
				>
					<fieldset
						className={styles.fields}
						disabled={save.isPending}
					>
						<label className="field">
							Display Name
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
							Profile Avatar
							<div className={styles.avatarField}>
								{avatar && (
									<Image
										className={styles.avatar}
										src={avatar}
										alt=""
										width={56}
										height={56}
									/>
								)}
								<input
									className="input"
									type="file"
									accept="image/png,image/jpeg,image/webp,image/gif"
									disabled={avatarPending}
									onChange={(event) => {
										const file =
											event.currentTarget.files?.[0]
										if (file) avatarUpload.mutate(file)
										event.currentTarget.value = ""
									}}
								/>
								{profile.avatarUrl && (
									<button
										className="quiet"
										type="button"
										disabled={avatarPending}
										onClick={() => avatarReset.mutate()}
									>
										Use Account Avatar
									</button>
								)}
							</div>
							<span className="status" role="status">
								{avatarUpload.isPending
									? "Uploading Avatar…"
									: avatarUpload.isSuccess
										? "Avatar Uploaded"
										: avatarReset.isSuccess
											? "Account Avatar Restored"
											: "PNG, JPG, WebP, or GIF. Max 4 MB."}
							</span>
						</label>
						<div
							className={styles.sharing}
							aria-label="Profile Sharing"
						>
							<label className="checkbox">
								<input
									type="checkbox"
									checked={isPublic}
									onChange={(event) =>
										setIsPublic(event.target.checked)
									}
								/>
								Show Profile Publicly
							</label>
							<p className={styles.hint}>
								{isPublic
									? "Completed ratings are visible at your profile link."
									: "Your profile link returns “not found” until you make it public."}{" "}
							</p>
							<p className={styles.counts}>
								{me.data?.data.library.ready ?? 0} rated
								<span> / </span>
								{me.data?.data.library.unfinished ?? 0} unrated
								<span> / </span>
								{me.data?.data.library.hidden ?? 0} hidden
							</p>
						</div>
					</fieldset>
					<fieldset
						className={styles.fields}
						disabled={save.isPending || !isPublic}
					>
						<label className="field">
							Profile URL
							<span className={styles.slug}>
								<input
									className={`input ${styles.slugInput}`}
									name="slug"
									defaultValue={profile.slug}
									pattern="[a-z0-9\-]{2,40}"
									required
									minLength={2}
									maxLength={40}
									autoCapitalize="none"
									spellCheck={false}
									aria-label="Profile Slug"
								/>
							</span>
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
					</fieldset>
					{save.error && (
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
							{save.isPending ? "Saving…" : "Save Profile"}
						</button>
						<span className="status" role="status">
							{save.isSuccess ? "Profile Saved" : ""}
						</span>
					</div>
				</form>
			)}
		</main>
	)
}

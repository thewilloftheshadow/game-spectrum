import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { AdminNav } from "~/components/admin-nav"
import { apiQueryOptions } from "~/lib/api-client"
import { authClient } from "~/lib/auth-client"
import type { gameEntries, profiles } from "~/server/db/schema"
import styles from "./admin.module.css"

export default function AdminUserPage() {
	const { id = "" } = useParams()
	const navigate = useNavigate()
	const [error, setError] = useState("")
	const details = useQuery(
		apiQueryOptions<{
			data: {
				id: string
				name: string
				email: string
				role: string | null
				banned: boolean | null
				banReason: string | null
				profile: typeof profiles.$inferSelect | null
				entries: (typeof gameEntries.$inferSelect & {
					title: string
					score: number | null
				})[]
			}
		}>(["admin", "user", id], `admin/users/${encodeURIComponent(id)}`)
	)
	const member = details.data?.data
	let favoriteGenres = member?.profile?.favoriteGenres ?? "—"
	if (favoriteGenres) {
		try {
			const genres: unknown = JSON.parse(favoriteGenres)
			if (Array.isArray(genres)) favoriteGenres = genres.join(", ") || "—"
		} catch {
			// Display legacy values as stored.
		}
	}

	return (
		<main id="main" className={`page ${styles.page}`}>
			<header className={styles.heading}>
				<div>
					<p className={styles.eyebrow}>
						<Link to="/admin">Accounts</Link> <span>/</span> Member
					</p>
					<h1 className="title">
						{member?.profile?.displayName ??
							member?.name ??
							"Member"}
					</h1>
					<p className={styles.subtitle}>
						{member?.email ?? "Loading account details…"}
					</p>
				</div>
				{member && (
					<span
						className={
							member.banned
								? styles.statusBanned
								: styles.statusActive
						}
					>
						{member.banned ? "Banned" : "Active"}
					</span>
				)}
			</header>
			<AdminNav active="accounts" />

			{details.isPending ? (
				<div className={styles.loading} aria-label="Loading member" />
			) : details.error || !member ? (
				<p className="error" role="alert">
					{details.error?.message ?? "Account not found."}
				</p>
			) : (
				<>
					{error && (
						<p className="error" role="alert">
							{error}
						</p>
					)}
					<section
						className={styles.memberActions}
						aria-label="Account actions"
					>
						<button
							className="secondary"
							onClick={async () => {
								const result = member.banned
									? await authClient.admin.unbanUser({
											userId: id
										})
									: await authClient.admin.banUser({
											userId: id,
											banReason: "Admin action"
										})
								if (result.error)
									setError(
										result.error.message ??
											"Unable to update ban."
									)
								else await details.refetch()
							}}
						>
							{member.banned ? "Unban account" : "Ban account"}
						</button>
						<button
							className="secondary"
							onClick={async () => {
								const result = await authClient.admin.setRole({
									userId: id,
									role:
										member.role === "admin"
											? "user"
											: "admin"
								})
								if (result.error)
									setError(
										result.error.message ??
											"Unable to change role."
									)
								else await details.refetch()
							}}
						>
							{member.role === "admin"
								? "Remove admin role"
								: "Grant admin role"}
						</button>
						<button
							className="secondary"
							onClick={async () => {
								if (
									!window.confirm(
										"Revoke all of this member’s sessions?"
									)
								)
									return
								const result =
									await authClient.admin.revokeUserSessions({
										userId: id
									})
								if (result.error)
									setError(
										result.error.message ??
											"Unable to revoke sessions."
									)
							}}
						>
							Revoke sessions
						</button>
						<button
							className="quiet"
							onClick={async () => {
								const result =
									await authClient.admin.impersonateUser({
										userId: id
									})
								if (result.error)
									setError(
										result.error.message ??
											"Unable to impersonate member."
									)
								else window.location.assign("/dashboard")
							}}
						>
							Impersonate
						</button>
						<button
							className="quiet"
							onClick={async () => {
								if (
									!window.confirm(
										"Permanently delete this account and all linked data?"
									)
								)
									return
								const result =
									await authClient.admin.removeUser({
										userId: id
									})
								if (result.error)
									setError(
										result.error.message ??
											"Unable to delete account."
									)
								else navigate("/admin")
							}}
						>
							Delete account
						</button>
					</section>

					<section className={styles.memberSection}>
						<div className={styles.sectionHeading}>
							<div>
								<p className={styles.eyebrow}>Profile</p>
								<h2>Member details</h2>
							</div>
							{member.profile && (
								<Link
									className="quiet"
									to={`/admin/data/profiles/${encodeURIComponent(member.profile.userId)}`}
								>
									Edit profile →
								</Link>
							)}
						</div>
						{member.profile ? (
							<dl className={styles.profileGrid}>
								<div>
									<dt>Profile URL</dt>
									<dd>/{member.profile.slug}</dd>
								</div>
								<div>
									<dt>Visibility</dt>
									<dd>
										{member.profile.isPublic
											? "Public"
											: "Private"}
									</dd>
								</div>
								<div>
									<dt>Steam vanity</dt>
									<dd>{member.profile.steamVanity || "—"}</dd>
								</div>
								<div>
									<dt>Favorite genres</dt>
									<dd>{favoriteGenres}</dd>
								</div>
								<div className={styles.bio}>
									<dt>Bio</dt>
									<dd>{member.profile.bio || "No bio"}</dd>
								</div>
							</dl>
						) : (
							<p className={styles.empty}>
								No profile record exists.
							</p>
						)}
						{member.banReason && (
							<p className={styles.banReason}>
								Ban reason: {member.banReason}
							</p>
						)}
					</section>

					<section className={styles.memberSection}>
						<div className={styles.sectionHeading}>
							<div>
								<p className={styles.eyebrow}>Library</p>
								<h2>{member.entries.length} ratings</h2>
							</div>
						</div>
						{member.entries.length ? (
							<div className={styles.tableWrap}>
								<table className={styles.accountsTable}>
									<thead>
										<tr>
											<th scope="col">Game</th>
											<th scope="col">Score</th>
											<th scope="col">Visibility</th>
											<th scope="col">Hours</th>
											<th scope="col">Paid</th>
											<th scope="col">
												<span className="sr-only">
													Edit
												</span>
											</th>
										</tr>
									</thead>
									<tbody>
										{member.entries.map((entry) => (
											<tr key={entry.id}>
												<td>
													<strong>
														{entry.title}
													</strong>
													{entry.notes && (
														<span
															className={
																styles.secondaryText
															}
														>
															{entry.notes}
														</span>
													)}
												</td>
												<td className={styles.score}>
													{entry.score ??
														"Incomplete"}
												</td>
												<td>
													{entry.hidden
														? "Hidden"
														: "Visible"}
												</td>
												<td>
													{entry.playtimeMinutes ==
													null
														? "—"
														: `${(entry.playtimeMinutes / 60).toFixed(1)} h`}
												</td>
												<td>
													{entry.paidPriceCents ==
													null
														? "—"
														: `$${(entry.paidPriceCents / 100).toFixed(2)}`}
												</td>
												<td>
													<Link
														className="quiet"
														to={`/admin/data/gameEntries/${encodeURIComponent(entry.id)}`}
													>
														Edit →
													</Link>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : (
							<p className={styles.empty}>No ratings saved.</p>
						)}
					</section>
				</>
			)}
		</main>
	)
}

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { apiQueryOptions } from "~/lib/api-client"
import { authClient } from "~/lib/auth-client"
import type { gameEntries, profiles } from "~/server/db/schema"

export default function AdminPage() {
	const users = useQuery(
		apiQueryOptions<{
			data: {
				id: string
				name: string
				email: string
				role: string | null
				banned: boolean | null
				profile: typeof profiles.$inferSelect | null
			}[]
		}>(["admin", "users"], "admin/users")
	)
	const [selectedId, setSelectedId] = useState("")
	const [error, setError] = useState("")
	const details = useQuery({
		...apiQueryOptions<{
			data: {
				id: string
				name: string
				email: string
				role: string | null
				banned: boolean | null
				profile: typeof profiles.$inferSelect | null
				entries: (typeof gameEntries.$inferSelect & {
					title: string
					score: number | null
					hidden: boolean
					notes: string | null
				})[]
			}
		}>(
			["admin", "user", selectedId],
			`admin/users/${encodeURIComponent(selectedId)}`
		),
		enabled: !!selectedId
	})

	return (
		<main id="main" className="page">
			<h1 className="title">Admin</h1>
			<p>
				Private profiles and ratings are visible only to the linked
				admin account.
			</p>
			{users.isPending && (
				<div className="skeleton" aria-label="Loading users" />
			)}
			{users.error && (
				<p className="error" role="alert">
					{users.error.message}
				</p>
			)}
			{error && (
				<p className="error" role="alert">
					{error}
				</p>
			)}
			{users.data && (
				<div className="section">
					<h2>Users ({users.data.data.length})</h2>
					<div className="actions">
						{users.data.data.map((item) => (
							<button
								className="secondary"
								key={item.id}
								onClick={() => setSelectedId(item.id)}
							>
								{item.profile?.displayName ?? item.name} ·{" "}
								{item.email}
							</button>
						))}
					</div>
				</div>
			)}
			{details.data && (
				<section className="section">
					<h2>
						{details.data.data.profile?.displayName ??
							details.data.data.name}
					</h2>
					<p>
						{details.data.data.email} · Role:{" "}
						{details.data.data.role ?? "user"}
					</p>
					<div className="actions">
						<button
							className="secondary"
							onClick={async () => {
								setError("")
								const result = details.data.data.banned
									? await authClient.admin.unbanUser({
											userId: selectedId
										})
									: await authClient.admin.banUser({
											userId: selectedId,
											banReason:
												window.prompt("Ban reason") ??
												"Admin action"
										})
								if (result.error)
									setError(
										result.error.message ??
											"Unable to update ban."
									)
								else
									await Promise.all([
										users.refetch(),
										details.refetch()
									])
							}}
						>
							{details.data.data.banned ? "Unban" : "Ban"}
						</button>
						<button
							className="secondary"
							onClick={async () => {
								const result = await authClient.admin.setRole({
									userId: selectedId,
									role:
										details.data.data.role === "admin"
											? "user"
											: "admin"
								})
								if (result.error)
									setError(
										result.error.message ??
											"Unable to change role."
									)
								else
									await Promise.all([
										users.refetch(),
										details.refetch()
									])
							}}
						>
							{details.data.data.role === "admin"
								? "Remove Admin Role"
								: "Grant Admin Role"}
						</button>
						<button
							className="secondary"
							onClick={async () => {
								if (
									!window.confirm(
										"Revoke every session for this user?"
									)
								)
									return
								const result =
									await authClient.admin.revokeUserSessions({
										userId: selectedId
									})
								if (result.error)
									setError(
										result.error.message ??
											"Unable to revoke sessions."
									)
							}}
						>
							Revoke Sessions
						</button>
						<button
							className="secondary"
							onClick={async () => {
								if (
									!window.confirm(
										"Permanently delete this account and its data?"
									)
								)
									return
								const result =
									await authClient.admin.removeUser({
										userId: selectedId
									})
								if (result.error)
									setError(
										result.error.message ??
											"Unable to delete user."
									)
								else {
									setSelectedId("")
									await users.refetch()
								}
							}}
						>
							Delete User
						</button>
					</div>
					<button
						className="secondary"
						onClick={async () => {
							setError("")
							try {
								const result =
									await authClient.admin.impersonateUser({
										userId: selectedId
									})
								if (result.error) {
									setError(
										result.error.message ??
											"Unable to impersonate user."
									)
									return
								}
								window.location.assign("/dashboard")
							} catch (failure) {
								setError(
									failure instanceof Error
										? failure.message
										: "Unable to impersonate user."
								)
							}
						}}
					>
						Impersonate
					</button>
					{details.data.data.profile && (
						<>
							<h3>Profile</h3>
							<pre>
								{JSON.stringify(
									details.data.data.profile,
									null,
									2
								)}
							</pre>
						</>
					)}
					<h3>
						Private ratings ({details.data.data.entries.length})
					</h3>
					{details.data.data.entries.map((entry) => (
						<details key={entry.id} className="row">
							<summary>
								{entry.title}
								{entry.hidden ? " · Hidden" : ""}
								{entry.score !== null
									? ` · Score ${entry.score}`
									: " · Incomplete"}
							</summary>
							<pre>{JSON.stringify(entry, null, 2)}</pre>
						</details>
					))}
				</section>
			)}
		</main>
	)
}

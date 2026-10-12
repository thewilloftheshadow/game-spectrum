import { useQuery } from "@tanstack/react-query"
import { useDeferredValue, useState } from "react"
import { Link } from "react-router"
import { AdminNav } from "~/components/admin-nav"
import { apiQueryOptions } from "~/lib/api-client"
import type { profiles } from "~/server/db/schema"
import styles from "./admin.module.css"

export default function AdminPage() {
	const [search, setSearch] = useState("")
	const query = useDeferredValue(search.trim().toLowerCase())
	const users = useQuery(
		apiQueryOptions<{
			data: {
				id: string
				name: string
				email: string
				role: string | null
				banned: boolean | null
				createdAt: string
				profile: typeof profiles.$inferSelect | null
			}[]
		}>(["admin", "users"], "admin/users")
	)
	const records = users.data?.data.filter((item) =>
		[item.name, item.email, item.profile?.displayName, item.profile?.slug]
			.join(" ")
			.toLowerCase()
			.includes(query)
	)

	return (
		<main id="main" className={`page ${styles.page}`}>
			<header className={styles.heading}>
				<div>
					<p className={styles.eyebrow}>Game Spectrum · Admin</p>
					<h1 className="title">Accounts</h1>
					<p className={styles.subtitle}>
						Manage member profiles, access, and saved ratings.
					</p>
				</div>
				<div className={styles.count}>
					<span>{users.data?.data.length ?? "—"}</span>
					<small>accounts</small>
				</div>
			</header>
			<AdminNav active="accounts" />

			<section
				className={styles.workspace}
				aria-labelledby="accounts-title"
			>
				<div className={styles.toolbar}>
					<div>
						<h2 id="accounts-title">All accounts</h2>
						<p>Private profile and rating data is admin-only.</p>
					</div>
					<label className={styles.search}>
						<span className="sr-only">Search accounts</span>
						<input
							className="input"
							type="search"
							placeholder="Name, email, or profile URL"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
						/>
					</label>
				</div>

				{users.isPending ? (
					<div
						className={styles.loading}
						aria-label="Loading accounts"
					>
						{Array.from({ length: 5 }, (_, index) => (
							<div key={index} />
						))}
					</div>
				) : users.error ? (
					<p className="error" role="alert">
						{users.error.message}
					</p>
				) : records?.length ? (
					<div className={styles.tableWrap}>
						<table className={styles.accountsTable}>
							<thead>
								<tr>
									<th scope="col">Member</th>
									<th scope="col">Profile</th>
									<th scope="col">Role</th>
									<th scope="col">Status</th>
									<th scope="col">Joined</th>
									<th scope="col">
										<span className="sr-only">Open</span>
									</th>
								</tr>
							</thead>
							<tbody>
								{records.map((item) => (
									<tr key={item.id}>
										<td>
											<strong>
												{item.profile?.displayName ??
													item.name}
											</strong>
											<span
												className={styles.secondaryText}
											>
												{item.email}
											</span>
										</td>
										<td>
											{item.profile ? (
												<>
													<span>
														/{item.profile.slug}
													</span>
													<span
														className={
															styles.secondaryText
														}
													>
														{item.profile.isPublic
															? "Public"
															: "Private"}
													</span>
												</>
											) : (
												<span
													className={
														styles.secondaryText
													}
												>
													No profile
												</span>
											)}
										</td>
										<td>{item.role ?? "Member"}</td>
										<td>
											<span
												className={
													item.banned
														? styles.statusBanned
														: styles.statusActive
												}
											>
												{item.banned
													? "Banned"
													: "Active"}
											</span>
										</td>
										<td className={styles.date}>
											{new Date(
												item.createdAt
											).toLocaleDateString()}
										</td>
										<td className={styles.openCell}>
											<Link
												className="quiet"
												to={`/admin/users/${encodeURIComponent(item.id)}`}
											>
												Open{" "}
												<span aria-hidden="true">
													→
												</span>
											</Link>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : (
					<p className={styles.empty}>
						{query
							? "No accounts match that search."
							: "No accounts yet."}
					</p>
				)}
			</section>
		</main>
	)
}

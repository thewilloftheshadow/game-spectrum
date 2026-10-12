import { useQuery } from "@tanstack/react-query"
import { useDeferredValue, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { AdminNav } from "~/components/admin-nav"
import { apiQueryOptions } from "~/lib/api-client"
import styles from "./admin.module.css"

const tables = [
	{ id: "profiles", label: "Profiles" },
	{ id: "games", label: "Games" },
	{ id: "gameEntries", label: "Ratings" },
	{ id: "mergeSuggestions", label: "Merge suggestions" }
] as const

export default function AdminDataPage() {
	const [searchParams, setSearchParams] = useSearchParams()
	const [table, setTable] = useState<(typeof tables)[number]["id"]>(
		() =>
			tables.find((item) => item.id === searchParams.get("table"))?.id ??
			"profiles"
	)
	const [search, setSearch] = useState("")
	const query = useDeferredValue(search.trim().toLowerCase())
	const records = useQuery(
		apiQueryOptions<{ data: Record<string, unknown>[] }>(
			["admin", "data", table],
			`admin/data/${table}`
		)
	)
	const filtered = records.data?.data.filter((record) =>
		JSON.stringify(record).toLowerCase().includes(query)
	)

	return (
		<main id="main" className={`page ${styles.page}`}>
			<header className={styles.heading}>
				<div>
					<p className={styles.eyebrow}>Game Spectrum · Admin</p>
					<h1 className="title">App data</h1>
					<p className={styles.subtitle}>
						Edit and remove game and profile records. Authentication
						records are not shown here.
					</p>
				</div>
				<div className={styles.count}>
					<span>{records.data?.data.length ?? "—"}</span>
					<small>
						{tables
							.find((item) => item.id === table)
							?.label.toLowerCase()}
					</small>
				</div>
			</header>
			<AdminNav active="data" />

			<section className={styles.workspace} aria-labelledby="data-title">
				<div className={styles.toolbar}>
					<div>
						<h2 id="data-title">Records</h2>
						<p>
							Choose a dataset, then open a record to edit its
							fields.
						</p>
					</div>
					<div className={styles.filters}>
						<label>
							<span className="sr-only">Dataset</span>
							<select
								className="select"
								value={table}
								onChange={(event) => {
									const next = event.target
										.value as typeof table
									setTable(next)
									setSearchParams({ table: next })
								}}
							>
								{tables.map((item) => (
									<option key={item.id} value={item.id}>
										{item.label}
									</option>
								))}
							</select>
						</label>
						<label>
							<span className="sr-only">Search records</span>
							<input
								className="input"
								type="search"
								placeholder="Filter records"
								value={search}
								onChange={(event) =>
									setSearch(event.target.value)
								}
							/>
						</label>
					</div>
				</div>

				{records.isPending ? (
					<div
						className={styles.loading}
						aria-label="Loading records"
					>
						<div />
						<div />
						<div />
						<div />
					</div>
				) : records.error ? (
					<p className="error" role="alert">
						{records.error.message}
					</p>
				) : filtered?.length ? (
					<div className={styles.tableWrap}>
						<table className={styles.accountsTable}>
							<thead>
								<tr>
									<th scope="col">Record</th>
									<th scope="col">Owner / type</th>
									<th scope="col">Details</th>
									<th scope="col">
										<span className="sr-only">Open</span>
									</th>
								</tr>
							</thead>
							<tbody>
								{filtered.map((record) => {
									const id = String(
										record.userId ?? record.id
									)
									const name =
										table === "profiles"
											? String(
													record.displayName ??
														"Profile"
												)
											: table === "games"
												? String(record.title ?? "Game")
												: table === "gameEntries"
													? String(
															record.gameTitle ??
																record.manualTitle ??
																record.gameId ??
																"Rating"
														)
													: String(
															record.reason ??
																"Merge suggestion"
														)
									const owner =
										table === "profiles"
											? `/${String(record.slug ?? "")}`
											: table === "games"
												? String(
														record.source ??
															"manual"
													)
												: String(
														record.ownerName ??
															record.userId ??
															"—"
													)
									const detail =
										table === "profiles"
											? record.isPublic
												? "Public profile"
												: "Private profile"
											: table === "games"
												? (record.releaseYear ??
													"Release year unknown")
												: table === "gameEntries"
													? record.hidden
														? "Hidden rating"
														: "Visible rating"
													: String(
															record.status ??
																"Open"
														)
									return (
										<tr key={id}>
											<td>
												<strong>{name}</strong>
												<span
													className={
														styles.secondaryText
													}
												>
													{id}
												</span>
											</td>
											<td>
												{table !== "profiles" &&
												record.userId ? (
													<Link
														to={`/admin/users/${encodeURIComponent(String(record.userId))}`}
													>
														{owner}
													</Link>
												) : (
													owner
												)}
											</td>
											<td>{String(detail)}</td>
											<td className={styles.openCell}>
												<Link
													className="quiet"
													to={`/admin/data/${table}/${encodeURIComponent(id)}`}
												>
													Edit →
												</Link>
											</td>
										</tr>
									)
								})}
							</tbody>
						</table>
					</div>
				) : (
					<p className={styles.empty}>
						{query
							? "No matching records."
							: "No records in this dataset."}
					</p>
				)}
			</section>
		</main>
	)
}

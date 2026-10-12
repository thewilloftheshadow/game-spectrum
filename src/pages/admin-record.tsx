import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { AdminNav } from "~/components/admin-nav"
import { apiClient, apiQueryOptions } from "~/lib/api-client"
import styles from "./admin.module.css"

const tables = ["profiles", "games", "gameEntries", "mergeSuggestions"] as const
const numberFields = new Set([
	"steamAppId",
	"igdbId",
	"releaseYear",
	"playtimeMinutes",
	"paidPriceCents",
	"funFeeling",
	"immersive",
	"variety",
	"artistry",
	"ui",
	"narrationTheme",
	"authenticity",
	"originality",
	"music",
	"effectsVocals",
	"interfaceScore",
	"control",
	"learningCurve",
	"performancePenalty",
	"badMomentPenalty",
	"inconsistencyPenalty",
	"replayabilityBonus",
	"extraPercent"
])
const booleanFields = new Set([
	"isPublic",
	"hidden",
	"importedFromSteam",
	"playtimeOverridden"
])
const nullableFields = new Set([
	"avatarUrl",
	"steamVanity",
	"playtimeSyncedAt",
	"playtimeSyncAttemptAt",
	"steamAppId",
	"igdbId",
	"releaseYear",
	"gameId",
	"manualTitle",
	"coverUrl",
	"playtimeMinutes",
	"paidPriceCents",
	"storeUrl",
	"funFeeling",
	"immersive",
	"variety",
	"artistry",
	"ui",
	"narrationTheme",
	"authenticity",
	"originality",
	"music",
	"effectsVocals",
	"interfaceScore",
	"control",
	"learningCurve",
	"performancePenalty",
	"badMomentPenalty",
	"inconsistencyPenalty",
	"replayabilityBonus",
	"extraPercent",
	"notes",
	"fromGameId",
	"toGameId"
])
const selectOptions: Record<string, string[]> = {
	source: ["steam", "igdb", "manual"],
	status: ["open", "dismissed", "merged"]
}

export default function AdminRecordPage() {
	const { table = "", id = "" } = useParams()
	const navigate = useNavigate()
	const validTable = tables.includes(table as (typeof tables)[number])
	const record = useQuery({
		...apiQueryOptions<{ data: Record<string, unknown> }>(
			["admin", "record", table, id],
			`admin/data/${encodeURIComponent(table)}/${encodeURIComponent(id)}`
		),
		enabled: validTable && !!id
	})
	const [draft, setDraft] = useState<Record<string, unknown> | null>(null)
	const [error, setError] = useState("")
	const [saved, setSaved] = useState(false)
	const values = record.data?.data

	useEffect(() => {
		if (!values) return
		const editable = Object.fromEntries(
			Object.entries(values).filter(
				([key]) =>
					!(
						["id", "createdAt", "updatedAt"].includes(key) ||
						(table === "profiles" && key === "userId")
					)
			)
		)
		if (
			table === "profiles" &&
			typeof editable.favoriteGenres === "string"
		) {
			try {
				const genres: unknown = JSON.parse(editable.favoriteGenres)
				if (Array.isArray(genres))
					editable.favoriteGenres = genres.join(", ")
			} catch {
				// Keep a legacy plain-text value editable.
			}
		}
		setDraft(editable)
	}, [table, values])

	if (!validTable) {
		return (
			<main id="main" className={`page ${styles.page}`}>
				<h1 className="title">Unknown app-data table</h1>
				<Link className="quiet" to="/admin/data">
					Back to app data
				</Link>
			</main>
		)
	}

	const save = async () => {
		if (!draft) return
		const payload = { ...draft }
		if (
			table === "profiles" &&
			typeof payload.favoriteGenres === "string"
		) {
			payload.favoriteGenres = JSON.stringify(
				payload.favoriteGenres
					.split(",")
					.map((genre) => genre.trim())
					.filter(Boolean)
			)
		}
		try {
			setError("")
			setSaved(false)
			await apiClient(`admin/data/${table}/${encodeURIComponent(id)}`, {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload)
			})
			await record.refetch()
			setSaved(true)
		} catch (failure) {
			setError(
				failure instanceof Error
					? failure.message
					: "Unable to save this record."
			)
		}
	}

	const remove = async () => {
		if (
			!window.confirm(
				"Delete this app-data record? This cannot be undone."
			)
		)
			return
		try {
			await apiClient(`admin/data/${table}/${encodeURIComponent(id)}`, {
				method: "DELETE"
			})
			navigate(`/admin/data?table=${table}`)
		} catch (failure) {
			setError(
				failure instanceof Error
					? failure.message
					: "Unable to delete this record."
			)
		}
	}

	return (
		<main id="main" className={`page ${styles.page}`}>
			<header className={styles.heading}>
				<div>
					<p className={styles.eyebrow}>
						<Link to="/admin/data">App data</Link> <span>/</span>{" "}
						{table}
					</p>
					<h1 className="title">
						{values
							? String(
									values.title ??
										values.displayName ??
										values.manualTitle ??
										values.reason ??
										table
								)
							: "Record"}
					</h1>
					<p className={styles.subtitle}>
						Record ID <code>{id}</code>
					</p>
				</div>
				<Link className="quiet" to={`/admin/data?table=${table}`}>
					← All {table}
				</Link>
			</header>
			<AdminNav active="data" />
			{record.isPending ? (
				<div className={styles.loading} aria-label="Loading record">
					<div />
					<div />
					<div />
				</div>
			) : record.error ? (
				<p className="error" role="alert">
					{record.error.message}
				</p>
			) : (
				draft && (
					<form
						className={styles.editor}
						onSubmit={(event) => {
							event.preventDefault()
							void save()
						}}
					>
						<div className={styles.editorHeading}>
							<div>
								<p className={styles.eyebrow}>
									Editable fields
								</p>
								<h2>Record details</h2>
							</div>
							<span className={styles.helper}>
								Changes save directly to the app database.
							</span>
						</div>
						<div className={styles.fields}>
							{Object.entries(draft).map(([key, value]) => {
								const label = key
									.replace(/([A-Z])/g, " $1")
									.replace(/^./, (letter) =>
										letter.toUpperCase()
									)
								const options = selectOptions[key]
								return (
									<label className={styles.field} key={key}>
										<span>{label}</span>
										{booleanFields.has(key) ? (
											<span
												className={styles.booleanField}
											>
												<input
													type="checkbox"
													checked={Boolean(value)}
													onChange={(event) =>
														setDraft({
															...draft,
															[key]: event.target
																.checked
														})
													}
												/>
												{value ? "Enabled" : "Disabled"}
											</span>
										) : options ? (
											<select
												className="select"
												value={String(value ?? "")}
												onChange={(event) =>
													setDraft({
														...draft,
														[key]: event.target
															.value
													})
												}
											>
												{options.map((option) => (
													<option key={option}>
														{option}
													</option>
												))}
											</select>
										) : key === "bio" ||
										  key === "notes" ||
										  key === "reason" ? (
											<textarea
												className="textarea"
												value={String(value ?? "")}
												onChange={(event) =>
													setDraft({
														...draft,
														[key]:
															event.target
																.value ||
															(nullableFields.has(
																key
															)
																? null
																: "")
													})
												}
											/>
										) : (
											<input
												className="input"
												type={
													numberFields.has(key)
														? "number"
														: "text"
												}
												step={
													key === "extraPercent"
														? "any"
														: "any"
												}
												value={
													value == null
														? ""
														: String(value)
												}
												onChange={(event) => {
													const raw =
														event.target.value
													const next =
														numberFields.has(key)
															? raw === ""
																? null
																: Number(raw)
															: raw === "" &&
																  nullableFields.has(
																		key
																  )
																? null
																: raw
													setDraft({
														...draft,
														[key]: next
													})
												}}
											/>
										)}
										{key === "favoriteGenres" && (
											<small>
												Separate genres with commas.
											</small>
										)}
									</label>
								)
							})}
						</div>
						{error && (
							<p className="error" role="alert">
								{error}
							</p>
						)}
						{saved && (
							<p className={styles.saved} role="status">
								Changes saved.
							</p>
						)}
						<footer className={styles.editorFooter}>
							<button className="button" type="submit">
								Save changes
							</button>
							<button
								className="quiet"
								type="button"
								onClick={() => void remove()}
							>
								Delete record
							</button>
						</footer>
					</form>
				)
			)}
		</main>
	)
}

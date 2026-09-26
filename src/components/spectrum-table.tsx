import { usePostHog } from "@posthog/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
	Fragment,
	useCallback,
	useEffect,
	useId,
	useState,
	type ReactNode
} from "react"
import { apiJson } from "~/lib/api-client"
import { ratingFields, ratingGroups } from "~/lib/scoring"
import { getStorefront } from "~/lib/storefront"
import type { gameEntries } from "~/server/db/schema"
import { SpectrumRow } from "./spectrum-row"
import styles from "./spectrum-table.module.css"

export type SpectrumGame = Pick<
	typeof gameEntries.$inferSelect,
	| "id"
	| "hidden"
	| "steamAppId"
	| "playtimeMinutes"
	| "storeUrl"
	| (typeof ratingFields)[number]["key"]
> &
	Partial<Pick<typeof gameEntries.$inferSelect, "paidPriceCents">> & {
		title: string
		customCoverUrl: string | null
		coverUrl: string | null
		score: number | null
	}

export function SpectrumTable({
	entries,
	visibleEntries = entries,
	editable = false,
	ranks,
	toolbar,
	children,
	className
}: {
	entries: SpectrumGame[]
	visibleEntries?: SpectrumGame[]
	editable?: boolean
	ranks?: Record<string, number>
	toolbar?: (saveButton: ReactNode) => ReactNode
	children?: ReactNode
	className?: string
}) {
	const formId = useId()
	const posthog = usePostHog()
	const queryClient = useQueryClient()
	const [drafts, setDrafts] = useState<
		Record<
			string,
			Partial<
				Record<
					| (typeof ratingFields)[number]["key"]
					| "paidPrice"
					| "storeUrl"
					| "title",
					string
				>
			>
		>
	>({})
	const [visibility, setVisibility] = useState<Record<string, boolean>>({})
	const [rowOrder, setRowOrder] = useState<string[] | null>(null)
	const freezeRowOrder = useCallback(() => {
		if (!editable) return
		setRowOrder(
			(current) => current ?? visibleEntries.map((entry) => entry.id)
		)
	}, [editable, visibleEntries])
	const changeScore = useCallback(
		(
			id: string,
			key:
				| (typeof ratingFields)[number]["key"]
				| "paidPrice"
				| "storeUrl"
				| "title",
			value: string
		) => {
			freezeRowOrder()
			setDrafts((current) => ({
				...current,
				[id]: { ...current[id], [key]: value }
			}))
		},
		[freezeRowOrder]
	)
	const changeVisibility = useCallback(
		(id: string, hidden: boolean) => {
			freezeRowOrder()
			setVisibility((current) => ({ ...current, [id]: hidden }))
		},
		[freezeRowOrder]
	)
	const changedIds = [
		...new Set([...Object.keys(drafts), ...Object.keys(visibility)])
	]
	const rowPositions = rowOrder
		? new Map(rowOrder.map((id, index) => [id, index]))
		: null
	const visibleRows = rowPositions
		? [...visibleEntries].sort(
				(a, b) =>
					(rowPositions.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
					(rowPositions.get(b.id) ?? Number.MAX_SAFE_INTEGER)
			)
		: visibleEntries
	useEffect(() => {
		if ((!editable || changedIds.length === 0) && rowOrder)
			setRowOrder(null)
	}, [changedIds.length, editable, rowOrder])
	const save = useMutation({
		mutationFn: async () => {
			const games = new Map(entries.map((entry) => [entry.id, entry]))
			// Validate every edit before sending anything, including filtered-out games.
			const pending = changedIds.map((id) => {
				const game = games.get(id)
				if (!game)
					throw new Error(
						"A changed game is unavailable. Reload your library before saving."
					)
				const values: Record<string, number | boolean | string | null> =
					{}
				const title = drafts[id]?.title
				if (title !== undefined) {
					if (!title.trim()) values.manualTitle = null
					else if (title.trim().length > 120)
						throw new Error(
							`${game.title}: title must be 120 characters or fewer.`
						)
					else values.manualTitle = title.trim()
				}
				for (const field of ratingFields) {
					const draft = drafts[id]?.[field.key]
					if (draft === undefined) continue
					if (draft.trim() === "") {
						values[field.key] = null
						continue
					}
					const number = Number(draft)
					const max = field.key === "extraPercent" ? 10 : field.max
					if (
						!Number.isFinite(number) ||
						number < 0 ||
						number > max ||
						Math.abs(number * 10 - Math.round(number * 10)) >
							0.000001
					) {
						throw new Error(
							`${game.title}: ${field.label} must be between 0 and ${max}, with at most one decimal place.`
						)
					}
					values[field.key] =
						field.key === "extraPercent"
							? Math.round((1 + number / 100) * 1000) / 1000
							: number
				}
				const paid = drafts[id]?.paidPrice
				if (paid !== undefined) {
					const amount = Number(paid)
					if (paid.trim() === "") values.paidPriceCents = null
					else if (
						!Number.isFinite(amount) ||
						amount < 0 ||
						amount > 999999.99 ||
						Math.abs(amount * 100 - Math.round(amount * 100)) >
							0.000001
					)
						throw new Error(
							`${game.title}: paid price must be between 0 and 999999.99 USD, with at most two decimal places.`
						)
					else values.paidPriceCents = Math.round(amount * 100)
				}
				const storeUrl = drafts[id]?.storeUrl
				if (storeUrl !== undefined) {
					const store = getStorefront(storeUrl)
					if (!storeUrl.trim()) values.storeUrl = null
					else if (!store)
						throw new Error(
							`${game.title}: use a Steam, Epic, GOG, App Store, or Google Play game URL.`
						)
					else values.storeUrl = store.url
				}
				if (visibility[id] !== undefined) values.hidden = visibility[id]
				return { id, title: game.title, values }
			})
			const saved = new Set<string>()
			const failed: string[] = []
			for (let start = 0; start < pending.length; start += 5) {
				await Promise.all(
					pending.slice(start, start + 5).map(async (game) => {
						try {
							await apiJson(`entries/${game.id}`, game.values, {
								method: "PATCH"
							})
							saved.add(game.id)
						} catch {
							failed.push(game.title)
						}
					})
				)
			}
			return { saved, failed }
		},
		onSuccess: async ({ saved }) => {
			if (
				saved.size &&
				import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN &&
				import.meta.env.VITE_PUBLIC_POSTHOG_HOST
			)
				posthog.capture("game_ratings_saved", {
					games_saved: saved.size
				})
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["entries"] }),
				queryClient.invalidateQueries({ queryKey: ["public"] }),
				queryClient.invalidateQueries({ queryKey: ["me"] })
			])
			setDrafts((current) =>
				Object.fromEntries(
					Object.entries(current).filter(([id]) => !saved.has(id))
				)
			)
			setVisibility((current) =>
				Object.fromEntries(
					Object.entries(current).filter(([id]) => !saved.has(id))
				)
			)
		}
	})
	const saveButton = editable ? (
		<button
			className="button"
			type="submit"
			form={formId}
			disabled={changedIds.length === 0 || save.isPending}
			aria-label={`Save Changes To ${changedIds.length} Games`}
		>
			{save.isPending
				? "Saving…"
				: changedIds.length
					? `Save (${changedIds.length})`
					: "Save"}
		</button>
	) : null
	return (
		<>
			{editable && (
				<form
					id={formId}
					noValidate
					onSubmit={(event) => {
						event.preventDefault()
						if (changedIds.length && !save.isPending) save.mutate()
					}}
				/>
			)}
			{toolbar ? toolbar(saveButton) : saveButton}
			{children}
			{save.error && (
				<p className={styles.error} role="alert">
					{save.error.message}
				</p>
			)}
			{!!save.data?.failed.length && (
				<p className={styles.error} role="alert">
					Could not save {save.data.failed.slice(0, 3).join(", ")}
					{save.data.failed.length > 3
						? ` and ${save.data.failed.length - 3} more`
						: ""}
					. Those edits are kept; try Save again.
				</p>
			)}
			<div
				className={`${styles.frame} ${className ?? ""}`}
				role="region"
				aria-label={editable ? "Edit Game Ratings" : "Game Ratings"}
			>
				<table className={styles.table}>
					<caption className="sr-only">Game Spectrum Ratings</caption>
					<thead>
						<tr className={styles.groups}>
							<th
								scope="col"
								rowSpan={2}
								className={styles.corner}
							>
								Game
							</th>
							<th
								scope="col"
								rowSpan={2}
								className={styles.score}
							>
								Score
							</th>
							{ratingGroups.map((group) => (
								<Fragment key={group.name}>
									<th
										scope="colgroup"
										colSpan={
											group.fields.length +
											(group.name === "Bonus" ? 0 : 1)
										}
									>
										{group.name}
										{group.name !== "Bonus" && (
											<span>
												{" "}
												/{" "}
												{group.fields.reduce(
													(total, field) =>
														total + field.max,
													0
												)}
											</span>
										)}
									</th>
									{group.name === "Control" && (
										<th
											scope="col"
											rowSpan={2}
											className={styles.total}
										>
											Base Total<span> / 100</span>
										</th>
									)}
								</Fragment>
							))}
							{editable && (
								<th
									scope="col"
									rowSpan={2}
									className={styles.visibility}
								>
									Hidden
								</th>
							)}
							<th
								scope="col"
								rowSpan={2}
								className={styles.hours}
								title="Synced from Steam every 48 hours, or use Sync playtime."
							>
								Hours Played
							</th>
							<th
								scope="col"
								rowSpan={2}
								className={styles.price}
								title={
									editable
										? "US storefront price; updates when viewed, cached for 15 minutes."
										: "Recorded paid amount in USD, or the current storefront price when unset."
								}
							>
								{editable ? "Current Price" : "Price"}
								{editable && (
									<span className={styles.currency}>USD</span>
								)}
							</th>
							{editable && (
								<th
									scope="col"
									rowSpan={2}
									className={styles.paid}
									title="Defaults to the regular store price until edited. Your saved amount is shown on your public profile; otherwise it uses the current price."
								>
									Paid
									<span className={styles.currency}>USD</span>
								</th>
							)}
						</tr>
						<tr>
							{ratingGroups.map((group) => (
								<Fragment key={group.name}>
									{group.fields.map((field) => (
										<th
											scope="col"
											key={field.key}
											className={styles.field}
										>
											<details
												className={styles.help}
												name={`${formId}-rating-help`}
											>
												<summary>
													<span>{field.label}</span>
													<span
														className={styles.limit}
													>
														{field.key ===
														"extraPercent"
															? "10%"
															: field.max}
														<span aria-hidden="true">
															{" "}
															?
														</span>
													</span>
												</summary>
												<p>{field.description}</p>
											</details>
										</th>
									))}
									{group.name !== "Bonus" && (
										<th
											scope="col"
											className={styles.subtotal}
											aria-label={`${group.name} total`}
										>
											Total
										</th>
									)}
								</Fragment>
							))}
						</tr>
					</thead>
					<tbody
						onKeyDown={(event) => {
							const input = event.target
							if (
								!editable ||
								event.defaultPrevented ||
								event.nativeEvent.isComposing ||
								event.altKey ||
								event.ctrlKey ||
								event.metaKey ||
								event.shiftKey ||
								![
									"ArrowUp",
									"ArrowDown",
									"ArrowLeft",
									"ArrowRight"
								].includes(event.key) ||
								!(input instanceof HTMLInputElement) ||
								input.disabled ||
								input.readOnly ||
								!["number", "checkbox"].includes(input.type)
							)
								return
							const cell = input.closest("td")
							const row = cell?.parentElement
							if (!cell || !(row instanceof HTMLTableRowElement))
								return
							// Prevent number inputs from stepping, even at a sheet boundary.
							event.preventDefault()
							const horizontal =
								event.key === "ArrowLeft" ||
								event.key === "ArrowRight"
							const direction =
								event.key === "ArrowLeft" ||
								event.key === "ArrowUp"
									? -1
									: 1
							let rowIndex =
								row.sectionRowIndex +
								(horizontal ? 0 : direction)
							let columnIndex =
								cell.cellIndex + (horizontal ? direction : 0)
							const body = event.currentTarget
							while (
								rowIndex >= 0 &&
								rowIndex < body.rows.length &&
								columnIndex >= 0
							) {
								const nextCell =
									body.rows[rowIndex].cells[columnIndex]
								if (!nextCell) break
								const next =
									nextCell.querySelector<HTMLInputElement>(
										"input[type=number]:not(:disabled):not([readonly]), input[type=checkbox]:not(:disabled):not([readonly])"
									)
								if (next) {
									next.focus({ preventScroll: true })
									if (next.type === "number") next.select()
									// Account for the sticky category headers and game-name column.
									const bounds = next.getBoundingClientRect()
									const top =
										Math.max(
											0,
											body
												.closest("table")
												?.tHead?.getBoundingClientRect()
												.bottom ?? 0
										) + 8
									const left =
										Math.max(
											0,
											body.rows[
												rowIndex
											].cells[0].getBoundingClientRect()
												.right
										) + 8
									const bottom =
										document.documentElement.clientHeight -
										8
									const right =
										document.documentElement.clientWidth - 8
									window.scrollBy({
										top:
											bounds.top < top
												? bounds.top - top
												: bounds.bottom > bottom
													? bounds.bottom - bottom
													: 0,
										left:
											bounds.left < left
												? bounds.left - left
												: bounds.right > right
													? bounds.right - right
													: 0,
										behavior: "instant"
									})
									break
								}
								if (horizontal) columnIndex += direction
								else rowIndex += direction
							}
						}}
					>
						{visibleRows.map((entry) => (
							<SpectrumRow
								key={entry.id}
								entry={entry}
								editable={editable}
								rank={ranks?.[entry.id]}
								draft={drafts[entry.id]}
								hidden={visibility[entry.id]}
								onScoreChange={changeScore}
								onVisibilityChange={changeVisibility}
								formId={formId}
								disabled={save.isPending}
							/>
						))}
					</tbody>
				</table>
			</div>
		</>
	)
}

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Fragment, useCallback, useId, useState, type ReactNode } from "react"
import { apiJson } from "~/lib/api-client"
import { ratingFields, ratingGroups } from "~/lib/scoring"
import type { gameEntries } from "~/server/db/schema"
import ui from "~/styles/ui.module.css"
import { SpectrumRow } from "./spectrum-row"
import styles from "./spectrum-table.module.css"

export type SpectrumGame = Pick<
	typeof gameEntries.$inferSelect,
	| "id"
	| "hidden"
	| "steamAppId"
	| "playtimeMinutes"
	| (typeof ratingFields)[number]["key"]
> &
	Partial<Pick<typeof gameEntries.$inferSelect, "paidPriceCents">> & {
		title: string
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
	const queryClient = useQueryClient()
	const [drafts, setDrafts] = useState<
		Record<
			string,
			Partial<
				Record<
					(typeof ratingFields)[number]["key"] | "paidPrice",
					string
				>
			>
		>
	>({})
	const [visibility, setVisibility] = useState<Record<string, boolean>>({})
	const changeScore = useCallback(
		(
			id: string,
			key: (typeof ratingFields)[number]["key"] | "paidPrice",
			value: string
		) => {
			setDrafts((current) => ({
				...current,
				[id]: { ...current[id], [key]: value }
			}))
		},
		[]
	)
	const changeVisibility = useCallback((id: string, hidden: boolean) => {
		setVisibility((current) => ({ ...current, [id]: hidden }))
	}, [])
	const changedIds = [
		...new Set([...Object.keys(drafts), ...Object.keys(visibility)])
	]
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
				const values: Record<string, number | boolean | null> = {}
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
			className={ui.button}
			type="submit"
			form={formId}
			disabled={changedIds.length === 0 || save.isPending}
			aria-label={`Save changes to ${changedIds.length} games`}
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
				aria-label={editable ? "Edit game ratings" : "Game ratings"}
			>
				<table className={styles.table}>
					<caption className={ui.srOnly}>
						Game Spectrum ratings
					</caption>
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
											Base total<span> / 100</span>
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
								Hours played
							</th>
							<th
								scope="col"
								rowSpan={2}
								className={styles.price}
								title="Steam US price; updates when viewed, cached for 15 minutes."
							>
								Current price
								<span className={styles.currency}>
									USD · Steam
								</span>
							</th>
							{editable && (
								<th
									scope="col"
									rowSpan={2}
									className={styles.paid}
									title="Defaults to the regular Steam price until edited. Paid amounts are private."
								>
									Paid
									<span className={styles.currency}>
										USD · private
									</span>
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
											<details className={styles.help}>
												<summary
													title={field.description}
												>
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
					<tbody>
						{visibleEntries.map((entry) => (
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

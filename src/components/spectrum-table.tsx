import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Fragment, useId, useState } from "react"
import { apiJson } from "~/lib/api-client"
import { calculateScore, ratingFields } from "~/lib/scoring"
import type { gameEntries } from "~/server/db/schema"
import ui from "~/styles/ui.module.css"
import styles from "./spectrum-table.module.css"

export type SpectrumGame = Pick<
	typeof gameEntries.$inferSelect,
	"id" | "hidden" | (typeof ratingFields)[number]["key"]
> & {
	title: string
	coverUrl: string | null
	score: number | null
}

const groups = [...new Set(ratingFields.map((field) => field.group))]

export function SpectrumTable({
	entries,
	editable = false,
	ranks
}: {
	entries: SpectrumGame[]
	editable?: boolean
	ranks?: Record<string, number>
}) {
	const formId = useId()
	const queryClient = useQueryClient()
	const [drafts, setDrafts] = useState<
		Record<
			string,
			Partial<Record<(typeof ratingFields)[number]["key"], string>>
		>
	>({})
	const [visibility, setVisibility] = useState<Record<string, boolean>>({})
	const save = useMutation({
		mutationFn: ({
			id,
			values
		}: {
			id: string
			values: Record<string, number | boolean | null>
		}) => apiJson(`entries/${id}`, values, { method: "PATCH" }),
		onSuccess: async (_, { id }) => {
			await queryClient.invalidateQueries({ queryKey: ["entries"] })
			setDrafts((current) => {
				const next = { ...current }
				delete next[id]
				return next
			})
			setVisibility((current) => {
				const next = { ...current }
				delete next[id]
				return next
			})
		}
	})
	const columns = entries.map((entry) => {
		const values = Object.fromEntries(
			ratingFields.map((field) => {
				const draft = drafts[entry.id]?.[field.key]
				return [
					field.key,
					draft === undefined
						? entry[field.key]
						: draft.trim() === ""
							? null
							: field.key === "extraPercent"
								? Math.round((1 + Number(draft) / 100) * 1000) /
									1000
								: Number(draft)
				]
			})
		)
		return {
			entry,
			values,
			score: calculateScore(values),
			dirty: !!drafts[entry.id] || visibility[entry.id] !== undefined
		}
	})

	return (
		<>
			{save.error && (
				<p className={ui.error} role="alert">
					{save.error.message}
				</p>
			)}
			<div
				className={styles.scroll}
				tabIndex={0}
				role="region"
				aria-label={editable ? "Edit game ratings" : "Game ratings"}
			>
				<table className={styles.table}>
					<caption className={ui.srOnly}>
						Game Spectrum ratings
					</caption>
					<thead>
						<tr>
							<th scope="col" className={styles.corner}>
								Game
							</th>
							{columns.map(({ entry, dirty }) => (
								<th
									scope="col"
									key={entry.id}
									className={styles.game}
								>
									{entry.coverUrl && (
										<img
											src={entry.coverUrl}
											alt=""
											width={208}
											height={78}
											loading="lazy"
										/>
									)}
									<span className={styles.rank}>
										{entry.score === null
											? "Unrated"
											: ranks?.[entry.id]
												? `#${ranks[entry.id]}`
												: ""}
										{entry.hidden ? " / Hidden" : ""}
									</span>
									<strong>{entry.title}</strong>
									{editable && (
										<form
											id={`${formId}-${entry.id}`}
											onSubmit={(event) => {
												event.preventDefault()
												const column = columns.find(
													(item) =>
														item.entry.id ===
														entry.id
												)!
												save.mutate({
													id: entry.id,
													values: {
														...column.values,
														hidden:
															visibility[
																entry.id
															] ?? entry.hidden
													}
												})
											}}
										>
											<button
												className={styles.save}
												disabled={
													!dirty || save.isPending
												}
												type="submit"
												aria-label={`Save ${entry.title} ratings`}
											>
												{save.isPending &&
												save.variables.id === entry.id
													? "Saving…"
													: "Save"}
											</button>
										</form>
									)}
								</th>
							))}
						</tr>
						<tr className={styles.score}>
							<th scope="row">Score</th>
							{columns.map(({ entry, score }) => (
								<td key={entry.id}>
									{score === null
										? "Unrated"
										: score.toFixed(1)}
								</td>
							))}
						</tr>
					</thead>
					<tbody>
						{groups.map((group) => {
							const fields = ratingFields.filter(
								(field) => field.group === group
							)
							return (
								<Fragment key={group}>
									<tr className={styles.group}>
										<th scope="row">
											{group}
											<span>
												{group !== "Bonus"
													? fields.reduce(
															(total, field) =>
																total +
																field.max,
															0
														)
													: ""}
											</span>
										</th>
										{columns.map(({ entry, values }) => (
											<td key={entry.id}>
												{group !== "Bonus" &&
												fields.every(
													(field) =>
														values[field.key] !==
														null
												)
													? fields
															.reduce(
																(
																	total,
																	field
																) =>
																	total +
																	Number(
																		values[
																			field
																				.key
																		]
																	),
																0
															)
															.toFixed(1)
													: ""}
											</td>
										))}
									</tr>
									{fields.map((field) => (
										<tr key={field.key}>
											<th scope="row">
												<div className={styles.label}>
													<span>{field.label}</span>
													<span
														className={styles.limit}
													>
														{field.key ===
														"extraPercent"
															? "10%"
															: field.max}
													</span>
													<details
														className={styles.help}
													>
														<summary
															aria-label={`About ${field.label}`}
														>
															?
														</summary>
														<p>
															{field.description}
														</p>
													</details>
												</div>
											</th>
											{columns.map(({ entry }) => {
												const stored = entry[field.key]
												const value =
													drafts[entry.id]?.[
														field.key
													] ??
													(stored === null
														? ""
														: field.key ===
															  "extraPercent"
															? String(
																	Math.round(
																		(stored -
																			1) *
																			1000
																	) / 10
																)
															: String(stored))
												return (
													<td key={entry.id}>
														{editable ? (
															<input
																form={`${formId}-${entry.id}`}
																aria-label={`${entry.title}: ${field.label}`}
																type="number"
																min={0}
																max={
																	field.key ===
																	"extraPercent"
																		? 10
																		: field.max
																}
																step="0.1"
																value={value}
																disabled={
																	save.isPending
																}
																onChange={(
																	event
																) => {
																	const next =
																		event
																			.target
																			.value
																	setDrafts(
																		(
																			current
																		) => ({
																			...current,
																			[entry.id]:
																				{
																					...current[
																						entry
																							.id
																					],
																					[field.key]:
																						next
																				}
																		})
																	)
																}}
															/>
														) : (
															<span
																className={
																	styles.value
																}
															>
																{value === ""
																	? "—"
																	: `${value}${field.key === "extraPercent" ? "%" : ""}`}
															</span>
														)}
													</td>
												)
											})}
										</tr>
									))}
									{group === "Control" && (
										<tr className={styles.total}>
											<th scope="row">
												Total <span>100</span>
											</th>
											{columns.map(
												({ entry, values }) => (
													<td key={entry.id}>
														{ratingFields
															.slice(0, 13)
															.every(
																(field) =>
																	values[
																		field
																			.key
																	] !== null
															)
															? ratingFields
																	.slice(
																		0,
																		13
																	)
																	.reduce(
																		(
																			sum,
																			field
																		) =>
																			sum +
																			Number(
																				values[
																					field
																						.key
																				]
																			),
																		0
																	)
																	.toFixed(1)
															: ""}
													</td>
												)
											)}
										</tr>
									)}
								</Fragment>
							)
						})}
						{editable && (
							<tr className={styles.visibility}>
								<th scope="row">Hidden</th>
								{columns.map(({ entry }) => (
									<td key={entry.id}>
										<input
											form={`${formId}-${entry.id}`}
											type="checkbox"
											checked={
												visibility[entry.id] ??
												entry.hidden
											}
											aria-label={`Hide ${entry.title}`}
											disabled={save.isPending}
											onChange={(event) =>
												setVisibility((current) => ({
													...current,
													[entry.id]:
														event.target.checked
												}))
											}
										/>
									</td>
								))}
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</>
	)
}

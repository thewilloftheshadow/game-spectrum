import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Fragment, memo, useId } from "react"
import { apiJson } from "~/lib/api-client"
import { calculateScore, ratingFields, ratingGroups } from "~/lib/scoring"
import type { SpectrumGame } from "./spectrum-table"
import styles from "./spectrum-table.module.css"

export const SpectrumRow = memo(function SpectrumRow({
	entry,
	editable,
	rank,
	draft = {},
	hidden,
	onScoreChange,
	onVisibilityChange,
	onSaved
}: {
	entry: SpectrumGame
	editable: boolean
	rank?: number
	draft?: Partial<Record<(typeof ratingFields)[number]["key"], string>>
	hidden?: boolean
	onScoreChange: (
		id: string,
		key: (typeof ratingFields)[number]["key"],
		value: string
	) => void
	onVisibilityChange: (id: string, hidden: boolean) => void
	onSaved: (id: string) => void
}) {
	const formId = useId()
	const queryClient = useQueryClient()
	const values = Object.fromEntries(
		ratingFields.map((field) => {
			const value = draft[field.key]
			return [
				field.key,
				value === undefined
					? entry[field.key]
					: value.trim() === ""
						? null
						: field.key === "extraPercent"
							? Math.round((1 + Number(value) / 100) * 1000) /
								1000
							: Number(value)
			]
		})
	)
	const score = calculateScore(values)
	const dirty = Object.keys(draft).length > 0 || hidden !== undefined
	const save = useMutation({
		mutationFn: () =>
			apiJson(
				`entries/${entry.id}`,
				{ ...values, hidden: hidden ?? entry.hidden },
				{ method: "PATCH" }
			),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["entries"] })
			onSaved(entry.id)
		}
	})
	return (
		<tr>
			<th scope="row" className={styles.game}>
				<div className={styles.identity}>
					{entry.coverUrl && (
						<img
							src={entry.coverUrl}
							alt=""
							width={48}
							height={36}
							loading="lazy"
						/>
					)}
					<div>
						<strong>{entry.title}</strong>
						<div className={styles.meta}>
							<span>
								{[
									entry.score === null
										? "Unrated"
										: rank
											? `#${rank}`
											: "",
									entry.hidden ? "Hidden" : ""
								]
									.filter(Boolean)
									.join(" / ")}
							</span>
							{editable && (
								<form
									id={formId}
									onSubmit={(event) => {
										event.preventDefault()
										save.mutate()
									}}
								>
									<button
										className={styles.save}
										disabled={!dirty || save.isPending}
										type="submit"
										aria-label={`Save ${entry.title} ratings`}
									>
										{save.isPending ? "Saving…" : "Save"}
									</button>
								</form>
							)}
						</div>
					</div>
				</div>
				{save.error && (
					<p className={styles.error} role="alert">
						{save.error.message}
					</p>
				)}
			</th>
			<td className={styles.score}>
				{score === null ? "Unrated" : score.toFixed(1)}
			</td>
			{ratingGroups.map((group) => (
				<Fragment key={group.name}>
					{group.fields.map((field) => {
						const stored = entry[field.key]
						const value =
							draft[field.key] ??
							(stored === null
								? ""
								: field.key === "extraPercent"
									? String(
											Math.round((stored - 1) * 1000) / 10
										)
									: String(stored))
						return (
							<td key={field.key}>
								{editable ? (
									<input
										form={formId}
										aria-label={`${entry.title}: ${field.label}`}
										type="number"
										min={0}
										max={
											field.key === "extraPercent"
												? 10
												: field.max
										}
										step="0.1"
										value={value}
										disabled={save.isPending}
										onChange={(event) =>
											onScoreChange(
												entry.id,
												field.key,
												event.target.value
											)
										}
									/>
								) : (
									<span className={styles.value}>
										{value === ""
											? "—"
											: `${value}${field.key === "extraPercent" ? "%" : ""}`}
									</span>
								)}
							</td>
						)
					})}
					{group.name !== "Bonus" && (
						<td className={styles.subtotal}>
							{group.fields.every(
								(field) => values[field.key] !== null
							)
								? group.fields
										.reduce(
											(sum, field) =>
												sum + Number(values[field.key]),
											0
										)
										.toFixed(1)
								: "—"}
						</td>
					)}
					{group.name === "Control" && (
						<td className={styles.total}>
							{ratingFields
								.slice(0, 13)
								.every((field) => values[field.key] !== null)
								? ratingFields
										.slice(0, 13)
										.reduce(
											(sum, field) =>
												sum + Number(values[field.key]),
											0
										)
										.toFixed(1)
								: "—"}
						</td>
					)}
				</Fragment>
			))}
			{editable && (
				<td className={styles.visibility}>
					<input
						form={formId}
						type="checkbox"
						checked={hidden ?? entry.hidden}
						aria-label={`Hide ${entry.title}`}
						disabled={save.isPending}
						onChange={(event) =>
							onVisibilityChange(entry.id, event.target.checked)
						}
					/>
				</td>
			)}
		</tr>
	)
})

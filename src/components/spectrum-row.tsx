import { Fragment, memo } from "react"
import { Image } from "~/components/image"
import { Link } from "~/components/link"
import { calculateScore, ratingFields, ratingGroups } from "~/lib/scoring"
import { getStorefront } from "~/lib/storefront"
import type { SpectrumGame } from "./spectrum-table"
import { SpectrumPrices } from "./spectrum-prices"
import styles from "./spectrum-table.module.css"

export const SpectrumRow = memo(function SpectrumRow({
	entry,
	editable,
	rank,
	draft = {},
	hidden,
	onScoreChange,
	onVisibilityChange,
	formId,
	disabled
}: {
	entry: SpectrumGame
	editable: boolean
	rank?: number
	draft?: Partial<
		Record<
			(typeof ratingFields)[number]["key"] | "paidPrice" | "storeUrl",
			string
		>
	>
	hidden?: boolean
	onScoreChange: (
		id: string,
		key: (typeof ratingFields)[number]["key"] | "paidPrice" | "storeUrl",
		value: string
	) => void
	onVisibilityChange: (id: string, hidden: boolean) => void
	formId: string
	disabled: boolean
}) {
	const values = Object.fromEntries(
		ratingFields.map((field) => {
			const value = draft[field.key]
			return [
				field.key,
				value === undefined
					? (entry[field.key] ??
						("defaultValue" in field ? field.defaultValue : null))
					: value.trim() === ""
						? "defaultValue" in field
							? field.defaultValue
							: null
						: field.key === "extraPercent"
							? Math.round((1 + Number(value) / 100) * 1000) /
								1000
							: Number(value)
			]
		})
	)
	const score = calculateScore(values)
	const store = getStorefront(
		draft.storeUrl ??
			entry.storeUrl ??
			(entry.steamAppId
				? `https://store.steampowered.com/app/${entry.steamAppId}/`
				: null)
	)
	return (
		<tr>
			<th scope="row" className={styles.game}>
				<div className={styles.identity}>
					{entry.coverUrl && (
						<Image
							src={entry.coverUrl}
							alt=""
							width={48}
							height={36}
							loading="lazy"
						/>
					)}
					<div>
						<strong>
							{store ? (
								<Link
									className={styles.storeTitle}
									href={store.url}
									target="_blank"
								>
									{entry.title}
								</Link>
							) : (
								entry.title
							)}
						</strong>
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
							{editable ? (
								<details
									className={styles.storePicker}
									name={`${formId}-rating-help`}
								>
									<summary
										aria-label={`Store Link For ${entry.title}`}
									>
										{store?.label ?? "Add Store"}
									</summary>
									<div>
										<label>
											Store Link
											<input
												form={formId}
												type="url"
												value={
													draft.storeUrl ??
													entry.storeUrl ??
													store?.url ??
													""
												}
												placeholder="Paste The Game's Store URL"
												disabled={disabled}
												aria-label={`${entry.title}: store URL`}
												onChange={(event) =>
													onScoreChange(
														entry.id,
														"storeUrl",
														event.target.value
													)
												}
											/>
										</label>
										<p>
											Steam, Epic, GOG, App Store, or
											Google Play. Use Save above to keep
											this link.
										</p>
									</div>
								</details>
							) : (
								store && <span>{store.label}</span>
							)}
						</div>
					</div>
				</div>
			</th>
			<td className={styles.score}>
				{score === null ? "Unrated" : score.toFixed(1)}
			</td>
			{ratingGroups.map((group) => (
				<Fragment key={group.name}>
					{group.fields.map((field) => {
						const stored =
							entry[field.key] ??
							("defaultValue" in field
								? field.defaultValue
								: null)
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
										disabled={disabled}
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
						disabled={disabled}
						onChange={(event) =>
							onVisibilityChange(entry.id, event.target.checked)
						}
					/>
				</td>
			)}
			<td
				className={styles.hours}
				title={
					entry.playtimeMinutes == null
						? "Steam playtime unavailable"
						: `${entry.playtimeMinutes.toLocaleString()} minutes on Steam`
				}
			>
				{entry.playtimeMinutes == null
					? "—"
					: (entry.playtimeMinutes / 60).toFixed(1)}
			</td>
			<SpectrumPrices
				entry={entry}
				storeUrl={store?.url ?? null}
				editable={editable}
				draft={draft.paidPrice}
				onChange={onScoreChange}
				formId={formId}
				disabled={disabled}
			/>
		</tr>
	)
})

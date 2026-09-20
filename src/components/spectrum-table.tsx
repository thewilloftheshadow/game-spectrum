import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import { ratingFields, ratingGroups } from "~/lib/scoring"
import type { gameEntries } from "~/server/db/schema"
import ui from "~/styles/ui.module.css"
import { SpectrumRow } from "./spectrum-row"
import styles from "./spectrum-table.module.css"

export type SpectrumGame = Pick<
	typeof gameEntries.$inferSelect,
	"id" | "hidden" | (typeof ratingFields)[number]["key"]
> & {
	title: string
	coverUrl: string | null
	score: number | null
}

export function SpectrumTable({
	entries,
	editable = false,
	ranks
}: {
	entries: SpectrumGame[]
	editable?: boolean
	ranks?: Record<string, number>
}) {
	const [drafts, setDrafts] = useState<
		Record<
			string,
			Partial<Record<(typeof ratingFields)[number]["key"], string>>
		>
	>({})
	const [visibility, setVisibility] = useState<Record<string, boolean>>({})
	const changeScore = useCallback(
		(
			id: string,
			key: (typeof ratingFields)[number]["key"],
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
	const clearDraft = useCallback((id: string) => {
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
	}, [])
	const scrollRef = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const element = scrollRef.current
		if (!element) return
		// Explicit handoff also handles browsers that latch a wheel gesture to the sheet.
		const handoff = (event: WheelEvent) => {
			if (
				!event.cancelable ||
				event.ctrlKey ||
				event.metaKey ||
				event.shiftKey ||
				Math.abs(event.deltaX) >= Math.abs(event.deltaY)
			)
				return
			const atBottom =
				element.scrollTop + element.clientHeight >=
				element.scrollHeight - 1
			const atTop = element.scrollTop <= 0
			if (
				!((event.deltaY > 0 && atBottom) || (event.deltaY < 0 && atTop))
			)
				return
			const pageEnd =
				document.documentElement.scrollHeight - window.innerHeight
			if (
				event.deltaY > 0
					? window.scrollY >= pageEnd
					: window.scrollY <= 0
			)
				return
			const unit =
				event.deltaMode === 1
					? parseFloat(getComputedStyle(element).lineHeight) || 16
					: event.deltaMode === 2
						? element.clientHeight
						: 1
			event.preventDefault()
			window.scrollBy({ top: event.deltaY * unit, behavior: "instant" })
		}
		element.addEventListener("wheel", handoff, { passive: false })
		return () => element.removeEventListener("wheel", handoff)
	}, [])
	return (
		<div
			ref={scrollRef}
			className={styles.scroll}
			tabIndex={0}
			role="region"
			aria-label={editable ? "Edit game ratings" : "Game ratings"}
		>
			<table className={styles.table}>
				<caption className={ui.srOnly}>Game Spectrum ratings</caption>
				<thead>
					<tr className={styles.groups}>
						<th scope="col" rowSpan={2} className={styles.corner}>
							Game
						</th>
						<th scope="col" rowSpan={2} className={styles.score}>
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
											<summary title={field.description}>
												<span>{field.label}</span>
												<span className={styles.limit}>
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
					{entries.map((entry) => (
						<SpectrumRow
							key={entry.id}
							entry={entry}
							editable={editable}
							rank={ranks?.[entry.id]}
							draft={drafts[entry.id]}
							hidden={visibility[entry.id]}
							onScoreChange={changeScore}
							onVisibilityChange={changeVisibility}
							onSaved={clearDraft}
						/>
					))}
				</tbody>
			</table>
		</div>
	)
}

import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { apiQueryOptions } from "~/lib/api-client"
import type { getSteamPrice } from "~/server/api/prices"
import type { SpectrumGame } from "./spectrum-table"
import styles from "./spectrum-table.module.css"

export function SpectrumPrices({
	entry,
	editable,
	draft,
	onChange,
	formId,
	disabled
}: {
	entry: SpectrumGame
	editable: boolean
	draft?: string
	onChange: (id: string, key: "paidPrice", value: string) => void
	formId: string
	disabled: boolean
}) {
	const cell = useRef<HTMLTableCellElement>(null)
	const [nearViewport, setNearViewport] = useState(false)
	useEffect(() => {
		if (!entry.steamAppId || !cell.current) return
		if (!("IntersectionObserver" in window)) {
			setNearViewport(true)
			return
		}
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setNearViewport(true)
					observer.disconnect()
				}
			},
			{ rootMargin: "400px" }
		)
		observer.observe(cell.current)
		return () => observer.disconnect()
	}, [entry.steamAppId])
	const query = useQuery({
		...apiQueryOptions<{ data: Awaited<ReturnType<typeof getSteamPrice>> }>(
			["steam-price", entry.steamAppId, "US"],
			`games/prices/${entry.steamAppId}`
		),
		enabled: !!entry.steamAppId && nearViewport,
		staleTime: 15 * 60_000,
		retry: false,
		refetchOnWindowFocus: false
	})
	const price = query.data?.data
	const paid = entry.paidPriceCents ?? price?.regular
	return (
		<>
			<td
				ref={cell}
				className={styles.price}
				aria-busy={query.isFetching}
				title={
					price
						? `Steam US price, checked ${new Date(price.checkedAt).toLocaleString()}`
						: "Steam US price unavailable"
				}
			>
				{price ? (
					<a
						href={`https://store.steampowered.com/app/${entry.steamAppId}/`}
						target="_blank"
						rel="noreferrer"
						aria-label={`${entry.title} on Steam: ${price.current === 0 ? "free" : `$${(price.current / 100).toFixed(2)}`}`}
					>
						{price.current < price.regular && (
							<s>${(price.regular / 100).toFixed(2)}</s>
						)}
						<span
							className={
								price.current < price.regular
									? styles.sale
									: undefined
							}
						>
							{price.current === 0
								? "Free"
								: `$${(price.current / 100).toFixed(2)}`}
						</span>
					</a>
				) : query.isFetching ? (
					"…"
				) : query.isError ? (
					<button
						className={styles.priceRetry}
						type="button"
						onClick={() => query.refetch()}
						aria-label={`Retry price for ${entry.title}`}
					>
						Retry price
					</button>
				) : (
					"—"
				)}
			</td>
			{editable && (
				<td className={styles.paid}>
					<input
						form={formId}
						type="number"
						min="0"
						max="999999.99"
						step="0.01"
						inputMode="decimal"
						aria-label={`${entry.title}: paid price in USD`}
						title={
							entry.paidPriceCents == null && draft === undefined
								? "Default: regular Steam price, not your purchase history. Enter what you paid; clear to reset."
								: "Amount you paid in USD. Clear to reset to the regular Steam price."
						}
						value={
							draft ??
							(paid == null ? "" : (paid / 100).toFixed(2))
						}
						placeholder="—"
						disabled={disabled}
						onChange={(event) =>
							onChange(entry.id, "paidPrice", event.target.value)
						}
					/>
				</td>
			)}
		</>
	)
}

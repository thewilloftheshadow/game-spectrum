import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { apiQueryOptions } from "~/lib/api-client"
import { getStorefront } from "~/lib/storefront"
import type { getStorePrice } from "~/server/api/prices"
import type { SpectrumGame } from "./spectrum-table"
import styles from "./spectrum-table.module.css"

export function SpectrumPrices({
	entry,
	storeUrl,
	editable,
	draft,
	onChange,
	formId,
	disabled
}: {
	entry: SpectrumGame
	storeUrl: string | null
	editable: boolean
	draft?: string
	onChange: (id: string, key: "paidPrice", value: string) => void
	formId: string
	disabled: boolean
}) {
	const cell = useRef<HTMLTableCellElement>(null)
	const [nearViewport, setNearViewport] = useState(false)
	const store = getStorefront(storeUrl)
	const needsPrice = editable || entry.paidPriceCents == null
	useEffect(() => {
		if (!storeUrl || !needsPrice || !cell.current) return
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
	}, [storeUrl, needsPrice])
	const query = useQuery({
		...apiQueryOptions<{ data: Awaited<ReturnType<typeof getStorePrice>> }>(
			["store-price", store?.url, "US"],
			`games/prices/store?url=${encodeURIComponent(store?.url ?? "")}`
		),
		enabled: !!store && nearViewport && needsPrice,
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
					!editable && entry.paidPriceCents != null
						? "Recorded paid amount (USD)"
						: price
							? `${store?.label} US price, checked ${new Date(price.checkedAt).toLocaleString()}`
							: "Current store price unavailable"
				}
			>
				{!editable && entry.paidPriceCents != null ? (
					`$${(entry.paidPriceCents / 100).toFixed(2)}`
				) : price ? (
					editable && store ? (
						<a
							href={store.url}
							target="_blank"
							rel="noreferrer"
							aria-label={`${entry.title} on ${store.label}: ${price.current === 0 ? "free" : `$${(price.current / 100).toFixed(2)}`}`}
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
					) : (
						`$${(price.current / 100).toFixed(2)}`
					)
				) : query.isFetching ? (
					"…"
				) : query.isError && editable ? (
					<button
						className={styles.priceRetry}
						type="button"
						onClick={() => query.refetch()}
						aria-label={`Retry Price For ${entry.title}`}
					>
						Retry Price
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
						aria-label={`${entry.title}: Paid Price In USD`}
						title={
							entry.paidPriceCents == null && draft === undefined
								? "Default: regular store price, not your purchase history. Enter what you paid to show it publicly; otherwise your profile uses the current store price."
								: "Amount you paid in USD, shown on your public profile. Clear to use the current store price there."
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

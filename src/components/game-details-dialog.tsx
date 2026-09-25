import { Dialog } from "@base-ui/react/dialog"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Image } from "~/components/image"
import { apiClient } from "~/lib/api-client"
import type { SpectrumGame } from "./spectrum-table"
import styles from "./spectrum-table.module.css"

export function GameDetailsDialog({
	disabled,
	draft = {},
	entry,
	formId,
	onChange,
	storeLabel,
	storeUrl
}: {
	disabled: boolean
	draft?: Partial<Record<"paidPrice" | "storeUrl" | "title", string>>
	entry: SpectrumGame
	formId: string
	onChange: (
		id: string,
		key: "paidPrice" | "storeUrl" | "title",
		value: string
	) => void
	storeLabel?: string
	storeUrl?: string
}) {
	const queryClient = useQueryClient()
	const upload = useMutation({
		mutationFn: (file: File) => {
			const body = new FormData()
			body.set("art", file)
			return apiClient<{ data: { coverUrl: string } }>(
				`entries/${entry.id}/art`,
				{ body, method: "POST" }
			)
		},
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["entries"] }),
				queryClient.invalidateQueries({ queryKey: ["public"] })
			])
		}
	})
	const reset = useMutation({
		mutationFn: () =>
			apiClient<{ data: { ok: true } }>(`entries/${entry.id}/art`, {
				method: "DELETE"
			}),
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["entries"] }),
				queryClient.invalidateQueries({ queryKey: ["public"] })
			])
		}
	})
	const artPending = upload.isPending || reset.isPending
	const paid =
		draft.paidPrice ??
		(entry.paidPriceCents == null
			? ""
			: (entry.paidPriceCents / 100).toFixed(2))

	return (
		<Dialog.Root>
			<Dialog.Trigger
				className={styles.detailsTrigger}
				disabled={disabled}
			>
				Edit Details
			</Dialog.Trigger>
			<Dialog.Portal>
				<Dialog.Backdrop className={styles.dialogBackdrop} />
				<Dialog.Popup className={styles.dialogPopup}>
					<div className={styles.dialogHeader}>
						<Dialog.Title className={styles.dialogTitle}>
							Game Details
						</Dialog.Title>
						<Dialog.Close className="quiet">Close</Dialog.Close>
					</div>
					<Dialog.Description className={styles.dialogDescription}>
						Customize the public details for {entry.title}.
					</Dialog.Description>
					<div className={styles.dialogFields}>
						<label className="field">
							Display Name
							<input
								className="input"
								form={formId}
								maxLength={120}
								value={draft.title ?? entry.title}
								disabled={disabled}
								onChange={(event) =>
									onChange(
										entry.id,
										"title",
										event.target.value
									)
								}
							/>
						</label>
						<label className="field">
							Store Link
							<input
								className="input"
								form={formId}
								type="url"
								value={
									draft.storeUrl ??
									entry.storeUrl ??
									storeUrl ??
									""
								}
								placeholder="Paste the game's store URL"
								disabled={disabled}
								onChange={(event) =>
									onChange(
										entry.id,
										"storeUrl",
										event.target.value
									)
								}
							/>
							<span className="status">
								{storeLabel
									? `Linked to ${storeLabel}`
									: "Steam, Epic, GOG, App Store, or Google Play."}
							</span>
						</label>
						<label className="field">
							Paid Price
							<input
								className="input"
								form={formId}
								type="number"
								min="0"
								max="999999.99"
								step="0.01"
								inputMode="decimal"
								value={paid}
								placeholder="Use current store price"
								disabled={disabled}
								onChange={(event) =>
									onChange(
										entry.id,
										"paidPrice",
										event.target.value
									)
								}
							/>
							<span className="status">
								Shown on your public profile. Clear to use
								current price.
							</span>
						</label>
						<label className="field">
							Game Artwork
							<div className={styles.artField}>
								{(upload.data?.data.coverUrl ??
									entry.coverUrl) && (
									<Image
										className={styles.artPreview}
										src={
											upload.data?.data.coverUrl ??
											entry.coverUrl ??
											""
										}
										alt=""
										width={96}
										height={58}
									/>
								)}
								<input
									className="input"
									type="file"
									accept="image/png,image/jpeg,image/webp,image/gif"
									disabled={disabled || artPending}
									onChange={(event) => {
										const file =
											event.currentTarget.files?.[0]
										if (file) upload.mutate(file)
										event.currentTarget.value = ""
									}}
								/>
								{entry.customCoverUrl && (
									<button
										className="quiet"
										type="button"
										disabled={disabled || artPending}
										onClick={() => reset.mutate()}
									>
										Reset Art
									</button>
								)}
							</div>
							<span className="status" role="status">
								{upload.isPending
									? "Uploading artwork…"
									: upload.isSuccess
										? "Artwork uploaded"
										: reset.isSuccess
											? "Artwork reset"
											: "PNG, JPG, WebP, or GIF. Max 6 MB."}
							</span>
							{(upload.error || reset.error) && (
								<span className="error" role="alert">
									{upload.error?.message ??
										reset.error?.message}
								</span>
							)}
						</label>
					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	)
}

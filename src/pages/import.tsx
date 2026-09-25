import { usePostHog } from "@posthog/react"
import {
	skipToken,
	useMutation,
	useMutationState,
	useQuery,
	useQueryClient
} from "@tanstack/react-query"
import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { PlatformIcon } from "~/components/platform-icon"
import { apiJson, apiQueryOptions } from "~/lib/api-client"
import { authClient } from "~/lib/auth-client"
import { posthogLogger } from "~/lib/posthog-logger"
import type { getConnectedAccounts } from "~/server/api/accounts"
import styles from "./import.module.css"

const initialProgress = {
	imported: 0,
	processed: 0,
	total: 0,
	status: "idle",
	error: ""
}

export function meta() {
	return [{ title: "Import Library | Game Spectrum" }]
}

export default function ImportPage() {
	const posthog = usePostHog()
	const queryClient = useQueryClient()
	const [params] = useSearchParams()
	const [connecting, setConnecting] = useState(false)
	const [connectionError, setConnectionError] = useState("")
	const accounts = useQuery({
		...apiQueryOptions<{
			data: Awaited<ReturnType<typeof getConnectedAccounts>>
		}>(["accounts"], "accounts"),
		staleTime: 60_000
	})
	const steam = accounts.data?.data.find(
		(account) => account.providerId === "steam"
	)
	const { data: progress = initialProgress } = useQuery({
		queryKey: ["steam-import-progress"],
		queryFn: skipToken,
		initialData: initialProgress,
		gcTime: Infinity
	})
	const pending =
		useMutationState({
			filters: { mutationKey: ["steam-import"], status: "pending" },
			select: () => true
		}).length > 0
	const importSteam = useMutation({
		mutationKey: ["steam-import"],
		retry: false,
		mutationFn: async () => {
			queryClient.setQueryData(["steam-import-progress"], {
				...initialProgress,
				status: "running"
			})
			let offset = 0
			let imported = 0
			while (true) {
				const { data } = await apiJson<{
					data: {
						imported: number
						processed: number
						total: number
						nextOffset: number | null
					}
				}>("steam/import", { offset })
				imported += data.imported
				queryClient.setQueryData(["steam-import-progress"], {
					imported,
					processed: data.processed,
					total: data.total,
					status: "running",
					error: ""
				})
				await queryClient.invalidateQueries({ queryKey: ["entries"] })
				if (data.nextOffset === null)
					return {
						imported,
						processed: data.processed,
						total: data.total
					}
				if (data.nextOffset <= offset)
					throw new Error("Import interrupted. Please try again.")
				offset = data.nextOffset
			}
		},
		onSuccess: ({ imported, processed, total }) => {
			if (
				import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN &&
				import.meta.env.VITE_PUBLIC_POSTHOG_HOST
			)
				posthog.capture("steam_library_imported", {
					games_imported: imported,
					games_processed: processed,
					library_size: total
				})
			posthogLogger.info("steam library import completed", {
				games_imported: imported,
				games_processed: processed,
				library_size: total
			})
			queryClient.setQueryData<typeof initialProgress>(
				["steam-import-progress"],
				(current) => ({
					...(current ?? initialProgress),
					status: "complete"
				})
			)
		},
		onError: (error) => {
			queryClient.setQueryData<typeof initialProgress>(
				["steam-import-progress"],
				(current) => ({
					...(current ?? initialProgress),
					status: "error",
					error: error.message
				})
			)
		},
		onSettled: () =>
			Promise.all([
				queryClient.invalidateQueries({ queryKey: ["entries"] }),
				queryClient.invalidateQueries({ queryKey: ["me"] }),
				queryClient.invalidateQueries({ queryKey: ["public"] })
			])
	})
	return (
		<main id="main" className="page narrow">
			<div className="heading">
				<h1 className="title">Import Library</h1>
				<Link to="/dashboard" className="secondary">
					My Library
				</Link>
			</div>
			<section className={styles.source}>
				<PlatformIcon provider="steam" />
				<div>
					<h2>Steam</h2>
					{steam ? (
						<p>
							{steam.details?.name ||
								`Steam ID: ${steam.accountId}`}
						</p>
					) : (
						<p>
							{accounts.isPending
								? "Loading…"
								: accounts.error
									? "Account unavailable"
									: "Not connected"}
						</p>
					)}
				</div>
			</section>
			{accounts.error && (
				<p className="error" role="alert">
					{accounts.error.message}
				</p>
			)}
			{(connectionError || params.has("error")) && (
				<p className="error" role="alert">
					{connectionError ||
						"Unable to connect Steam. Please try again."}
				</p>
			)}
			{progress.status !== "idle" && (
				<section
					className={styles.progress}
					aria-label="Steam Import Progress"
				>
					<progress
						aria-label="Games Checked"
						max={Math.max(progress.total, 1)}
						value={
							pending && progress.total === 0
								? undefined
								: progress.processed
						}
					/>
					<div
						className={styles.counts}
						role="status"
						aria-live="polite"
					>
						<span>
							{pending && progress.total === 0
								? "Loading Steam Library…"
								: `${progress.processed} / ${progress.total} games checked`}
						</span>
						<span>{progress.imported} Imported</span>
					</div>
					{pending && (
						<p className="status">
							You can use your library while this runs. Keep this
							tab open.
						</p>
					)}
					{progress.status === "complete" && (
						<p role="status">
							{progress.total === 0
								? "Your Steam library is empty."
								: "Import complete."}
						</p>
					)}
					{progress.error && (
						<p className="error" role="alert">
							{progress.error}
						</p>
					)}
				</section>
			)}
			<div className="actions">
				{steam ? (
					<button
						className="button"
						disabled={pending}
						onClick={() => importSteam.mutate()}
					>
						{pending
							? "Importing…"
							: progress.status === "error"
								? "Retry Import"
								: progress.status === "complete"
									? "Import Again"
									: "Import Library"}
					</button>
				) : (
					<button
						className="button"
						disabled={
							connecting || accounts.isPending || !!accounts.error
						}
						onClick={async () => {
							setConnecting(true)
							setConnectionError("")
							try {
								const result = await authClient.steam.link({
									callbackURL: "/import",
									errorCallbackURL: "/import"
								})
								if (result.error)
									throw new Error(
										result.error.message ||
											"Unable to connect Steam."
									)
							} catch (error) {
								setConnectionError(
									error instanceof Error
										? error.message
										: "Unable to connect Steam."
								)
							} finally {
								setConnecting(false)
							}
						}}
					>
						{connecting ? "Connecting…" : "Connect Steam"}
					</button>
				)}
			</div>
		</main>
	)
}

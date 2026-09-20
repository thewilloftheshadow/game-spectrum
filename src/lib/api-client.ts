import { queryOptions } from "@tanstack/react-query"

export async function apiClient<TData = unknown>(
	path: string,
	init?: RequestInit
) {
	const headers = new Headers(init?.headers)
	headers.set("accept", "application/json")

	const response = await fetch(path.startsWith("/") ? path : `/api/${path}`, {
		...init,
		headers
	})
	const data = await response.json().catch(() => null)

	if (!response.ok) {
		if (data && typeof data === "object" && "error" in data) {
			const error = data.error

			if (
				error &&
				typeof error === "object" &&
				"message" in error &&
				typeof error.message === "string"
			) {
				throw new Error(error.message)
			}
		}

		throw new Error(`Request failed with ${response.status}`)
	}

	return data as TData
}

export function apiJson<TData = unknown>(
	path: string,
	body?: unknown,
	init?: RequestInit
) {
	const headers = new Headers(init?.headers)
	headers.set("content-type", "application/json")

	return apiClient<TData>(path, {
		...init,
		body: JSON.stringify(body),
		headers,
		method: init?.method ?? "POST"
	})
}

export const apiQueryOptions = <TData = unknown>(
	queryKey: readonly unknown[],
	path: string,
	init?: RequestInit
) =>
	queryOptions({
		queryKey,
		queryFn: () => apiClient<TData>(path, init)
	})

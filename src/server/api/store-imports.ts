import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"
import { getDb } from "../db"
import { gameEntries, games } from "../db/schema"
import { type ApiEnv, jsonError, requireSession, slugify } from "./context"

const gogClientId = "46899977096215655"
const gogClientSecret =
	"9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9"
const gogRedirectUri = "https://embed.gog.com/on_login_success?origin=client"
const epicClientId = "34a02cf8f4414e29b15921876da36f9a"
const epicClientSecret = "daafbccc737745039dffe53d94fc76cf"
const epicUserAgent =
	"UELauncher/11.0.1-14907503+++Portal+Release-Live Windows/10.0.19041.1.256.64bit"

const codePayload = z.object({ code: z.string().min(1).max(5000) })

const normalize = (value: string) =>
	value
		.replace(/[™®]/g, "")
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim()

const extractCode = (value: string) => {
	const trimmed = value.trim()
	try {
		const parsed = JSON.parse(trimmed) as Record<string, unknown>
		const code = parsed.code ?? parsed.authorizationCode
		if (typeof code === "string" && code.trim()) return code.trim()
	} catch {
		// Try URL/plain text formats below.
	}
	try {
		const url = new URL(trimmed)
		const code =
			url.searchParams.get("code") ??
			url.searchParams.get("authorizationCode")
		if (code?.trim()) return code.trim()
	} catch {
		// Plain code.
	}
	return trimmed
}

const stringValue = (value: unknown) =>
	typeof value === "string" && value.trim() ? value.trim() : null

const imageUrl = (value: unknown) => {
	const url = stringValue(value)
	if (!url) return null
	if (url.startsWith("//")) return `https:${url}`
	return url.startsWith("http") ? url : null
}

const importEntries = async (
	env: Cloudflare.Env,
	userId: string,
	entries: {
		title: string
		storeUrl?: string | null
		coverUrl?: string | null
	}[]
) => {
	const unique = [
		...new Map(
			entries
				.map((entry) => ({ ...entry, title: entry.title.trim() }))
				.filter((entry) => entry.title)
				.map((entry) => [normalize(entry.title), entry])
		).values()
	]
	if (!unique.length) return { imported: 0, skipped: 0, total: 0 }

	const db = getDb(env.DB)
	const existing = new Set(
		(
			await db
				.select({
					manualTitle: gameEntries.manualTitle,
					title: games.title
				})
				.from(gameEntries)
				.leftJoin(games, eq(gameEntries.gameId, games.id))
				.where(eq(gameEntries.userId, userId))
		).map((entry) => normalize(entry.manualTitle ?? entry.title ?? ""))
	)
	const missing = unique.filter(
		(entry) => !existing.has(normalize(entry.title))
	)
	let imported = 0
	for (let start = 0; start < missing.length; start += 10) {
		const chunk = missing.slice(start, start + 10).map((entry) => ({
			...entry,
			entryId: crypto.randomUUID(),
			gameId: crypto.randomUUID()
		}))
		await db.insert(games).values(
			chunk.map((entry) => ({
				id: entry.gameId,
				title: entry.title,
				slug: `${slugify(entry.title)}-${entry.gameId.slice(0, 6)}`,
				source: "manual" as const,
				coverUrl: entry.coverUrl ?? null
			}))
		)
		await db.insert(gameEntries).values(
			chunk.map((entry) => ({
				id: entry.entryId,
				userId,
				gameId: entry.gameId,
				storeUrl: entry.storeUrl ?? null
			}))
		)
		imported += chunk.length
	}
	return { imported, skipped: unique.length - imported, total: unique.length }
}

const fetchEpicToken = async (code: string) => {
	const response = await fetch(
		"https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token",
		{
			body: new URLSearchParams({
				code,
				grant_type: "authorization_code",
				token_type: "eg1"
			}),
			headers: {
				Authorization: `Basic ${btoa(`${epicClientId}:${epicClientSecret}`)}`,
				"Content-Type": "application/x-www-form-urlencoded",
				"User-Agent": epicUserAgent
			},
			method: "POST",
			signal: AbortSignal.timeout(15_000)
		}
	)
	const data = await response.json().catch(() => null)
	const token = z.object({ access_token: z.string() }).safeParse(data)
	if (!response.ok || !token.success)
		throw new Error("Unable to import Epic Games library.")
	return token.data.access_token
}

const epicTitle = (item: Record<string, unknown>) => {
	const metadata =
		item.metadata && typeof item.metadata === "object"
			? (item.metadata as Record<string, unknown>)
			: {}
	const mainGame =
		metadata.mainGameItem && typeof metadata.mainGameItem === "object"
			? (metadata.mainGameItem as Record<string, unknown>)
			: {}
	return (
		stringValue(item.title) ??
		stringValue(item.appTitle) ??
		stringValue(metadata.title) ??
		stringValue(metadata.name) ??
		stringValue(metadata.productName) ??
		stringValue(metadata.displayName) ??
		stringValue(mainGame.title) ??
		stringValue(item.appName) ??
		""
	)
}

const fetchEpicLibrary = async (accessToken: string) => {
	const entries: { title: string }[] = []
	let cursor: string | null = null
	for (let page = 0; page < 50; page++) {
		const url = new URL(
			"https://library-service.live.use1a.on.epicgames.com/library/api/public/items"
		)
		url.searchParams.set("includeMetadata", "true")
		if (cursor) url.searchParams.set("cursor", cursor)
		const response = await fetch(url, {
			headers: {
				Authorization: `bearer ${accessToken}`,
				"User-Agent": epicUserAgent
			},
			signal: AbortSignal.timeout(15_000)
		})
		const data = await response.json().catch(() => null)
		const parsed = z
			.object({
				records: z.array(z.record(z.string(), z.unknown())).default([]),
				responseMetadata: z
					.object({ nextCursor: z.string().nullable().optional() })
					.optional()
			})
			.safeParse(data)
		if (!response.ok || !parsed.success)
			throw new Error("Unable to import Epic Games library.")
		entries.push(
			...parsed.data.records
				.filter(
					(item) =>
						item.namespace !== "ue" &&
						item.sandboxType !== "PRIVATE"
				)
				.map((item) => ({ title: epicTitle(item) }))
		)
		cursor = parsed.data.responseMetadata?.nextCursor ?? null
		if (!cursor) break
	}
	return entries
}

const fetchGogToken = async (code: string) => {
	const url = new URL("https://auth.gog.com/token")
	url.searchParams.set("client_id", gogClientId)
	url.searchParams.set("client_secret", gogClientSecret)
	url.searchParams.set("grant_type", "authorization_code")
	url.searchParams.set("code", code)
	url.searchParams.set("redirect_uri", gogRedirectUri)
	const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
	const data = await response.json().catch(() => null)
	const token = z.object({ access_token: z.string() }).safeParse(data)
	if (!response.ok || !token.success)
		throw new Error("Unable to import GOG library.")
	return token.data.access_token
}

const fetchGogLibrary = async (accessToken: string) => {
	const entries: {
		title: string
		storeUrl: string | null
		coverUrl: string | null
	}[] = []
	for (let page = 1; page <= 100; page++) {
		const url = new URL("https://embed.gog.com/account/getFilteredProducts")
		url.searchParams.set("mediaType", "1")
		url.searchParams.set("page", String(page))
		url.searchParams.set("sortBy", "title")
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${accessToken}` },
			signal: AbortSignal.timeout(15_000)
		})
		const data = await response.json().catch(() => null)
		const parsed = z
			.object({
				page: z.number().int().positive().optional(),
				totalPages: z.number().int().nonnegative().default(1),
				products: z.array(z.record(z.string(), z.unknown())).default([])
			})
			.safeParse(data)
		if (!response.ok || !parsed.success)
			throw new Error("Unable to import GOG library.")
		entries.push(
			...parsed.data.products.map((product) => {
				const path = stringValue(product.url)
				return {
					title: stringValue(product.title) ?? "",
					storeUrl: path?.startsWith("/game/")
						? `https://www.gog.com${path}`
						: null,
					coverUrl: imageUrl(product.image)
				}
			})
		)
		if (page >= parsed.data.totalPages) break
	}
	return entries
}

export const storeImportRoutes = new Hono<ApiEnv>()

storeImportRoutes.post("/epic/import", async (c) => {
	try {
		const session = await requireSession(c.env, c.req.raw.headers)
		const input = codePayload.safeParse(
			await c.req.json().catch(() => null)
		)
		if (!input.success)
			return c.json(jsonError("Invalid import request."), 400)
		const accessToken = await fetchEpicToken(extractCode(input.data.code))
		const entries = await fetchEpicLibrary(accessToken)
		return c.json({
			data: await importEntries(c.env, session.user.id, entries)
		})
	} catch (error) {
		if (error instanceof Error && error.message === "Sign in required")
			return c.json(jsonError("Sign in required", 401), 401)
		console.error("Epic Games library import failed", error)
		return c.json(
			jsonError(
				error instanceof Error
					? error.message
					: "Unable to import Epic Games library.",
				400
			),
			400
		)
	}
})

storeImportRoutes.post("/gog/import", async (c) => {
	try {
		const session = await requireSession(c.env, c.req.raw.headers)
		const input = codePayload.safeParse(
			await c.req.json().catch(() => null)
		)
		if (!input.success)
			return c.json(jsonError("Invalid import request."), 400)
		const accessToken = await fetchGogToken(extractCode(input.data.code))
		const entries = await fetchGogLibrary(accessToken)
		return c.json({
			data: await importEntries(c.env, session.user.id, entries)
		})
	} catch (error) {
		if (error instanceof Error && error.message === "Sign in required")
			return c.json(jsonError("Sign in required", 401), 401)
		console.error("GOG library import failed", error)
		return c.json(
			jsonError(
				error instanceof Error
					? error.message
					: "Unable to import GOG library.",
				400
			),
			400
		)
	}
})

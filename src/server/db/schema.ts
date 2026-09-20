import { relations, sql } from "drizzle-orm"
import {
	index,
	integer,
	real,
	sqliteTable,
	text,
	uniqueIndex
} from "drizzle-orm/sqlite-core"

const timestamps = () => ({
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => new Date())
		.notNull()
})

export const user = sqliteTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("email_verified", { mode: "boolean" })
		.default(false)
		.notNull(),
	image: text("image"),
	...timestamps(),
	role: text("role"),
	banned: integer("banned", { mode: "boolean" }).default(false),
	banReason: text("ban_reason"),
	banExpires: integer("ban_expires", { mode: "timestamp_ms" }),
	steamId: text("steam_id").unique()
})

export const session = sqliteTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		token: text("token").notNull().unique(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.$onUpdate(() => new Date())
			.notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		impersonatedBy: text("impersonated_by")
	},
	(table) => [index("session_userId_idx").on(table.userId)]
)

export const account = sqliteTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: integer("access_token_expires_at", {
			mode: "timestamp_ms"
		}),
		refreshTokenExpiresAt: integer("refresh_token_expires_at", {
			mode: "timestamp_ms"
		}),
		scope: text("scope"),
		password: text("password"),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [index("account_userId_idx").on(table.userId)]
)

export const verification = sqliteTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		...timestamps()
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)]
)

export const passkey = sqliteTable(
	"passkey",
	{
		id: text("id").primaryKey(),
		name: text("name"),
		publicKey: text("public_key").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		credentialID: text("credential_id").notNull(),
		counter: integer("counter").notNull(),
		deviceType: text("device_type").notNull(),
		backedUp: integer("backed_up", { mode: "boolean" }).notNull(),
		transports: text("transports"),
		createdAt: integer("created_at", { mode: "timestamp_ms" }),
		aaguid: text("aaguid")
	},
	(table) => [
		index("passkey_userId_idx").on(table.userId),
		index("passkey_credentialID_idx").on(table.credentialID)
	]
)

export const profiles = sqliteTable("profiles", {
	userId: text("user_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	slug: text("slug").notNull().unique(),
	displayName: text("display_name").notNull(),
	avatarUrl: text("avatar_url"),
	bio: text("bio").default("").notNull(),
	favoriteGenres: text("favorite_genres").default("[]").notNull(),
	isPublic: integer("is_public", { mode: "boolean" })
		.default(false)
		.notNull(),
	steamVanity: text("steam_vanity").unique(),
	...timestamps()
})

export const games = sqliteTable(
	"games",
	{
		id: text("id").primaryKey(),
		title: text("title").notNull(),
		slug: text("slug").notNull().unique(),
		source: text("source", { enum: ["steam", "igdb", "manual"] })
			.default("manual")
			.notNull(),
		steamAppId: integer("steam_app_id"),
		igdbId: integer("igdb_id"),
		coverUrl: text("cover_url"),
		releaseYear: integer("release_year"),
		...timestamps()
	},
	(table) => [
		uniqueIndex("games_steam_app_id_idx").on(table.steamAppId),
		uniqueIndex("games_igdb_id_idx").on(table.igdbId)
	]
)

export const gameEntries = sqliteTable(
	"game_entries",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		gameId: text("game_id").references(() => games.id, {
			onDelete: "set null"
		}),
		manualTitle: text("manual_title"),
		coverUrl: text("cover_url"),
		hidden: integer("hidden", { mode: "boolean" }).default(false).notNull(),
		importedFromSteam: integer("imported_from_steam", { mode: "boolean" })
			.default(false)
			.notNull(),
		steamAppId: integer("steam_app_id"),
		funFeeling: real("fun_feeling"),
		immersive: real("immersive"),
		variety: real("variety"),
		artistry: real("artistry"),
		ui: real("ui"),
		narrationTheme: real("narration_theme"),
		authenticity: real("authenticity"),
		originality: real("originality"),
		music: real("music"),
		effectsVocals: real("effects_vocals"),
		interfaceScore: real("interface_score"),
		control: real("control"),
		learningCurve: real("learning_curve"),
		performancePenalty: real("performance_penalty"),
		badMomentPenalty: real("bad_moment_penalty"),
		inconsistencyPenalty: real("inconsistency_penalty"),
		replayabilityBonus: real("replayability_bonus"),
		extraPercent: real("extra_percent"),
		notes: text("notes"),
		...timestamps()
	},
	(table) => [
		index("game_entries_userId_idx").on(table.userId),
		index("game_entries_gameId_idx").on(table.gameId),
		index("game_entries_steamAppId_idx").on(table.steamAppId)
	]
)

export const mergeSuggestions = sqliteTable(
	"merge_suggestions",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		fromGameId: text("from_game_id").references(() => games.id, {
			onDelete: "cascade"
		}),
		toGameId: text("to_game_id").references(() => games.id, {
			onDelete: "cascade"
		}),
		reason: text("reason").notNull(),
		status: text("status", { enum: ["open", "dismissed", "merged"] })
			.default("open")
			.notNull(),
		...timestamps()
	},
	(table) => [index("merge_suggestions_userId_idx").on(table.userId)]
)

export const userRelations = relations(user, ({ many, one }) => ({
	sessions: many(session),
	accounts: many(account),
	passkeys: many(passkey),
	profile: one(profiles)
}))

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	})
}))

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	})
}))

export const passkeyRelations = relations(passkey, ({ one }) => ({
	user: one(user, {
		fields: [passkey.userId],
		references: [user.id]
	})
}))

export const profileRelations = relations(profiles, ({ one }) => ({
	user: one(user, {
		fields: [profiles.userId],
		references: [user.id]
	})
}))

export const gameRelations = relations(games, ({ many }) => ({
	entries: many(gameEntries)
}))

export const gameEntryRelations = relations(gameEntries, ({ one }) => ({
	user: one(user, {
		fields: [gameEntries.userId],
		references: [user.id]
	}),
	game: one(games, {
		fields: [gameEntries.gameId],
		references: [games.id]
	})
}))

ALTER TABLE `game_entries` ADD `playtime_minutes` integer;--> statement-breakpoint
ALTER TABLE `game_entries` ADD `paid_price_cents` integer;--> statement-breakpoint
ALTER TABLE `profiles` ADD `playtime_synced_at` integer;--> statement-breakpoint
ALTER TABLE `profiles` ADD `playtime_sync_attempt_at` integer;
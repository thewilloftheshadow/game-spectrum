# Game Spectrum

Personal game ranking app based on Bocabola's Game Spectrum spreadsheet.

## Stack

- Bun
- React Router
- React Query
- Hono
- Drizzle
- Cloudflare Workers + D1
- Better Auth
- CSS Modules

## Development

```bash
bun install
bun run dev
```

## Pages

- `/` — homepage
- `/login` — Steam, Discord, Twitch, and passkey sign-in
- `/dashboard` — library and inline rating table
- `/import` — asynchronous Steam import with batch progress; default destination after Steam sign-in
- `/accounts` — linked providers and passkeys
- `/accounts/profile` — profile details and visibility
- `/u/:slug`, `/steam/:thing` — public rating tables
- `/about` — original spreadsheet explanation

Games are rows, with all rating fields grouped into columns across the top. Library and public profile tables show one unpaginated sheet with sticky game names and headers. The sheet scrolls with the document, without a nested scroll area. The dashboard has a compact toolbar instead of the site header and page heading. Its single Save button saves every edited game, including edits outside the current filter; failed saves retain their drafts for retry. Extra % is displayed as a percentage and stored as the spreadsheet multiplier.

Game search ranks normalized exact title matches ahead of partial matches across providers. Steam remains first when relevance is tied.

Steam imports run in batches of up to 100 games per request. Progress persists across in-app navigation while the tab stays open. Repeating an import keeps existing ratings and visibility, and skips games already in the library. Account connections display provider names/emails when available, with account IDs as a fallback.

New profiles default to a random eight-character slug. Existing profile URLs are preserved. Profile visibility saves immediately, separately from the profile-details form. The library toolbar, profile settings, and public profile provide copy-link actions. Hidden games, unfinished core ratings, and paid amounts stay private. Completing all 13 base rating fields produces a score; blank penalties, replayability, and Extra % default to neutral values. The original spreadsheet note remains verbatim on About.

## Prices and playtime

The sheet ends with Hours played, Current price, and (in your own library) Paid. Steam US prices use USD, show both regular and discounted prices during sales, and load only as cells approach the viewport. Prices are cached for 15 minutes. Unavailable/non-Steam prices stay unknown rather than being guessed. Paid amounts are stored as integer cents and saved with the main Save button. Until overridden, Paid displays the regular Steam price as an estimate, not purchase history; zero is a valid override and clearing restores the default.

Steam imports populate playtime and preserve ratings, visibility, notes, and paid amounts. **Sync playtime** updates only playtime for games already in the library. The Worker checks hourly for linked accounts due for a 48-hour refresh, with a bounded batch of ten accounts per invocation; failed automatic attempts wait another 48 hours. This uses elapsed time rather than an every-other-day-of-month cron, which has uneven gaps at month boundaries. Private or unavailable Steam libraries retain saved hours. Sync requires Steam Game Details to be public. The hourly trigger and schema migration take effect on deployment.

Signed-in visitors see their four highest-rated games in the existing homepage artwork strip. Empty slots retain the featured games; the homepage layout and copy are unchanged.

## Required runtime secrets

Set these as Cloudflare Worker secrets or local `.dev.vars` values:

- `BETTER_AUTH_SECRET` - at least 32 random characters
- `DISCORD_CLIENT_ID` - Discord OAuth app client ID
- `DISCORD_CLIENT_SECRET` - Discord OAuth app client secret
- `STEAM_API_KEY` - Steam Web API key
- `TWITCH_CLIENT_ID` - Twitch OAuth app client ID
- `TWITCH_CLIENT_SECRET` - Twitch OAuth app client secret
- `IGDB_CLIENT_ID` - Twitch/IGDB app client ID
- `IGDB_ACCESS_TOKEN` - Twitch app access token for IGDB requests

`BETTER_AUTH_URL` is configured in `wrangler.jsonc` as `https://www.gamespectrum.org`.

Production redirect URLs:

```txt
https://www.gamespectrum.org/api/auth/callback/discord
https://www.gamespectrum.org/api/auth/callback/twitch
```

## Database

D1 database: `game-spectrum`

```bash
bun run db:generate
bun run db:migrate:local
bun run db:migrate:remote
```

## Deployment

Pushing to `main` automatically triggers production deployment. No separate manual deploy is needed. A successful push confirms deployment was triggered, not that deployment has finished successfully; verify deployment status before reporting success.

For an explicitly requested manual deployment, `bun run deploy` runs `bun run build`, applies remote D1 migrations, then runs `wrangler deploy`.

## Verification

```bash
bun run typecheck
bun run build
bun run lint:check
bun run format:check
```

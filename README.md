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
- `/accounts` — linked providers and passkeys
- `/accounts/profile` — profile details and visibility
- `/u/:slug`, `/steam/:thing` — public rating tables
- `/about` — original spreadsheet explanation

Each rating field has its own table row. Games are columns. Extra % is displayed as a percentage and stored as the spreadsheet multiplier.

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

`bun run deploy` runs `bun run build`, applies remote D1 migrations, then runs `wrangler deploy`.

## Verification

```bash
bun run typecheck
bun run build
bun run lint:check
bun run format:check
```

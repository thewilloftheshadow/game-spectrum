# Buape - Site Template

Minimal Bun + React Router + React Query + Hono + Drizzle template.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/buape/site-template)

## Setup Instructions

1. Install dependencies:

```bash
bun install
```

2. Choose an app name and D1 database name, using lowercase letters and dashes.

3. Fill out `package.json`:

- Set `name` to your package name.
- Replace `DATABASE_NAME` in `db:migrate:local` and `db:migrate:remote` with your D1 database name.

4. Fill out `wrangler.jsonc`:

- Set `name` to your Worker name.
- Set `database_name` in `wrangler.jsonc` under `d1_databases` to your D1 database name.
- Create the database and copy the returned id into `database_id` under `d1_databases`:

```bash
bun x wrangler d1 create <database-name>
```

5. Regenerate Worker types after changing `wrangler.jsonc`:

Git hooks and Worker types are installed/generated automatically during `bun install`. If needed, rerun them manually:

```bash
bun run prepare
bun run postinstall
```

## Development

```bash
bun install
bun run dev
```

## Repository Rules

- Use `src/lib/api-client.ts` for internal API calls from the client.
- Use `apiQueryOptions(...)` with React Query for reads.
- Use `apiJson(...)` for JSON mutations.
- Avoid raw `fetch("/api/...")` in pages/components unless the API client cannot cover the case.
- Keep route modules in `src/pages`.
- Keep global providers and document shell in `src/root.tsx`.
- Keep API entrypoint wiring in `src/server/api.ts`.
- Add small API endpoints directly in `src/server/api.ts`; when a domain grows, move it to `src/server/<domain>.ts` and mount it from `src/server/api.ts`.
- Return minimal API payloads. Prefer `{ data: ... }` for success and `{ error: { message } }` for failures.
- Read server bindings from Hono context (`c.env`) and create DB clients with `getDb(c.env.DB)`.
- Keep Drizzle schema in `src/server/db/schema.ts` and DB setup in `src/server/db/index.ts`.
- Generate migrations with `bun run db:generate`; do not hand-edit generated migrations unless intentionally reviewing generated output.
- Keep styling simple in `src/globals.css`; add design tokens only when the app actually needs them.
- Add reusable components only when reuse exists; otherwise keep route-specific UI in the page file.

## Scripts

- `bun run dev` — start local dev server
- `bun run build` — build the app
- `bun run lint` — fix lint and formatting issues with Oxlint/Oxfmt
- `bun run lint:check` — check lint with Oxlint
- `bun run format:check` — check formatting with Oxfmt
- `bun run prepare` — install Lefthook Git hooks
- `bun run postinstall` — generate Worker types
- `bun run typecheck` — run TypeScript
- `bun run db:generate` — generate Drizzle migrations
- `bun run deploy` — build and deploy with Wrangler

## Layout

- `src/pages/home.tsx` — stub home page
- `src/lib/api-client.ts` — React Query-friendly API client
- `src/server/api.ts` — base API route
- `src/server/db/schema.ts` — empty Drizzle schema
- `src/worker.ts` — Cloudflare Worker entry

Read `README.md` first.

Keep changes small, direct, and easy to verify.

## Rules

- Keep `isbot` installed; React Router needs it at runtime.
- Stack: Bun + React Router + React Query + Hono + Drizzle + Cloudflare Workers/D1.
- Pages live in `src/pages`; API routes live in `src/server/api.ts`; Drizzle schema lives in `src/server/db/schema.ts`.
- Use package-manager commands for dependency changes.
- Use `package.json` scripts for verification; prefer `bun run <script>`.
- Create migrations with Drizzle tooling only.
- Do not write tests unless specifically instructed.
- Never commit or expose secrets.
- Do not create extra types or functions unless they have to be exported.
- Follow the KISS principle.

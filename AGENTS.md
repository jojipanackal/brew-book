# AGENTS.md

This file provides guidance to Coding Agents when working with code in this repository.

## Commands

```bash
pnpm dev              # dev server on http://localhost:3000
pnpm build            # generate routes + build
pnpm lint             # Biome lint
pnpm check            # Biome lint + format check
pnpm format           # Biome format (tabs, double-quote JS)

pnpm db:generate      # generate Drizzle migration files from schema changes
pnpm db:migrate       # run pending migrations via scripts/migrate.ts
pnpm db:push          # push schema directly (no migration files — local only)
pnpm db:studio        # open Drizzle Studio
```

No test suite exists. No single-test command.

## Architecture

**Stack:** TanStack Start (React SSR framework on Nitro/Vite) + React 19 + TanStack Router + Drizzle ORM + Better Auth + Tailwind CSS v4 + Biome.

**Route structure:** TanStack Router file-based routing. `src/routes/__root.tsx` defines the shell and head. `src/routes/index.tsx` is the only route — it mounts `src/brewbook-app.tsx`. `src/routeTree.gen.ts` is auto-generated; don't edit it manually. Regenerate with `pnpm generate-routes`.

**UI architecture:** Nearly all UI lives in a single large component file `src/brewbook-app.tsx`. There are no separate component files. The root `App` component manages all state (auth, profiles, drink entries, admin data) and renders one of several full-page states (loading, sign-in, guest setup, onboarding, main app). Navigation between views (`today`, `history`, `defaults`, `admin`) is controlled by a `view` state string — no nested routes.

**Data flow:** The app fetches data via functions in `src/lib/drinks.ts` which call REST API endpoints (`/api/drinks`, `/api/profile`, `/api/guest`, `/api/admin`, `/api/companies`). These endpoints are served by TanStack Start's server-side handlers (not shown as separate route files — they're registered via the framework). Client state is plain React `useState`; no React Query is used despite being installed.

**Auth:** Better Auth (`src/lib/auth.ts`) handles server-side session management with a Drizzle adapter. Only Google OAuth is supported. On new user creation, `auth.ts` validates the email against registered company domains in the `company` table — users with unrecognized emails are blocked with `FORBIDDEN`. Client-side auth uses `src/lib/auth-client.ts` and the `authClient.useSession()` hook.

**Guest access:** Unauthenticated users can request guest access (stored as a `user` row with `isGuest: true`). Guests have a `pending` → `approved`/`rejected` flow managed by company admins. Guest state is polled every 5 seconds while pending.

**Database:** Drizzle ORM with PostgreSQL. Schema in `src/db/schema.ts`. Key tables: `company`, `user` (extended Better Auth user with role/guest fields), `drinkDefault` (per-user per-period defaults, composite PK `userId+period`), `drinkResponse` (per-user per-date per-period responses, unique on `userId+date+period`). Better Auth tables (`session`, `account`, `verification`) are also defined here.

**DB connection:** `src/db/connection.ts` strips `sslmode`/`uselibpqcompat` from the connection string and handles CA cert resolution (from file path or inline PEM with `\n` escaping). Always uses SSL.

**Env / secrets:** Local dev uses `.env.local`. Production uses `.env.production` encrypted with dotenvx — decrypted at runtime via `DOTENV_PRIVATE_KEY_PRODUCTION`. The `dotenvx.ts` / `loadDotenvx()` call is invoked in both `vite.config.ts` and `drizzle.config.ts`.

**Timezone:** All date keys use `Asia/Kolkata` timezone (`en-CA` locale for `YYYY-MM-DD` format). Dates are passed as strings like `"2025-07-27"`.

**Sentry:** Initialized client-side in `brewbook-app.tsx` via `src/lib/sentry.ts`, and server-side via `sentry.server.mjs`. Vite plugin uploads source maps and deletes `.map` files post-build when `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` are set.

**Path alias:** `#/*` maps to `src/*` (configured in `package.json` imports and `tsconfig`).

**Linting:** Biome (not ESLint). Tabs for indentation, double quotes for JS strings. Scoped to `src/**` and config files; ignores `routeTree.gen.ts` and `styles.css`.

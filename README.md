# BrewBook

BrewBook is a mobile-first office drink register built with TanStack Start, React, Better Auth, and Drizzle ORM. Colleagues sign in with Google Workspace, choose their morning and evening drinks, and view the shared daily register.

## Setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

The app runs at `http://localhost:3000`.

Set these values in `.env.local`:

- `DATABASE_URL`: hosted Postgres connection string.
- `BETTER_AUTH_SECRET`: a long random secret used to sign sessions.
- `BETTER_AUTH_URL`: the app's public base URL.
- `GOOGLE_CLIENT_ID`: Google OAuth client ID.
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret.
- `SENTRY_DSN`: Sentry DSN for the Node runtime.
- `SENTRY_ENVIRONMENT`: Sentry environment label for both runtimes.
- `VITE_SENTRY_DSN`: Sentry DSN exposed to the browser bundle.
- `SENTRY_ORG`: Sentry organization slug for source map uploads.
- `SENTRY_PROJECT`: Sentry project slug for source map uploads.
- `SENTRY_AUTH_TOKEN`: Sentry auth token used by the Vite plugin in CI.

Add this callback URL to the Google OAuth client:

`http://localhost:3000/api/auth/callback/google`

For production, use the deployed app URL with the same `/api/auth/callback/google` path.

## Database

The Drizzle schema includes Better Auth tables plus BrewBook drink defaults and responses.

```bash
pnpm db:generate
pnpm db:migrate
```

Use `pnpm db:push` for a local database when you do not need migration files.

See [DB_SETUP.md](./DB_SETUP.md) for the complete DigitalOcean Managed PostgreSQL, Google OAuth, migration, and deployment setup.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the GitHub Actions, GHCR, DigitalOcean firewall, Docker, and VPS deployment process.

Production configuration is encrypted with dotenvx. Local development uses `.env.local`; production uses the encrypted `.env.production` file and `DOTENV_PRIVATE_KEY_PRODUCTION`.

Sentry is initialized in the browser app, the server runtime, and the Vite build. When `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` are present, production builds upload source maps to Sentry and delete the emitted `.map` files after upload. The runtime environment label comes from `SENTRY_ENVIRONMENT` and falls back to the current mode if it is unset.

## Commands

```bash
pnpm dev       # start the TanStack Start dev server
pnpm build     # generate routes and build the app
pnpm lint      # run Biome linting
pnpm format    # format source files with Biome
```

Drink defaults, daily responses, history, and poll details are persisted through the authenticated Drizzle API.
just added contributors
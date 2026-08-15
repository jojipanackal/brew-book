# BrewBook Database Setup

This guide connects BrewBook to PostgreSQL and enables Google Workspace login. PostgreSQL may run locally, in a VPS container, or on a managed provider. The project uses TanStack Start for the server runtime, Better Auth for sessions, and Drizzle ORM for database access.

## Quick local setup

The local Compose file runs an isolated PostgreSQL 17 container on `127.0.0.1:5433`. Its database and credentials are intentionally development-only, and the local scripts always pass this URL explicitly so they do not use the VPS URL from `.env.local`.

Start PostgreSQL, apply every committed migration, and insert fake data:

```bash
pnpm db:local:setup
```

Run the app against that database:

```bash
pnpm dev:local
```

The seed is safe to rerun and creates a demo company, five users, two weeks of drink and attendance history, and a pending guest. Open the local app and select **Login Local** to sign in as the seeded `Asha Admin` user without Google or Better Auth. This option is enabled only by `pnpm dev:local` and the server additionally rejects it unless the database is `brewbook_local` on localhost.

Useful local database commands:

```bash
pnpm db:local:psql       # Open psql inside the container
pnpm db:local:migrate    # Apply pending migrations only
pnpm db:local:seed       # Add any missing fake data
pnpm db:local:down       # Stop the container; keep its data
```

The persistent volume is named under the `brew-book-local` Compose project. If you intentionally want a completely empty local database, remove the stack and its volume with `docker compose -f compose.local.yml down -v`, then run `pnpm db:local:setup` again.

Local connection details:

```text
Host: 127.0.0.1
Port: 5433
Database: brewbook_local
User: brewbook
Password: brewbook
URL: postgresql://brewbook:brewbook@127.0.0.1:5433/brewbook_local
```

## 1. Create a PostgreSQL database

Create the BrewBook database and application user in your PostgreSQL container or managed provider. For a container on the same Docker network, use the PostgreSQL service name and port `5432`.

Copy the provider's connection string. It should look similar to:

```text
postgresql://user:password@postgres:5432/database
```

Use `?sslmode=require` when the database endpoint requires TLS. BrewBook reads this value from `DATABASE_URL`; a plain URL without `sslmode` uses non-SSL PostgreSQL, which is suitable for a private Docker network. `DATABASE_CA_CERT` is optional.

## 2. Grant the application user access

Use the provider admin or main database user to connect to the BrewBook database. The application user needs permission to connect, create and update the schema during migrations, and read/write application data.

You can run the following with `psql` from your machine. Replace the role and database names with the values you created:

```bash
psql "$POSTGRES_ADMIN_DATABASE_URL"
```

Then run this SQL while connected to the BrewBook database:

```sql
GRANT CONNECT ON DATABASE brewdb TO brewadmin;
GRANT USAGE, CREATE ON SCHEMA public TO brewadmin;

-- Required when the database already contains tables or a previous migration.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO brewadmin;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO brewadmin;

-- Keep permissions correct for objects created by the application user later.
ALTER DEFAULT PRIVILEGES FOR ROLE brewadmin IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO brewadmin;
ALTER DEFAULT PRIVILEGES FOR ROLE brewadmin IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO brewadmin;
```

Run the migration as `brewadmin`, not as the main admin user. That makes the application role the owner of the BrewBook tables and PostgreSQL types it creates:

```bash
DATABASE_URL='postgresql://brewadmin:password@postgres:5432/brewdb' pnpm db:migrate
```

If an admin user already created the tables, run the `GRANT ... ON ALL TABLES` statements above again after the migration. For a clean new database, the normal order is: grant schema access, set `DATABASE_URL` to the `brewadmin` user, then run `pnpm db:migrate`.

Verify the effective permissions from the app user's connection:

```sql
SELECT current_user, current_database();
SELECT has_schema_privilege(current_user, 'public', 'USAGE');
SELECT has_schema_privilege(current_user, 'public', 'CREATE');
```

The final two results should both be `true` before running migrations.

## 3. Configure local environment variables

From the project directory:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```dotenv
DATABASE_URL=postgresql://brewadmin:password@postgres:5432/brewdb
# Optional: path or PEM contents when strict CA verification is required.
DATABASE_CA_CERT=
BETTER_AUTH_SECRET=replace-with-a-long-random-secret
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

Generate a secret with:

```bash
openssl rand -base64 32
```

Never commit `.env.local` or put database credentials in frontend environment variables.

## 4. Configure Google Workspace login

In Google Cloud Console:

1. Create or select a project.
2. Configure the OAuth consent screen.
3. If only your organization should access BrewBook, use an Internal audience where available.
4. Create an OAuth Client ID for a Web application.
5. Add `http://localhost:3000` as an authorized JavaScript origin.
6. Add this authorized redirect URI:

```text
http://localhost:3000/api/auth/callback/google
```

Set the returned client ID and client secret in `.env.local`. For production, add the deployed origin and use:

```text
https://your-domain.example/api/auth/callback/google
```

`BETTER_AUTH_URL` must match the deployed origin in production.

For local development, encrypt `.env.local` with dotenvx. If strict CA verification is required, store the provider certificate in `DATABASE_CA_CERT`. Do not paste an unquoted multi-line certificate into the file before encryption. Use dotenvx to write the certificate value safely:

```bash
pnpm exec dotenvx set DATABASE_CA_CERT "$(cat .secrets/db-ca.crt)" -f .env.local
pnpm exec dotenvx encrypt -f .env.local
```

Dotenvx creates `.env.keys` for the local private key. Keep that file locally and do not commit it. BrewBook loads `.env.local` automatically when running outside production.

For production deployment, put the real values in an encrypted `.env.production` file using the dotenvx process described in [DEPLOYMENT.md](./DEPLOYMENT.md). Do not put production database credentials directly in the VPS Compose environment file.

## 5. Apply the database schema

Install dependencies and apply the committed migrations:

```bash
pnpm install
pnpm db:migrate
```

The migrations create:

- Better Auth tables: `user`, `session`, `account`, and `verification`.
- `drink_default`: one default drink per user and period.
- `drink_response`: one response per user, date, and period.
- `company`: company name plus two email-ending columns used for automatic Google account matching.
- `company_admin`: one row per company administrator email, allowing multiple administrators per company.
- User roles and guest approval fields for `user`, `admin`, and `guest` access.
- PostgreSQL enums for valid drinks, periods, and response sources.

To create a new migration after changing `src/db/schema.ts`:

```bash
pnpm db:generate
pnpm db:migrate
```

Use `pnpm db:push` only for temporary local database iteration. Use generated migrations for shared or production databases.

## 6. Add companies and administrators

`Mygate` is seeded by migration `0007`. Add another company by inserting its email endings, including the `@` prefix:

```sql
INSERT INTO company (id, name, email_ending_1, email_ending_2)
VALUES ('acme', 'Acme', '@acme.com', '@acme.org');
```

Add one or more administrators for that company. Store emails in lowercase:

```sql
INSERT INTO company_admin (id, company_id, email)
VALUES
  ('mygate-admin-1', 'mygate', 'first.admin@mygate.in'),
  ('mygate-admin-2', 'mygate', 'second.admin@mygate.com');
```

Administrators can approve guest requests and change today's drink choices for users in their company. To grant global admin access instead, set the signed-in user's role after they have logged in:

```sql
UPDATE "user" SET role = 'admin' WHERE lower(email) = lower('admin@example.com');
```

Guests are created with role `guest`, remain pending until a company administrator approves them, and receive access for 24 hours after approval.

## 7. Run BrewBook locally

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with a Google Workspace account, set defaults, and update a morning or evening response. The app should persist the changes in PostgreSQL and show them to other signed-in users.

## 8. Deploy

The repository includes a GitHub Actions plus Docker Compose deployment process. See [DEPLOYMENT.md](./DEPLOYMENT.md) for the required GitHub secrets and VPS setup.

Configure these environment variables in the hosting provider:

```text
DATABASE_URL
BETTER_AUTH_SECRET
BETTER_AUTH_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
```

Use these commands unless your hosting provider has a separate release-command setting:

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
node .output/server/index.mjs
```

The migration command should run once per deployment or as a release step before the new server starts. Do not run migrations concurrently from multiple deployment instances.

After deployment, add the production origin and callback URL to the Google OAuth client, then verify:

1. An unauthenticated visitor sees only the Google sign-in action.
2. A first-time signed-in user receives `No drink` rows for today's morning and evening polls.
3. Changing a drink creates or updates the authenticated user's response.
4. Another signed-in user can see the response in today's poll and details view.
5. History displays the saved responses for previous dates.

## Database model

`drink_default` stores a user's preferred fallback drink for each period. It does not overwrite an existing manual response.

`drink_response` stores the actual register entry. The unique key `(user_id, date, period)` makes updates idempotent. `source` is either `default` or `manual`, so the details view can show how each response was created.

The API is implemented in `src/routes/api/drinks.ts`, `src/routes/api/guest.ts`, and `src/routes/api/admin.ts`. Daily member reads and writes require a Better Auth session; guests use an expiring cookie and can only access today's register after approval. Defaults remain private to their owner, and admin actions are scoped to the administrator's company unless the user has the global `admin` role.

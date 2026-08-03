# BrewBook Deployment

BrewBook follows this deployment shape:

1. GitHub Actions builds a production Docker image.
2. The image is pushed to GitHub Container Registry.
3. GitHub Actions runs Drizzle migrations against the database URL configured in the repository secret.
4. GitHub Actions uploads `docker-compose.yml` to the VPS.
5. The VPS pulls the new image and restarts the container.

## Required GitHub secrets

Add these repository secrets under **Settings > Secrets and variables > Actions**:

| Secret | Purpose |
| --- | --- |
| `MIGRATION_DATABASE_URL` | PostgreSQL connection string used by CI migrations. It may be a plain container URL or a URL with `sslmode=require`. |
| `DOTENV_PRIVATE_KEY_PRODUCTION` | Private dotenvx key for the encrypted `.env.production` file. |
| `VPS_HOST` | Public hostname or IP address of the VPS. |
| `VPS_SSH_KEY` | Private SSH key for the `deploy` user. |
| `GHCR_PAT` | GitHub token with permission to pull the private container package on the VPS. |

`MIGRATION_DATABASE_URL` should use the application database user, not the database admin user:

```text
postgresql://brewadmin:password@db-host:5432/brewdb
```

The migration job uses only this URL and does not decrypt `.env.production`. The database must be reachable from GitHub Actions; if the PostgreSQL container is private to the VPS Docker network, run migrations from the VPS instead or expose the database through a protected private/tunneled endpoint.

## Prepare dotenvx production configuration

Create the production dotenv file locally from the example, fill in the real production values, and encrypt it:

```bash
cp .env.example .env.production
# Edit .env.production with the production database, auth, and Google values.
pnpm exec dotenvx encrypt -f .env.production
```

Commit the encrypted `.env.production` file and keep the generated private key out of Git. Add that private key as the `DOTENV_PRIVATE_KEY_PRODUCTION` GitHub Actions secret. The Docker build receives the key only as a BuildKit secret, and the running container receives it through the VPS `.env` file.

Local development uses the same pattern with `.env.local`. `DATABASE_CA_CERT` is optional and is only needed when the database requires a specific CA:

```bash
pnpm exec dotenvx set DATABASE_CA_CERT "$(cat .secrets/db-ca.crt)" -f .env.local
pnpm exec dotenvx encrypt -f .env.local
```

## Prepare the VPS once

Install Docker Engine and the Docker Compose plugin. Create the deployment directory and make sure the `deploy` user can run Docker:

```bash
sudo mkdir -p /var/www/brew-book
sudo chown -R deploy:deploy /var/www/brew-book
sudo usermod -aG docker deploy
```

Create `/var/www/brew-book/.env` on the VPS. This file is not committed or uploaded by GitHub Actions and should contain the dotenvx private key:

```dotenv
DOTENV_PRIVATE_KEY_PRODUCTION=your-dotenvx-private-key
```

Set the production `DATABASE_URL` in `.env.production` to the PostgreSQL container's Docker-network address, for example `postgresql://brewadmin:password@postgres:5432/brewdb`. Omit `sslmode` for a private Docker network. If the database is exposed through TLS, use `?sslmode=require`; no CA variable is required unless you want strict CA verification.

Log in once from the VPS if the GitHub package is private:

```bash
echo "$GHCR_PAT" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

The container listens only on `127.0.0.1:3003`. Put Nginx, Caddy, or another reverse proxy in front of it and proxy the public HTTPS domain to `http://127.0.0.1:3003`.

## Schedule push notifications on the VPS

Push notifications run as short-lived worker containers on the VPS. The worker services use the same production image and `.env` file as the web app, and are excluded from normal `docker compose up -d` startup through the `worker` profile.

The deployment workflow installs and refreshes the systemd timers automatically. The `deploy` user must have passwordless `sudo` permission for `install` and `systemctl` commands. For example, after the first deployment, verify that the timers are active:

```bash
systemctl list-timers | grep brew-book
```

The default schedule is 07:30 and 18:00 Asia/Kolkata. Test a job manually with:

```bash
sudo systemctl start brew-book-push-morning.service
sudo journalctl -u brew-book-push-morning.service -n 100 --no-pager
```

The VPS must retain database access through the VPC and DigitalOcean database trusted sources. The GitHub Actions push-notifications workflow is no longer needed because these timers are managed by the deployment workflow.

## First deployment

Push the repository's `main` branch. The workflow is in `.github/workflows/deploy.yml` and starts automatically.

For the first deployment, check the jobs in this order:

1. **Build and Push Image** succeeds and publishes `ghcr.io/<owner>/<repo>:latest`.
2. **Run Database Migrations** temporarily adds the GitHub runner IP, applies the committed migrations, and removes the IP even if the migration fails.
3. **Deploy to VPS** uploads the Compose file, pulls the image, and restarts the container.

After the container starts:

```bash
cd /var/www/brew-book
docker compose ps
docker compose logs --tail=100 app
```

## Google OAuth production callback

Add the production callback URL to the Google OAuth client:

```text
https://brewbook.example.com/api/auth/callback/google
```

`BETTER_AUTH_URL` and `BETTER_AUTH_TRUSTED_ORIGINS` must use the same HTTPS origin. Do not use the VPS port in the public callback URL.

## Future schema changes

Create and commit a migration locally:

```bash
pnpm db:generate
```

Do not run `db:push` in production. The deployment workflow runs the committed migrations before deploying the new image.

# BrewBook Deployment

BrewBook follows this deployment shape:

1. GitHub Actions builds a production Docker image.
2. The image is pushed to GitHub Container Registry.
3. GitHub Actions uploads `docker-compose.yml` to the VPS.
4. The VPS pulls the new image, runs a one-shot migration container on the Docker network that contains PostgreSQL, and starts the app only after migration succeeds.

## Required GitHub secrets

Add these repository secrets under **Settings > Secrets and variables > Actions**:

| Secret | Purpose |
| --- | --- |
| `DOTENV_PRIVATE_KEY_PRODUCTION` | Private dotenvx key for the encrypted `.env.production` file. |
| `VPS_HOST` | Public hostname or IP address of the VPS. |
| `VPS_SSH_KEY` | Private SSH key for the `deploy` user. |
| `GHCR_PAT` | GitHub token with permission to pull the private container package on the VPS. |

The migration container uses the production `DATABASE_URL` and application database user from the encrypted `.env.production` file. PostgreSQL must be attached to the external Docker network named `apps`, and the URL must use the PostgreSQL container's network hostname.

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

The PostgreSQL container must be connected to the same external network before deployment:

```bash
docker network create apps 2>/dev/null || true
docker network connect apps <postgres-container>
```

Log in once from the VPS if the GitHub package is private:

```bash
echo "$GHCR_PAT" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

The container listens only on `127.0.0.1:3003`. Put Nginx, Caddy, or another reverse proxy in front of it and proxy the public HTTPS domain to `http://127.0.0.1:3003`.

## Push notifications (postponed)

The systemd push-notification workers are currently postponed. The deployment workflow does not upload, install, or start any systemd units.

## First deployment

Run the `Deploy BrewBook` workflow manually from the repository's **Actions** tab. The workflow is currently configured with `workflow_dispatch`.

For the first deployment, check the jobs in this order:

1. **Build and Push Image** succeeds and publishes `ghcr.io/<owner>/<repo>:latest`.
2. **Deploy to VPS** uploads the Compose file, pulls the image, runs the one-shot `migrate` service on the `apps` network, and only then starts the app.

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

Do not run `db:push` in production. The deployment workflow runs the committed migrations in the VPS-side `migrate` container before starting the new app image. A failed migration prevents the app from being started by that deployment.

# Self-Hosting

## Quick start

```bash
cp .env.example .env
docker compose up -d --build
```

Open http://localhost:8080, then "Create account with passkey" to register.

## Adding a second device

On a device you're already signed in on: Account → "Add this device" shows a
6-digit code, valid for 5 minutes. On the new device, choose "I have a code
from another device," enter it, and create a passkey there — it joins the
same account instead of creating a new one.

## Backups

Everything lives in `./data`: `db.json` (accounts + passkey credentials) and
one `characters-<id>.json` per user. Back up that directory; there is no
database server to dump.

## Real deployments (your own domain)

Passkeys require HTTPS (except on `localhost`) and are bound to the exact
hostname in `RP_ID`. Put a reverse proxy / tunnel in front of this stack that
terminates TLS for your domain, point it at the `web` container's `WEB_PORT`,
then set `RP_ID` and `ORIGIN` in `.env` to match before anyone registers —
changing `RP_ID` later breaks existing passkeys.

## Automated deploys (optional)

`.github/workflows/deploy.yml` can SSH into your box and run `deploy/deploy.sh`
every time a push to `main` passes CI — `git fetch`/fast-forward + `docker
compose up -d --build`, skipped entirely if nothing changed. It never touches
`./data` or `.env` (both gitignored, and `./data` is a bind mount outside the
image), and takes a rotating backup of both into `~/backups` before pulling
anyway. Logs land in `deploy/deploy.log` on the box.

To turn it on:

1. **Generate a deploy-only key** (don't reuse your personal one):
   ```bash
   ssh-keygen -t ed25519 -f ttrp_deploy_key -N "" -C "github-actions-deploy"
   ```
2. **Add the public key to the box**, restricted so it can only ever run
   `deploy.sh` — even if the private key leaks, it can't open a shell:
   ```
   command="/home/<user>/<repo>/deploy/deploy.sh",no-port-forwarding,no-x11-forwarding,no-agent-forwarding,no-pty ssh-ed25519 AAAA... github-actions-deploy
   ```
   Append that line to `~/.ssh/authorized_keys` on the box.
3. **Add four repo secrets** (Settings → Secrets and variables → Actions):
   `DEPLOY_SSH_KEY` (the private key), `DEPLOY_HOST`, `DEPLOY_USER`,
   `DEPLOY_PORT`. Keep the host/user/port as secrets, not workflow text, if
   this repo is public.
4. Push to `main` — once CI passes, `deploy.yml` fires and the box updates
   itself. Run `deploy/deploy.sh` by hand on the box any time to deploy
   immediately without waiting on a push.

## What this does *not* cover

- Native iOS/Android builds — passkey login is web-only for now. Native
  builds hide the Account tab entirely.
- Publishing anywhere — this is a local, self-built stack. `docker compose
  up --build` builds both images from source; nothing is pulled from a
  registry.

## Troubleshooting

**Characters don't sync / "signing in" spins forever.** Open your browser's
dev tools → Network tab and reload. If the page loads but `/api/*` requests
fail, the `web` container's nginx proxy isn't reaching `api` — check `docker
compose logs api`.

**Sync silently does nothing after signing in.** Check the Console tab for a
COOP/COEP-related error. The app's local database (`wa-sqlite`) needs the
`Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` headers the
`web` container sets — if you've put another proxy in front that strips
response headers, make sure it passes these two through.

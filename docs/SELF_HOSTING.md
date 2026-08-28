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

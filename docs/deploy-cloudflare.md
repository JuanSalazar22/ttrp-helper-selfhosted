# Deploying the web demo to Cloudflare Pages

The web build is a static SPA (`expo export -p web` → `dist/`). It runs a real SQLite
database in the browser via **wa-sqlite**, which only works on a **cross-origin isolated**
page — so the host must send `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp`. Cloudflare Pages does this from
[`public/_headers`](../public/_headers), which Expo copies into `dist/_headers` on export.

## What's already in the repo

- `app.json` → `web.output: "single"` (SPA).
- `public/_headers` — the COOP/COEP headers (→ `dist/_headers`).
- `wrangler.jsonc` — Workers Static Assets config: serves `dist/` as a static SPA
  (assets-only, no Worker script). `not_found_handling: "single-page-application"` does
  the SPA fallback (so no `_redirects` file — Workers Assets rejects a `/* /index.html`
  rule as a self-loop). This is what `npx wrangler deploy` reads.
- `.nvmrc` → Node 20 (Cloudflare reads this for the build).
- `npm run build:web` — the production export.
- `npm run serve:web` — serve `dist/` locally **with the isolation headers** to test the
  production build before deploying (then open the printed `localhost:8083`).

## One-time setup (you do this — it needs your Cloudflare + GitHub sign-in)

Cloudflare now uses one **Workers** flow for everything (the old separate "Pages" wizard
is gone). With `wrangler.jsonc` in the repo, the Workers Builds flow deploys our static
site:

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Import a repository** →
   authorize GitHub and pick **JuanSalazar22/TTRP_helper**.
2. On "Set up your application":
   - **Project name:** `ttrp-helper` (must match the `name` in `wrangler.jsonc`)
   - **Build command:** `npm run build:web`
   - **Deploy command:** `npx wrangler deploy` (the default — leave it)
   - **API token:** leave "a new token will be created automatically"
3. **Deploy.** Cloudflare runs the build, then `wrangler deploy` uploads `dist/` as static
   assets. The site goes live at `https://ttrp-helper.<your-subdomain>.workers.dev`. Every
   push to `main` redeploys automatically.

> Verified locally with `npx wrangler deploy --dry-run`: reads all `dist/` files as
> assets-only (no bindings), config valid.

## Verify the live site

In the deployed page's DevTools console, `window.crossOriginIsolated` must be `true`
(Network tab → the document response should show the COOP/COEP headers). Then create a
character and reload — it should persist. If `crossOriginIsolated` is `false`, the
`_headers` file didn't take effect; confirm it exists at the site root (`/_headers` is
config, not served, but its rules apply to responses).

## Local check before pushing

```bash
npm run build:web      # produces dist/ (gitignored)
npm run serve:web      # serves dist/ at http://localhost:8083 with COOP/COEP
```

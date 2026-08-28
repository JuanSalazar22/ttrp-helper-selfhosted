// Serve the production web export (dist/) locally with the same cross-origin
// isolation headers Cloudflare Pages will send (from public/_headers). Use this to
// verify the deployed build before pushing:  npx expo export -p web && node scripts/serve-dist.mjs
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const DIST = join(process.cwd(), 'dist');
const PORT = Number(process.env.PORT) || 8083;
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.wasm': 'application/wasm', '.json': 'application/json', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.map': 'application/json', '.ttf': 'font/ttf', '.woff2': 'font/woff2',
};

const server = http.createServer(async (req, res) => {
  // Mirror public/_headers so wa-sqlite can cross-origin isolate.
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let filePath = normalize(join(DIST, urlPath));
  if (!filePath.startsWith(DIST)) { res.writeHead(403); return res.end('Forbidden'); }

  let info = await stat(filePath).catch(() => null);
  if (info && info.isDirectory()) {
    filePath = join(filePath, 'index.html');
    info = await stat(filePath).catch(() => null);
  }
  if (!info) filePath = join(DIST, 'index.html'); // SPA fallback (mirrors wrangler not_found_handling)

  try {
    const data = await readFile(filePath);
    res.setHeader('Content-Type', MIME[extname(filePath)] || 'application/octet-stream');
    res.writeHead(200);
    res.end(data);
  } catch (e) {
    res.writeHead(500);
    res.end(String(e));
  }
});

server.listen(PORT, () => console.log(`Serving dist/ (cross-origin isolated) at http://localhost:${PORT}`));

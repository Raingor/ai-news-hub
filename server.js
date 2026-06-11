import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { SOURCES, CACHE_TTL } from './lib/sources.js';
import { refreshAllData } from './lib/fetchers.js';

// ============================================
// IN-MEMORY CACHE with refresh lock
// ============================================
let cache = {
  articles: [],
  models: [],
  github: [],
  lastFetched: 0,
  errors: [],
  totalSources: 0,
  successfulSources: 0,
};

// Prevent concurrent refresh calls (race condition fix)
let refreshPromise = null;

async function refreshCache() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = refreshAllData()
    .then(data => {
      cache = data;
      return data;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

// ============================================
// MIME TYPES
// ============================================
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

// ============================================
// SECURITY HEADERS
// ============================================
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

// ============================================
// HTTP SERVER
// ============================================
const PORT = parseInt(process.env.PORT || '8088', 10);
const PUBLIC_DIR = join(process.cwd(), 'public');

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const path = url.pathname;

    // API: /api/news — returns all data sections
    if (path === '/api/news') {
      if (Date.now() - cache.lastFetched > CACHE_TTL) {
        await refreshCache();
      }

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
        ...SECURITY_HEADERS,
      });
      res.end(JSON.stringify(cache));
      return;
    }

    // Static files (async read)
    let filePath = path === '/'
      ? join(PUBLIC_DIR, 'index.html')
      : join(PUBLIC_DIR, path);

    // Path traversal protection
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403, SECURITY_HEADERS);
      res.end('Forbidden');
      return;
    }

    try {
      const data = await readFile(filePath);
      const ext = extname(filePath);
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        ...SECURITY_HEADERS,
      });
      res.end(data);
    } catch {
      res.writeHead(404, SECURITY_HEADERS);
      res.end('Not Found');
    }
  } catch (err) {
    console.error('[server] Unhandled error:', err);
    if (!res.headersSent) {
      res.writeHead(500, SECURITY_HEADERS);
    }
    res.end('Internal Server Error');
  }
});

// Start
refreshCache().then(() => {
  server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║  AI Intelligence Hub                                    ║
║  http://localhost:${PORT}/                                  ║
║                                                          ║
║  ├─ AI News     (${SOURCES.length} RSS sources)                    ║
║  ├─ OpenRouter  (model rankings)                        ║
║  └─ GitHub      (trending AI repos)                     ║
║                                                          ║
║  Auto-refresh every ${CACHE_TTL / 60000} min                  ║
╚══════════════════════════════════════════════════════════╝
    `);
  });
});

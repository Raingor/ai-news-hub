/**
 * Static Data Generator
 *
 * Fetches all data sources (RSS news, OpenRouter models, GitHub trending repos)
 * and writes the result to data/news.json for use with GitHub Pages.
 *
 * Usage: node scripts/generate-static.js
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { refreshAllData } from '../lib/fetchers.js';
import { truncate } from '../lib/fetchers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const MAX_DESC_LEN = 200;

async function generate() {
  console.log('[generate] ===== Fetching all data sources =====');
  const startTime = Date.now();

  // Use shared refreshAllData (runs all sources in parallel)
  const data = await refreshAllData();

  // Truncate descriptions for static output
  for (const a of data.articles) {
    if (a.description && a.description.length > MAX_DESC_LEN) {
      a.description = truncate(a.description, MAX_DESC_LEN);
    }
  }

  const payload = {
    generatedAt: startTime,
    ...data,
  };

  // Ensure data directory exists
  const dataDir = join(ROOT, 'data');
  mkdirSync(dataDir, { recursive: true });

  // Write to data/news.json
  const outPath = join(dataDir, 'news.json');
  writeFileSync(outPath, JSON.stringify(payload), 'utf-8');

  console.log(`\n[generate] ✓ Generated → data/news.json`);
  console.log(`  Articles: ${data.totalArticles}  |  Models: ${data.totalModels}  |  GitHub repos: ${data.totalGithub}`);
  console.log(`  Sources: ${data.successfulSources}/${data.totalSources} OK`);

  if (data.errors.length > 0) {
    console.error(`[generate] ✗ Failed: ${data.errors.length} source(s)`);
    for (const e of data.errors) console.error(`  - ${e.source}: ${e.error}`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone in ${elapsed}s`);
}

generate().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

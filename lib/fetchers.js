/**
 * Shared data fetchers and parsers.
 * Used by both server.js and scripts/generate-static.js.
 */
import { XMLParser } from 'fast-xml-parser';
import { SOURCES, OPENROUTER_API, GITHUB_SEARCH_URLS } from './sources.js';

// XML parser config
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: true,
  trimValues: true,
});

// ============================================
// HTML UTILITIES
// ============================================
export function stripHtml(html) {
  if (!html) return '';
  if (typeof html === 'object') html = html['#text'] || html.content || JSON.stringify(html);
  if (typeof html !== 'string') html = String(html);
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(str, max) {
  if (!str || str.length <= max) return str || '';
  return str.slice(0, max).replace(/\s+\S*$/, '') + '\u2026';
}

// ============================================
// RSS FETCHING
// ============================================
const FETCH_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; AI-News-Hub/1.0)' };
const FETCH_TIMEOUT = 15000;

export async function fetchSource(source) {
  const response = await fetch(source.url, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const xml = await response.text();
  const parsed = parser.parse(xml);
  return { source: source.name, lang: source.lang, parsed };
}

export function extractArticles(sourceName, lang, parsed) {
  const articles = [];
  function toStr(v) {
    if (!v) return '';
    if (typeof v === 'object') return v['#text'] || '';
    return String(v);
  }
  // RSS 2.0
  if (parsed.rss?.channel?.item) {
    const items = Array.isArray(parsed.rss.channel.item)
      ? parsed.rss.channel.item : [parsed.rss.channel.item];
    for (const item of items) {
      articles.push({
        title: toStr(item.title),
        link: toStr(item.link),
        description: stripHtml(item.description || ''),
        pubDate: toStr(item.pubDate || item['dc:date'] || ''),
        source: sourceName,
        lang,
      });
    }
  }
  // Atom format
  if (parsed.feed?.entry) {
    const entries = Array.isArray(parsed.feed.entry)
      ? parsed.feed.entry : [parsed.feed.entry];
    for (const entry of entries) {
      let link = '';
      if (typeof entry.link === 'object') {
        link = entry.link['@_href']
          || (Array.isArray(entry.link) ? entry.link.find(l => l['@_rel'] === 'alternate')?.['@_href'] : '')
          || '';
      }
      articles.push({
        title: toStr(entry.title),
        link,
        description: stripHtml(entry.summary || entry.content || ''),
        pubDate: toStr(entry.published || entry.updated || ''),
        source: sourceName,
        lang,
      });
    }
  }
  return articles;
}

// ============================================
// FETCH ALL RSS SOURCES
// ============================================
export async function fetchAllRSS() {
  const rssResults = await Promise.allSettled(SOURCES.map(s => fetchSource(s)));
  const allArticles = [];
  const errors = [];

  for (let i = 0; i < rssResults.length; i++) {
    const r = rssResults[i];
    if (r.status === 'fulfilled') {
      const articles = extractArticles(SOURCES[i].name, r.value.lang, r.value.parsed);
      allArticles.push(...articles);
      console.log(`  [rss] ${SOURCES[i].name}: ${articles.length} articles`);
    } else {
      errors.push({ source: SOURCES[i].name, error: r.reason?.message || 'Unknown error' });
      console.error(`  [rss] ${SOURCES[i].name}: FAILED - ${r.reason?.message}`);
    }
  }

  allArticles.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  return { articles: allArticles, errors };
}

// ============================================
// OPENROUTER MODEL RANKINGS
// ============================================
export async function fetchOpenRouterModels() {
  const response = await fetch(OPENROUTER_API, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const models = data.data || [];

  models.sort((a, b) => (b.created || 0) - (a.created || 0));

  return models.slice(0, 50).map((m, i) => ({
    rank: i + 1,
    id: m.id || '',
    name: m.name || m.id || '',
    created: m.created || 0,
    context_length: m.context_length || 0,
    description: stripHtml(m.description || ''),
    pricing: m.pricing || { prompt: '?', completion: '?' },
    architecture: m.architecture || null,
    top_provider: m.top_provider?.name || m.top_provider?.provider || '',
  }));
}

// ============================================
// GITHUB TRENDING AI REPOS
// ============================================
export async function fetchGitHubTrending() {
  const allItems = [];
  const seen = new Set();

  // Support GitHub token for higher rate limits
  const headers = {
    'User-Agent': 'AI-News-Hub/1.0',
    'Accept': 'application/vnd.github.v3+json',
  };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  for (const url of GITHUB_SEARCH_URLS) {
    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const items = data.items || [];
      for (const repo of items) {
        if (!seen.has(repo.full_name || repo.name)) {
          seen.add(repo.full_name || repo.name);
          allItems.push(repo);
        }
      }
    } catch (err) {
      console.error(`  [github] sub-query failed: ${err.message}`);
    }
  }

  allItems.sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0));

  return allItems.slice(0, 25).map(repo => ({
    name: repo.full_name || repo.name || '',
    url: repo.html_url || '',
    description: repo.description || '',
    stars: repo.stargazers_count || 0,
    forks: repo.forks_count || 0,
    language: repo.language || '',
    topics: repo.topics || [],
    updated_at: repo.updated_at || '',
    created_at: repo.created_at || '',
    owner_avatar: repo.owner?.avatar_url || '',
    owner_login: repo.owner?.login || '',
  }));
}

// ============================================
// REFRESH ALL DATA (parallel)
// ============================================
export async function refreshAllData() {
  console.log('[ai-news] ===== Refreshing all data sources =====');

  // Run all three data sources in parallel
  const [rssResult, modelsResult, githubResult] = await Promise.allSettled([
    fetchAllRSS(),
    fetchOpenRouterModels(),
    fetchGitHubTrending(),
  ]);

  // Process RSS
  const articles = rssResult.status === 'fulfilled' ? rssResult.value.articles : [];
  const errors = rssResult.status === 'fulfilled' ? [...rssResult.value.errors] : [];

  // Process OpenRouter
  let models = [];
  if (modelsResult.status === 'fulfilled') {
    models = modelsResult.value;
    console.log(`  [openrouter] ${models.length} models loaded`);
  } else {
    errors.push({ source: 'OpenRouter Rankings', error: modelsResult.reason?.message || 'Unknown' });
    console.error(`  [openrouter] FAILED - ${modelsResult.reason?.message}`);
  }

  // Process GitHub
  let github = [];
  if (githubResult.status === 'fulfilled') {
    github = githubResult.value;
    console.log(`  [github] ${github.length} repos loaded`);
  } else {
    errors.push({ source: 'GitHub Trending AI', error: githubResult.reason?.message || 'Unknown' });
    console.error(`  [github] FAILED - ${githubResult.reason?.message}`);
  }

  const totalSources = SOURCES.length + 2;
  const successfulSources = totalSources - errors.length;

  const result = {
    articles,
    models,
    github,
    lastFetched: Date.now(),
    errors,
    totalSources,
    successfulSources,
    totalArticles: articles.length,
    totalModels: models.length,
    totalGithub: github.length,
  };

  console.log(`[ai-news] ===== Refresh complete =====`);
  console.log(`  Articles: ${articles.length}  |  Models: ${models.length}  |  GitHub repos: ${github.length}`);
  console.log(`  Sources: ${successfulSources}/${totalSources} OK`);

  return result;
}

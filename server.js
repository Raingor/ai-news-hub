import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join, extname, normalize } from 'path';
import { XMLParser } from 'fast-xml-parser';

// ============================================
// RSS SOURCES
// ============================================
const SOURCES = [
  // English sources
  { name: 'ArXiv ML (cs.LG)', url: 'https://export.arxiv.org/rss/cs.LG', lang: 'en' },
  { name: 'ArXiv NLP (cs.CL)', url: 'https://export.arxiv.org/rss/cs.CL', lang: 'en' },
  { name: 'ArXiv Vision (cs.CV)', url: 'https://export.arxiv.org/rss/cs.CV', lang: 'en' },
  { name: 'ArXiv AI (cs.AI)', url: 'https://export.arxiv.org/rss/cs.AI', lang: 'en' },
  { name: 'Hugging Face Blog', url: 'https://huggingface.co/blog/feed.xml', lang: 'en' },
  { name: 'OpenAI Blog', url: 'https://openai.com/blog/rss.xml', lang: 'en' },
  { name: 'Reddit r/MachineLearning', url: 'https://www.reddit.com/r/MachineLearning/.rss', lang: 'en' },
  { name: 'Reddit r/LocalLLaMA', url: 'https://www.reddit.com/r/LocalLLaMA/.rss', lang: 'en' },
  { name: 'AI Model News', url: 'https://news.google.com/rss/search?q=(OpenAI+OR+Anthropic+OR+DeepSeek+OR+Qwen+OR+"AI+model"+OR+"large+language+model"+OR+LLM+OR+GPT+OR+Claude)+when:2d&hl=en-US&gl=US&ceid=US:en', lang: 'en' },
  { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/', lang: 'en' },
  // Chinese sources
  { name: 'zh: 雷峰网 AI', url: 'https://www.leiphone.com/feed', lang: 'zh' },
  { name: 'zh: 钛媒体', url: 'https://www.tmtpost.com/rss', lang: 'zh' },
  { name: 'zh: 动点科技', url: 'https://cn.technode.com/feed/', lang: 'zh' },
  { name: 'zh: 中文大模型动态', url: 'https://news.google.com/rss/search?q=(DeepSeek+OR+%E9%80%9A%E4%B9%89%E5%8D%83%E9%97%AE+OR+%E6%96%87%E5%BF%83%E4%B8%80%E8%A8%80+OR+%E6%99%BA%E8%B0%B1+OR+%E6%9C%88%E4%B9%8B%E6%9A%97%E9%9D%A2+OR+Kimi+OR+Qwen+OR+ChatGLM+OR+Baichuan+OR+%E9%98%B6%E8%B7%83%E6%98%9F%E8%BE%B0+OR+MiniMax+OR+%E9%9B%B6%E4%B8%80%E4%B8%87%E7%89%A9+OR+%E7%99%BE%E5%B7%9D+OR+%E6%98%9F%E7%81%AB+%E5%A4%A7%E6%A8%A1%E5%9E%8B)+when:2d&hl=zh-CN&gl=CN&ceid=CN:zh-Hans', lang: 'zh' },
  { name: 'zh: AI开源模型动态', url: 'https://news.google.com/rss/search?q=(%E5%BC%80%E6%BA%90+%E5%A4%A7%E6%A8%A1%E5%9E%8B+OR+%E6%B7%B1%E5%BA%A6%E5%AD%A6%E4%B9%A0+%E6%A1%86%E6%9E%B6+OR+%E8%AE%AD%E7%BB%83+AI+%E6%A8%A1%E5%9E%8B+OR+%E5%8F%91%E5%B8%83+LLM+OR+OpenAI+%E4%B8%AD%E6%96%87+OR+AI+%E7%AE%97%E6%B3%95+%E7%AA%81%E7%A0%B4)+when:1w&hl=zh-CN&gl=CN&ceid=CN:zh-Hans', lang: 'zh' },
];

// ============================================
// XML PARSER CONFIG
// ============================================
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: true,
  trimValues: true,
});

// ============================================
// IN-MEMORY CACHE
// ============================================
let cache = { articles: [], lastFetched: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ============================================
// RSS FETCHING
// ============================================
async function fetchSource(source) {
  const response = await fetch(source.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AI-News-Hub/1.0)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const xml = await response.text();
  const parsed = parser.parse(xml);
  return { source: source.name, lang: source.lang, parsed };
}

function extractArticles(sourceName, lang, parsed) {
  const articles = [];

  function toStr(v) {
    if (!v) return '';
    if (typeof v === 'object') return v['#text'] || '';
    return String(v);
  }

  // RSS 2.0 format
  if (parsed.rss?.channel?.item) {
    const items = Array.isArray(parsed.rss.channel.item)
      ? parsed.rss.channel.item
      : [parsed.rss.channel.item];
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
      ? parsed.feed.entry
      : [parsed.feed.entry];
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

function stripHtml(html) {
  if (!html) return '';
  if (typeof html === 'object') {
    // fast-xml-parser sometimes returns objects for CDATA/nested content
    html = html['#text'] || html.content || JSON.stringify(html);
  }
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

async function refreshCache() {
  console.log('[ai-news] Fetching all sources...');
  const results = await Promise.allSettled(
    SOURCES.map(s => fetchSource(s))
  );

  const allArticles = [];
  const errors = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled') {
      const articles = extractArticles(SOURCES[i].name, r.value.lang, r.value.parsed);
      allArticles.push(...articles);
      console.log(`[ai-news] ${SOURCES[i].name}: ${articles.length} articles`);
    } else {
      errors.push({ source: SOURCES[i].name, error: r.reason?.message || 'Unknown error' });
      console.error(`[ai-news] ${SOURCES[i].name}: FAILED - ${r.reason?.message}`);
    }
  }

  // Sort by date (newest first), articles without dates at the end
  allArticles.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  cache = {
    articles: allArticles,
    lastFetched: Date.now(),
    errors,
    totalSources: SOURCES.length,
    successfulSources: SOURCES.length - errors.length,
  };

  console.log(`[ai-news] Total: ${allArticles.length} articles from ${cache.successfulSources}/${cache.totalSources} sources`);
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
// HTTP SERVER
// ============================================
const PORT = parseInt(process.env.PORT || '8088', 10);

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // API: /api/news
  if (path === '/api/news') {
    // Refresh cache if stale
    if (Date.now() - cache.lastFetched > CACHE_TTL) {
      await refreshCache();
    }

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    });
    res.end(JSON.stringify({
      articles: cache.articles,
      lastFetched: cache.lastFetched,
      errors: cache.errors || [],
      totalSources: cache.totalSources,
      successfulSources: cache.successfulSources,
    }));
    return;
  }

  // Static files
  const publicDir = join(process.cwd(), 'public');
  let filePath = path === '/'
    ? join(publicDir, 'index.html')
    : join(publicDir, path);

  // Prevent directory traversal
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const data = readFileSync(filePath);
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// Initial fetch on startup
refreshCache().then(() => {
  server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════╗
║  AI Models News Hub                     ║
║  http://localhost:${PORT}/                  ║
║                                          ║
║  ${SOURCES.length} RSS sources               ║
║  Auto-refresh every ${CACHE_TTL / 60000} min              ║
╚══════════════════════════════════════════╝
    `);
  });
});

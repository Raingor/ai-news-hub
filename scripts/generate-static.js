/**
 * Static RSS News Generator
 *
 * Fetches all RSS sources, parses them, and writes the result
 * to data/news.json for use with GitHub Pages (no running server needed).
 *
 * Usage: node scripts/generate-static.js
 */
import { createWriteStream, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { XMLParser } from 'fast-xml-parser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

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
  { name: 'zh: 中文大模型动态', url: 'https://news.google.com/rss/search?q=(DeepSeek+OR+通义千问+OR+文心一言+OR+智谱+OR+月之暗面+OR+Kimi+OR+Qwen+OR+ChatGLM+OR+Baichuan+OR+阶跃星辰+OR+MiniMax+OR+零一万物+OR+百川+OR+星火+大模型)+when:2d&hl=zh-CN&gl=CN&ceid=CN:zh-Hans', lang: 'zh' },
  { name: 'zh: AI开源模型动态', url: 'https://news.google.com/rss/search?q=(开源+大模型+OR+深度学习+框架+OR+训练+AI+模型+OR+发布+LLM+OR+OpenAI+中文+OR+AI+算法+突破)+when:1w&hl=zh-CN&gl=CN&ceid=CN:zh-Hans', lang: 'zh' },
];

// ============================================
// XML PARSER
// ============================================
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: true,
  trimValues: true,
});

// ============================================
// SOURCE URLS THAT NEED A PROXY (for local testing)
// ============================================
const NEED_PROXY = [
  'news.google.com',
  'leiphone.com',
  'tmtpost.com',
  'technode.com',
];

function shouldUseProxy(url) {
  return NEED_PROXY.some(host => url.includes(host));
}

async function fetchSource(source) {
  const options = { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AI-News-Hub/1.0; +https://github.com/Raingor/ai-news-hub)' }, signal: AbortSignal.timeout(15000) };

  // If running in GitHub Actions, no proxy needed — the runner is in the cloud
  // For local testing, respect HTTP_PROXY/HTTPS_PROXY env vars automatically
  // (Node.js fetch doesn't auto-use proxies, but we could add undici or global-agent)
  // For simplicity: in local dev, if you need proxy, prepend command with HTTP_PROXY=...

  const response = await fetch(source.url, options);
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

  // RSS 2.0
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

// Truncate description to keep JSON size manageable for GitHub Pages
const MAX_DESC_LEN = 200;
function truncateDesc(articles) {
  for (const a of articles) {
    if (a.description && a.description.length > MAX_DESC_LEN) {
      a.description = a.description.slice(0, MAX_DESC_LEN).replace(/\s+\S*$/, '') + '…';
    }
  }
  return articles;
}

function stripHtml(html) {
  if (!html) return '';
  if (typeof html === 'object') {
    html = html['#text'] || html.content || JSON.stringify(html);
  }
  if (typeof html !== 'string') html = String(html);
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function generate() {
  console.log('[generate] Fetching all RSS sources...');
  const startTime = Date.now();

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
      truncateDesc(articles);
      console.log(`  ✓ ${SOURCES[i].name}: ${articles.length} articles`);
    } else {
      errors.push({ source: SOURCES[i].name, error: r.reason?.message || 'Unknown error' });
      console.error(`  ✗ ${SOURCES[i].name}: FAILED - ${r.reason?.message}`);
    }
  }

  // Sort by date (newest first)
  allArticles.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  const payload = {
    generatedAt: startTime,
    articles: allArticles,
    errors,
    totalSources: SOURCES.length,
    successfulSources: SOURCES.length - errors.length,
  };

  // Write to data/news.json
  const outPath = join(ROOT, 'data', 'news.json');
  writeFileSync(outPath, JSON.stringify(payload), 'utf-8');
  console.log(`\n✓ Generated ${allArticles.length} articles → data/news.json`);
  console.log(`✓ Successful: ${payload.successfulSources}/${payload.totalSources} sources`);

  if (errors.length > 0) {
    console.error(`✗ Failed: ${errors.length} sources`);
    for (const e of errors) {
      console.error(`  - ${e.source}: ${e.error}`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone in ${elapsed}s`);
}

generate().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

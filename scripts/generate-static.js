/**
 * Static Data Generator
 *
 * Fetches all data sources (RSS news, OpenRouter models, GitHub trending repos)
 * and writes the result to data/news.json for use with GitHub Pages.
 *
 * Usage: node scripts/generate-static.js
 */
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { XMLParser } from 'fast-xml-parser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ============================================
// RSS SOURCES
// ============================================
const SOURCES = [
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
// RSS FETCHING (same as server.js)
// ============================================
async function fetchSource(source) {
  const response = await fetch(source.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AI-News-Hub/1.0; +https://github.com/Raingor/ai-news-hub)' },
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
  if (typeof html === 'object') html = html['#text'] || html.content || JSON.stringify(html);
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

// ============================================
// OPENROUTER MODELS
// ============================================
const OPENROUTER_API = 'https://openrouter.ai/api/v1/models';

async function fetchOpenRouterModels() {
  const response = await fetch(OPENROUTER_API, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AI-News-Hub/1.0)' },
    signal: AbortSignal.timeout(15000),
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
const GITHUB_SEARCH_API = 'https://api.github.com/search/repositories?q=artificial-intelligence+sort:stars&per_page=25';
const GITHUB_SEARCH_API_2 = 'https://api.github.com/search/repositories?q=machine-learning+sort:stars&per_page=25';
const GITHUB_SEARCH_API_3 = 'https://api.github.com/search/repositories?q=LLM+sort:stars&per_page=25';

async function fetchGitHubTrending() {
  const allItems = [];
  const seen = new Set();
  const urls = [GITHUB_SEARCH_API, GITHUB_SEARCH_API_2, GITHUB_SEARCH_API_3];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'AI-News-Hub/1.0',
          'Accept': 'application/vnd.github.v3+json',
        },
        signal: AbortSignal.timeout(15000),
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
      console.error(`[github] sub-query failed: ${err.message}`);
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
// MAIN
// ============================================
async function generate() {
  console.log('[generate] ===== Fetching all data sources =====');
  const startTime = Date.now();

  const allErrors = [];

  // 1) RSS articles
  console.log('\n[generate] --- RSS News Sources ---');
  const rssResults = await Promise.allSettled(SOURCES.map(s => fetchSource(s)));
  const allArticles = [];
  for (let i = 0; i < rssResults.length; i++) {
    const r = rssResults[i];
    if (r.status === 'fulfilled') {
      const articles = extractArticles(SOURCES[i].name, r.value.lang, r.value.parsed);
      allArticles.push(...articles);
      truncateDesc(articles);
      console.log(`  ✓ ${SOURCES[i].name}: ${articles.length} articles`);
    } else {
      allErrors.push({ source: SOURCES[i].name, error: r.reason?.message || 'Unknown error' });
      console.error(`  ✗ ${SOURCES[i].name}: FAILED - ${r.reason?.message}`);
    }
  }
  allArticles.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  // 2) OpenRouter models
  console.log('\n[generate] --- OpenRouter Model Rankings ---');
  let models = [];
  try {
    models = await fetchOpenRouterModels();
    console.log(`  ✓ ${models.length} models`);
  } catch (err) {
    allErrors.push({ source: 'OpenRouter Rankings', error: err.message });
    console.error(`  ✗ OpenRouter: FAILED - ${err.message}`);
  }

  // 3) GitHub trending AI repos
  console.log('\n[generate] --- GitHub Trending AI Repos ---');
  let github = [];
  try {
    github = await fetchGitHubTrending();
    console.log(`  ✓ ${github.length} repos`);
  } catch (err) {
    allErrors.push({ source: 'GitHub Trending AI', error: err.message });
    console.error(`  ✗ GitHub: FAILED - ${err.message}`);
  }

  const totalSources = SOURCES.length + 2;
  const successfulSources = totalSources - allErrors.length;

  const payload = {
    generatedAt: startTime,
    articles: allArticles,
    models,
    github,
    errors: allErrors,
    totalSources,
    successfulSources,
    totalArticles: allArticles.length,
    totalModels: models.length,
    totalGithub: github.length,
  };

  // Write to data/news.json
  const outPath = join(ROOT, 'data', 'news.json');
  writeFileSync(outPath, JSON.stringify(payload), 'utf-8');

  console.log(`\n✓ Generated → data/news.json`);
  console.log(`  Articles: ${allArticles.length}  |  Models: ${models.length}  |  GitHub repos: ${github.length}`);
  console.log(`  Sources: ${successfulSources}/${totalSources} OK`);

  if (allErrors.length > 0) {
    console.error(`✗ Failed: ${allErrors.length} source(s)`);
    for (const e of allErrors) console.error(`  - ${e.source}: ${e.error}`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone in ${elapsed}s`);
}

generate().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

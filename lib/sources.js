/**
 * Shared RSS sources configuration and API endpoints.
 */

// RSS feed sources
export const SOURCES = [
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

// API endpoints
export const OPENROUTER_API = 'https://openrouter.ai/api/v1/models';
export const GITHUB_SEARCH_URLS = [
  'https://api.github.com/search/repositories?q=artificial-intelligence+sort:stars&per_page=25',
  'https://api.github.com/search/repositories?q=machine-learning+sort:stars&per_page=25',
  'https://api.github.com/search/repositories?q=LLM+sort:stars&per_page=25',
];

// Cache TTL in milliseconds
export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

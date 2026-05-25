# CODEBUDDY.md

This file provides guidance to CodeBuddy Code when working with code in this repository.

## Project Overview

AI Models News Hub — a standalone local site that aggregates AI model news from 17 global RSS sources (both English and Chinese). A lightweight Node.js backend fetches & parses RSS feeds, caches results, and serves them to a dark-theme single-page frontend.

## Quick Start

```bash
npm install        # Install fast-xml-parser (only dependency)
npm start          # Start on http://localhost:8088
```

For Chinese sources behind the GFW, use Clash Verge proxy:

```bash
HTTP_PROXY=http://127.0.0.1:7897 HTTPS_PROXY=http://127.0.0.1:7897 npm start
```

## Architecture

```
ai-news-hub/
├── package.json       # Deps: fast-xml-parser only
├── server.js          # Node.js HTTP server + RSS fetcher (250 lines)
├── public/
│   └── index.html     # SPA frontend (dark theme, responsive, 490 lines)
└── CODEBUDDY.md
```

### Server (`server.js`)

A single Node.js file with no Express dependency, using the built-in `http` module:

- **`SOURCES` array** (line 9-29) — 17 RSS feed definitions. Each entry has `name`, `url`, and `lang` (`en`/`zh`).
- **`fetchSource()`** (line 51) — Fetches a single RSS URL with 15s timeout.
- **`extractArticles()`** (line 62) — Parses RSS 2.0 and Atom 1.0 XML via `fast-xml-parser`. Handles edge cases: CDATA objects, nested XML in description fields, various link formats.
- **`stripHtml()`** (line 114) — Strips HTML tags from article descriptions, handles `fast-xml-parser` object returns for CDATA content.
- **`refreshCache()`** (line 132) — Fetches all sources in parallel via `Promise.allSettled`, deduplicates and sorts articles by date (newest first).
- **In-memory cache** (line 42-46) — `{ articles, lastFetched }`, TTL = 5 minutes.
- **HTTP server** (line 189) — Two routes: `/api/news` (JSON with articles + source status) and static file serving from `public/`.
- **Port**: 8088 (configurable via `PORT` env var).

### Frontend (`public/index.html`)

A single self-contained HTML file (no build step, no frameworks):

- **Dark theme** with CSS custom properties (`--bg`, `--surface`, `--accent`, etc.)
- **`loadNews()`** — Fetches `/api/news` every 60 seconds (auto-refresh interval).
- **`renderSources()`** — Creates source filter pills with article counts.
- **`setSource(name)`** / **`setLang(lang)`** — Filter articles by source or language (`en`/`zh`).
- **`renderArticles()`** — Renders article cards with: title (linked), source badge, language badge, relative date, description snippet (300 chars). Filters by source, language, and search query.
- **`formatDate()`** — Shows relative time ("5m ago", "3h ago") or absolute date.
- **`escapeHtml()`** — XSS prevention on all user-facing strings.

## RSS Sources

| Count | Language | Sources |
|-------|----------|---------|
| 10 | en | ArXiv (cs.LG/CL/CV/AI), Hugging Face Blog, OpenAI Blog, Reddit (r/MachineLearning, r/LocalLLaMA), Google News AI Model Search, VentureBeat AI |
| 7 | zh | 雷峰网 AI, IT之家, 36氪, 钛媒体, 动点科技, Google News 中文大模型动态, Google News AI开源模型动态 |

## How to Add a New RSS Source

1. Add entry to `SOURCES` array in `server.js` (lines 9-29):
   ```js
   { name: 'Source Name', url: 'https://example.com/feed.xml', lang: 'en' },
   ```
2. Restart the server — no frontend changes needed. The source filter pill appears automatically.

## Key Behaviors

- **Cache**: Backend caches articles for 5 minutes before refetching all sources.
- **Auto-refresh**: Frontend polls `/api/news` every 60 seconds.
- **Error resilience**: Failed sources don't crash the server; errors are reported in the API response and shown in the UI.
- **Proxy**: Chinese sources (and some English ones) require Clash Verge proxy via `HTTP_PROXY`/`HTTPS_PROXY` env vars due to GFW.
- **No persistence**: Everything is in-memory; restarting the server clears the cache.

## Environment Variables

- `PORT` — Server port (default: 8088)
- `HTTP_PROXY`, `HTTPS_PROXY` — Proxy for RSS fetches (required for Chinese sources)

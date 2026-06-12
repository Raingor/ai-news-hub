# AI Models News Hub

> **Live site:** [raingor.github.io/ai-news-hub](https://raingor.github.io/ai-news-hub)

A bilingual news aggregator that collects the latest AI research, model releases, and industry news from 15 global RSS sources.

## Features

- **15 RSS Sources** — ArXiv (cs.LG, cs.CL, cs.CV, cs.AI), Hugging Face, OpenAI, Reddit (r/MachineLearning, r/LocalLLaMA), Google News, VentureBeat, 雷锋网, 钛媒体, 动点科技, and more
- **Bilingual** — English and Chinese sources, with language filtering
- **Editorial UI** — Magazine-style layout with warm paper tones, Playfair Display & Source Serif 4 typography
- **Search & Filters** — Full-text search, language toggle, per-source filtering
- **Two modes:**
  - **Server mode** — Real-time RSS polling with 5-min cache (port 8088)
  - **Static mode** — Pre-generated JSON via GitHub Actions, suitable for GitHub Pages

## Usage

### Server mode

```bash
npm start
# → http://localhost:8088
```

### Static mode (GitHub Pages)

```bash
npm ci
node scripts/generate-static.js
```

The generated file `data/news.json` can be served as a static site. A GitHub Actions workflow (`.github/workflows/update-news.yml`) runs hourly to regenerate it on the `main` branch.

## Project structure

```
├── public/
│   └── index.html          # Frontend (inline CSS + JS)
├── data/
│   └── news.json           # Generated static data
├── scripts/
│   └── generate-static.js  # Static data generator
├── server.js               # Dev/production server
├── package.json
└── design.md               # Design system docs
```

## Tech stack

- Node.js (HTTP server, no framework — pure `http` module)
- `fast-xml-parser` for RSS/Atom parsing
- Vanilla HTML/CSS/JS frontend (no build step)
- GitHub Actions for scheduled static generation

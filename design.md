# Design System — AI Intelligence Hub (v2)

## Concept Overview

**"Digital Newsprint"** — A warm editorial/magazine-style interface inspired by high-end printed technology publications. Paper-yellow backgrounds, refined serif typography, and clean whitespace-heavy layout. v2 expands from a single news feed into a **three-tab intelligence dashboard** covering model rankings, trending GitHub repos, and global AI news.

---

## Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#f5f0e6` | Page background — aged cream paper |
| `--surface` | `#faf6ef` | Card/masthead background — lighter paper |
| `--surface2` | `#efe8d8` | Badge/pill background — slightly darker |
| `--border` | `#d4c9b0` | Borders — warm beige |
| `--text` | `#2c2416` | Body text — warm brown-black |
| `--text2` | `#8a7a64` | Secondary text — muted warm brown |
| `--accent` | `#c43a24` | Accent — deep magazine masthead red |
| `--link` | `#8b3a2a` | Link color — dark brick red |
| `--green` | `#3a7a4a` | Status OK |
| `--teal` | `#3a7a8a` | Language badge (zh) / model provider |
| `--red` | `#c43a24` | Error / FAIL |
| `--gold` | `#b8963a` | #1 rank badge |

---

## Typography

| Role | Font | Weight | Usage |
|------|------|--------|-------|
| Logo / Masthead | Playfair Display | 800 italic | `h1` site title |
| Article headlines | Playfair Display | 700 | Article titles in cards |
| Body text | Source Serif 4 | 400–600 | Article descriptions, model names |
| UI labels | Outfit | 400–600 | Tabs, controls, status, section headers |
| Data / Meta | JetBrains Mono | 400–500 | Source names, dates, model IDs, counts, pricing |

- Base font size: `16px`
- Body line-height: `1.7`
- Article title: `22px` (desktop), `16px` (mobile)
- UI labels: `10–13px`, uppercase + letter-spaced for labels

---

## Layout

- **Container max-width**: `1200px`, centered with `24px` side padding
- **Tab bar**: Sticky at top, 3 tabs with active underline indicator in accent red
- **Model Rankings tab**: Full-width table, responsive (hides description + pricing columns on mobile)
- **GitHub tab**: 2-column card grid (`repeat(2, 1fr)`), collapses to 1 column at `≤960px`
- **News tab**: 3-column article grid, collapses to 1 column at `≤540px`
- **Responsive breakpoints**: `960px` (GitHub → 1-col), `720px` (mobile layout), `540px` (1-col articles)

---

## Components

### Masthead Header
- Supertitle ("AI INTELLIGENCE") in 11px Outfit uppercase, accent red
- Title ("Intelligence Hub") in Playfair Display 800 italic, 36px
- Status indicator with pulsing green dot
- Refresh button with rotating SVG icon on loading

### Tab Navigation
- Sticky bar below header, 3 tabs with icons + count badges
- Active tab: accent red bottom border, dark text
- Badge: counts for each section (models/github/articles)
- Responsive: badges hidden at `≤720px`, scrollable at `≤540px`

### Tab 1 — Model Rankings Table
- Clean magazine table with alternating row hover
- Rank column: Playfair Display large numbers, gold/silver/bronze for top 3
- Model column: name (serif) + ID (monospace)
- Description column (hidden on mobile)
- Context length in formatted units (K/M)
- Pricing: prompt/completion cost per token
- Provider tag in teal
- Responsive: hides description + pricing columns at `≤720px`

### Tab 2 — GitHub Repo Cards
- 2-column card grid with fade-in stagger animation (`0.03s` delay)
- Card: avatar + repo name (monospace), description (2-line clamp), meta row (language dot + stars + forks + update recency), topic tags
- Language color dots mapped for 18+ languages
- Star/fork counts formatted with k-suffix

### Tab 3 — AI News (unchanged from v1)
- Search input with italic placeholder
- Language toggle pills (All / EN / 中文) — segmented control
- Source filter pills with underline hover animation
- Source status line (OK/FAIL count)
- Article cards: headline (Playfair), meta (source + lang + date), description (2-line clamp)

### Animation
- Cards/repos: `fadeIn + translateY(8px)` over `0.35s`, staggered (`0.03s` delay per item)
- Source pills: underline expand on hover (`::after` pseudo-element)
- Status dot: gentle pulse (`2s` ease-in-out)
- Refresh button: spin animation on loading
- Table rows: hover background highlight

---

## Data Sections

| Tab | Data Source | API Field | Refresh |
|-----|-------------|-----------|---------|
| Model Rankings | OpenRouter API (`/api/v1/models`) | `.models` | 5-min cache |
| GitHub AI | GitHub Search API | `.github` | 5-min cache |
| AI News | 16 RSS feeds (parallel fetch) | `.articles` | 5-min cache |

---

## Voice & Tone

- Editorial, refined, warm
- Tech intelligence presented with magazine gravitas
- Chinese/English bilingual support with clear language labeling
- Error states shown gracefully but minimally (toast, source status)
- Model data presented as authoritative rankings (editorial tone)

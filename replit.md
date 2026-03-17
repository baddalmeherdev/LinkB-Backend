# ReelVault Workspace

## Overview

pnpm workspace monorepo using TypeScript. ReelVault is a mobile-first video downloader and sharing app.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Mobile**: Expo SDK 54, Expo Router (file-based routing)
- **Video engine**: yt-dlp (server-side)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── reelvault/          # Expo React Native mobile app
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## ReelVault App Features

### Core Features
- Paste/share any video URL (YouTube, Instagram, Facebook, TikTok, Twitter, Vimeo, etc.)
- Fetch video metadata (title, thumbnail, duration, uploader)
- Show available download qualities (Audio Only, 144p-1080p)
- One-click download for each quality
- Download history (localStorage/AsyncStorage)
- Built-in video preview (opens in browser)
- Share and copy link buttons

### Advanced Features
- AI Caption generator (demo/placeholder)
- Hashtag suggestions (demo/placeholder)
- Video trim (redirects to browser)
- Audio-only download option

### Premium / Monetization
- UPI payment: winuptournament@fam (₹99 lifetime)
- Premium unlocks: HD downloads, no ads, unlimited downloads
- Premium stored in AsyncStorage
- Ad banner for free users (placeholder for AdMob)

### Security
- URL validation (HTTP/HTTPS only)
- Rate limiting: 10 req/min per IP
- Server-side yt-dlp processing

## API Endpoints

- `POST /api/video/info` — Fetch video metadata (title, thumbnail, formats)
- `POST /api/video/download` — Get download URL for specific format

## Theme

- Dark theme: background `#0A0A0F`, accent `#3B82F6` (electric blue), gold `#F59E0B`
- Font: Inter (400, 500, 600, 700)

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes:
- `src/routes/health.ts` — GET /api/healthz
- `src/routes/video.ts` — POST /api/video/info, POST /api/video/download

### `artifacts/reelvault` (`@workspace/reelvault`)

Expo React Native app. Screens:
- `app/(tabs)/index.tsx` — Download screen (main)
- `app/(tabs)/history.tsx` — Download history
- `app/(tabs)/premium.tsx` — Premium/UPI payment screen

Context:
- `context/AppContext.tsx` — isPremium, history, addToHistory, clearHistory

Hooks:
- `hooks/useVideoApi.ts` — fetchVideoInfo, fetchDownloadLink

## Running

```bash
# Start API server
pnpm --filter @workspace/api-server run dev

# Start Expo app
pnpm --filter @workspace/reelvault run dev
```

## Codegen

```bash
pnpm --filter @workspace/api-spec run codegen
```

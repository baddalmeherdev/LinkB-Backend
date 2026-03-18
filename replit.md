# LinkDrop Workspace

## Overview

pnpm workspace monorepo using TypeScript. LinkDrop is a mobile-first universal video downloader and sharing app.

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
- **Video engine**: yt-dlp (system Nix package — `yt-dlp`)
- **Video processing**: ffmpeg (system Nix package)

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

## LinkDrop App Features

### Core Features
- Paste/share any video URL (YouTube, Instagram, Facebook, TikTok, Twitter, Vimeo, etc.)
- Fetch video metadata (title, thumbnail, duration, uploader)
- Show available download qualities (Audio Only, 144p-1080p)
- One-click download for each quality
- Download history (localStorage/AsyncStorage)
- Built-in video preview (opens in browser)
- Share and copy link buttons

### Advanced Features
- PWA Share Target — app appears in Android/iOS share menu; receives shared URL/text and auto-fetches
- Smart Share button — shows "Share File" (green) when a file is downloaded, shares actual file via Web Share API / expo-sharing
- Auto progress bar during download (real content-length tracking or smooth fake progress)
- AI Caption generator + Hashtag suggestions
- Video trim (redirects to browser)
- Audio-only download option
- Disclaimer: "Use for personal and permitted content only" shown in results and empty state

### Premium / Monetization
- UPI payment: winuptournament@fam (₹99 lifetime)
- Premium unlocks: HD (1080p+) downloads, no watermark, unlimited history
- Free users: up to 720p, downloads watermarked via ffmpeg
- UTR verification flow for manual payment confirmation
- Premium stored in AsyncStorage

### Download Optimization
- `--concurrent-fragments 4` and `--buffer-size 16K` on all yt-dlp calls
- Extended format fallback chain for better compatibility across platforms
- Server-side yt-dlp + ffmpeg with retry + user-agent rotation

### Security
- URL validation (HTTP/HTTPS only)
- Rate limiting: 30 req/min per IP
- Server-side yt-dlp processing
- Watermark added to free downloads

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
- `app/(tabs)/index.tsx` — Download screen (main), supports `autoUrl` param from browser tab
- `app/(tabs)/browser.tsx` — In-app browser (WebView native, iframe web) with "Download this video" button
- `app/(tabs)/history.tsx` — Download history with re-download support
- `app/(tabs)/premium.tsx` — Premium/UPI payment + Watch Ad placeholder

Context:
- `context/AppContext.tsx` — isPremium, history, addToHistory, clearHistory

Hooks:
- `hooks/useVideoApi.ts` — fetchPreview, fetchVideoInfo, getPlayUrl, getStreamUrl

Quality lock:
- Free: Audio Only, up to 720p (inclusive)
- Premium: 1080p, 1440p, 4K

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

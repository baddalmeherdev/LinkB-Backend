# LinkB Downloader Workspace

## Overview

pnpm workspace monorepo using TypeScript. LinkB Downloader is a mobile-first universal video downloader app. Supports YouTube, Instagram, TikTok, Facebook, Twitter, Vimeo, and 2000+ sites via yt-dlp.

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
│   └── reelvault/          # Expo React Native mobile app (branded as LinkB Downloader)
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

## App Identity

- **App Name**: LinkB Downloader
- **Short Name**: LinkB
- **Slug**: linkb-downloader
- **Scheme**: linkbdownloader
- **Logo**: `artifacts/reelvault/components/LinkBLogo.tsx` (SVG, blue gradient + download arrow)
- **Icon**: `artifacts/reelvault/assets/images/icon.png` (512×512 programmatically generated)

## Features

### Core Features
- Paste/share any video URL (YouTube, Instagram, Facebook, TikTok, Twitter, Vimeo, etc.)
- Fetch video metadata (title, thumbnail, duration, uploader)
- Show available download qualities (Audio Only, 144p–2160p)
- One-click download for each quality
- Download history (AsyncStorage)
- Built-in video preview/play
- Share and copy link buttons

### Navigation
- 3 tabs: Download, History, Premium (Browser tab removed)

### Advanced Features
- PWA Share Target — app appears in Android/iOS share menu
- Smart Share button — shares actual file when downloaded
- Auto progress bar during download
- AI Caption generator + Hashtag suggestions
- Audio-only download option

### Premium / Monetization
- UPI payment: `winuptournament@fam` (₹99 lifetime)
- Premium unlocks: HD (1080p, 1440p, 4K) downloads
- Free users: up to 720p (inclusive)
- UTR verification flow for manual payment confirmation
- Premium state stored in AsyncStorage under `@reelvault:premium`

### Download Optimization
- `--concurrent-fragments 4` and `--buffer-size 16K` on all yt-dlp calls
- Extended format fallback chain for YouTube
- Fragmented mp4 (fMP4) output via `ffmpeg:-movflags frag_keyframes+empty_moov+default_base_moof` — enables muxing video+audio to stdout without seekable output
- `--hls-prefer-native` and `--format-sort +proto:dash` to prefer DASH over HLS for YouTube (HLS+HLS merging to stdout fails)
- Server-side yt-dlp + ffmpeg with retry + user-agent rotation

### Security
- URL validation (HTTP/HTTPS only)
- Rate limiting: 30 req/min per IP
- Server-side yt-dlp processing
- HD quality gated server-side (403 if not premium)

## API Endpoints

- `POST /api/video/preview` — Quick metadata fetch (title, thumbnail, duration, uploader)
- `POST /api/video/info` — Full format listing with quality options
- `GET /api/video/play` — Stream pre-muxed video for in-app playback
- `GET /api/video/stream` — Download endpoint (free: ≤720p, premium: ≤4K)
- `GET /api/video/update` — Trigger yt-dlp self-update
- `GET /api/video/status` — Server health + yt-dlp version

## Error Codes

| Code | Meaning |
|------|---------|
| `INVALID_URL` | Not a valid HTTP/HTTPS URL |
| `UNSUPPORTED_URL` | Site not supported by yt-dlp |
| `PRIVATE_VIDEO` | Video is private or removed |
| `GEO_BLOCKED` | Geo-restricted content |
| `FORMAT_UNAVAILABLE` | Requested format not available |
| `PREMIUM_REQUIRED` | HD format requires premium |
| `SERVICE_UNAVAILABLE` | yt-dlp failed (auth required, etc.) |
| `RATE_LIMIT` | Too many requests (30/min) |

## Theme

- Dark theme: background `#0A0A0F`, accent `#3B82F6` (electric blue), gold `#F59E0B`
- Font: Inter (400, 500, 600, 700)

## Storage Keys (AsyncStorage)

- `@reelvault:premium` — premium status
- `@reelvault:history` — download history

## Running

```bash
# Start API server
pnpm --filter @workspace/api-server run dev

# Start Expo app
pnpm --filter @workspace/reelvault run dev
```

## Known Limitations

- Reddit: requires account cookies (SERVICE_UNAVAILABLE expected)
- Vimeo: OAuth token issues in server environments (platform limitation)
- Instagram/TikTok: auth-gated content requires cookies

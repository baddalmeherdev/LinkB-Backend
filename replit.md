# LinkB Downloader Workspace

## Overview

pnpm workspace monorepo using TypeScript. LinkB Downloader is a mobile-first universal video downloader app. Supports YouTube, Instagram, TikTok, Facebook, Twitter, Vimeo, and 2000+ sites via yt-dlp.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Mobile**: Expo SDK 54, Expo Router (file-based routing)
- **Video engine**: yt-dlp (system Nix package)
- **Video processing**: ffmpeg (system Nix package)
- **Ads**: Unity Ads (native rewarded + interstitial) + Start.io (banner via WebView)

## Structure

```text
artifacts/
├── api-server/         # Express API server (yt-dlp + ffmpeg backend)
└── reelvault/          # Expo React Native mobile app (branded as LinkB Downloader)
lib/
├── api-spec/           # OpenAPI spec + Orval codegen config
├── api-client-react/   # Generated React Query hooks
├── api-zod/            # Generated Zod schemas from OpenAPI
└── db/                 # Drizzle ORM schema + DB connection
```

## App Identity

- **App Name**: LinkB Downloader
- **Version**: 1.0.1
- **Package**: `com.badalmeher.linkbdownloader`
- **Scheme**: `linkbdownloader`
- **EAS Project ID**: `5c663dee-b927-4dd7-a0e1-69265cf9032a`
- **Logo**: `artifacts/reelvault/components/LinkBLogo.tsx`

## Features

### Core Features
- Paste/share any video URL (YouTube, Instagram, Facebook, TikTok, Twitter, Vimeo, etc.)
- Auto-detects URL from clipboard on paste
- Fetch video metadata (title, thumbnail, duration, uploader)
- Show available download qualities (Audio Only, 144p–2160p)
- One-click download for each quality
- Download history (AsyncStorage, max 100)
- Built-in in-app video player
- Share downloaded file (expo-sharing) or share link
- Auto Caption + Hashtag generator

### Navigation Tabs
- **Download** — Main download screen
- **History** — Download history with play/share/re-download
- **Trim** — Video trimmer (Premium or ad-unlocked)
- **Premium** — Upgrade screen (UPI ₹29/month)
- Browser tab: hidden (href: null)

### Android Share Intent
- App shows in Android share sheet for `text/plain` URLs
- Intent filter: `ACTION_SEND`, `mimeType: text/plain`, category: `DEFAULT`
- When user selects LinkB from share sheet, URL auto-loads and video info fetches

### Premium / Monetization
- UPI ID: `winuptournament@fam` — ₹29/month
- Premium unlocks: HD (1080p, 1440p, 4K) downloads + Trim + no watermark
- Free users: up to 720p, watermark, ads
- UTR verification flow for manual payment confirmation
- Premium stored in AsyncStorage: `@reelvault:premium_expiry`
- `unlockPremiumOnce()` — grants 24h premium (for ad-reward unlock)

### Ad System
- **Banner ads**: Start.io via WebView — pinned at bottom, ONLY for free users
- **Interstitial ads**: Unity Ads — shown every 3 downloads, ONLY for free users
- **Rewarded ads**: Unity Ads — free users watch to unlock HD quality
- **Trim unlock**: Free users watch rewarded ad → get 24h premium (`unlockPremiumOnce`) → access trim
- Game ID: `6069290`, Placements: `Rewarded_Android`, `Interstitial_Android`

### Download Optimization
- Free users: server-side `/stream` (yt-dlp + ffmpeg merge + watermark)
- Premium users: direct CDN URL (`/direct` endpoint) — fastest path
- Pre-resolves CDN URL in background after video info loads (premium only)
- `--concurrent-fragments 4`, `--buffer-size 16K` on all yt-dlp calls
- Fragmented mp4 (fMP4) output for streaming to stdout

## API Endpoints

- `POST /api/video/preview` — Quick metadata (title, thumbnail, duration)
- `POST /api/video/info` — Full format listing with quality options
- `GET /api/video/stream` — Download + watermark for free users
- `GET /api/video/direct` — Resolve CDN URL for premium users
- `GET /api/video/pipe` — Proxy CDN → client (web only)
- `GET /api/video/trim` — Server-side trim with ffmpeg
- `GET /api/health` — Health check

## Theme

- Dark: background `#0A0A0F`, accent `#3B82F6` (blue), gold `#F59E0B`
- Font: Inter (400, 500, 600, 700)

## Storage Keys (AsyncStorage)

- `@reelvault:premium_expiry` — premium expiry timestamp
- `@reelvault:history` — download history (array, max 100)

## Building APK

```bash
cd artifacts/reelvault
eas login           # login with Expo account
eas build --profile preview --platform android
# Download APK from EAS dashboard: https://expo.dev
```

EAS preview profile builds a direct APK (not AAB) for sideloading.

## Running Dev

```bash
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/reelvault run dev
```

## Bug Fixes Applied (latest)

1. **Interstitial ads for premium users** — Fixed. Ads now only show for free users.
2. **Trim screen: premium users forced to watch ad** — Fixed. Premium users access trim directly.
3. **Trim unlock flow broken** — Fixed. Watching ad in Download tab now calls `unlockPremiumOnce()` before navigating to trim, so user actually gets access.
4. **Trim locked screen missing ad option** — Fixed. Added "Watch Ad to Unlock for 24h" button on trim locked screen.
5. **Version mismatch** — Fixed. Premium screen now shows 1.0.1 matching app.json.

## Known Limitations

- Reddit: requires account cookies (SERVICE_UNAVAILABLE expected)
- Vimeo: OAuth token issues in server environments
- Instagram/TikTok: auth-gated content requires cookies
- iOS builds not configured (Android-only app)

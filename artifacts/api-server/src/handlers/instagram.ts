// Instagram Handler
// Instagram aggressively blocks automated requests. We use a combination of:
//   - A realistic mobile Chrome user-agent
//   - The internal Instagram App-ID header (required for API requests)
//   - Referer and Accept-Language headers to look like a real browser
//   - Force HTTP/1.1 to avoid HTTP/2 fingerprinting issues
//   - Embed-URL rewrite fallback so yt-dlp can still extract public reels

import type { PlatformHandler, HandlerConfig } from "./base.js";

const INSTAGRAM_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36 Instagram/312.0.0.28.109";

export class InstagramHandler implements PlatformHandler {
  readonly name = "Instagram";

  matches(url: string): boolean {
    return /instagram\.com/.test(url);
  }

  getConfig(): HandlerConfig {
    return {
      extraArgs: [
        "--user-agent", INSTAGRAM_UA,
        "--add-header", "Accept-Language:en-US,en;q=0.9",
        "--add-header", "Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "--add-header", "Referer:https://www.instagram.com/",
        "--add-header", "X-IG-App-ID:936619743392459",
        "--add-header", "X-Requested-With:XMLHttpRequest",
        "--add-header", "Sec-Fetch-Site:same-origin",
        "--add-header", "Sec-Fetch-Mode:cors",
        "--force-ipv4",
        "--extractor-retries", "3",
        "--sleep-interval", "1",
        "--max-sleep-interval", "3",
      ],
      preferredFormats: [
        "best[ext=mp4]/best",
        "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]",
        "best",
        "worst",
      ],
      urlTransform: (url: string) => {
        // Rewrite /p/ and /tv/ to /reel/ — yt-dlp handles reels better
        // Also strip query params that may confuse yt-dlp
        try {
          const u = new URL(url);
          u.search = "";
          u.hash = "";
          const path = u.pathname.replace(/\/(p|tv)\//, "/reel/");
          u.pathname = path;
          return u.toString();
        } catch {
          return url;
        }
      },
    };
  }
}

// Instagram Handler
// Instagram requires a browser-like user-agent.
// Reels, Stories, and posts are all supported via yt-dlp.

import type { PlatformHandler, HandlerConfig } from "./base.js";

export class InstagramHandler implements PlatformHandler {
  readonly name = "Instagram";

  matches(url: string): boolean {
    return /instagram\.com/.test(url);
  }

  getConfig(): HandlerConfig {
    return {
      extraArgs: [
        "--add-header", "Accept-Language:en-US,en;q=0.9",
        "--add-header", "Referer:https://www.instagram.com/",
      ],
      preferredFormats: [
        "best[ext=mp4]/best",
        "best",
        "worst",
      ],
    };
  }
}

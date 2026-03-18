// TikTok Handler
// TikTok serves watermarked downloads by default.
// We pass specific headers to request cleaner streams.

import type { PlatformHandler, HandlerConfig } from "./base.js";

export class TikTokHandler implements PlatformHandler {
  readonly name = "TikTok";

  matches(url: string): boolean {
    return /tiktok\.com|vm\.tiktok\.com/.test(url);
  }

  getConfig(): HandlerConfig {
    return {
      extraArgs: [
        "--extractor-args", "tiktok:webpage_download=1",
        "--add-header", "Referer:https://www.tiktok.com/",
      ],
      preferredFormats: [
        "download_addr-0/play_addr-0/best[ext=mp4]/best",
        "best[ext=mp4]/best",
        "best",
        "worst",
      ],
    };
  }
}

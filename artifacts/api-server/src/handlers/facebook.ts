// Facebook Handler
// Facebook video/Reel/Watch links are supported via yt-dlp.

import type { PlatformHandler, HandlerConfig } from "./base.js";

export class FacebookHandler implements PlatformHandler {
  readonly name = "Facebook";

  matches(url: string): boolean {
    return /facebook\.com|fb\.watch|fb\.com/.test(url);
  }

  getConfig(): HandlerConfig {
    return {
      extraArgs: [
        "--add-header", "Accept-Language:en-US,en;q=0.9",
      ],
      preferredFormats: [
        "hd/sd/best[ext=mp4]/best",
        "best[ext=mp4]/best",
        "best",
        "worst",
      ],
    };
  }
}

// X (Twitter) Handler
// Twitter/X video posts are supported via yt-dlp.
// We set a mobile user-agent which often returns better stream URLs.

import type { PlatformHandler, HandlerConfig } from "./base.js";

export class TwitterHandler implements PlatformHandler {
  readonly name = "X (Twitter)";

  matches(url: string): boolean {
    return /twitter\.com|x\.com/.test(url);
  }

  getConfig(): HandlerConfig {
    return {
      extraArgs: [],
      preferredFormats: [
        "best[ext=mp4]/best",
        "best",
        "worst",
      ],
    };
  }
}

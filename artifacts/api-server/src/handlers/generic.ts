// Generic Handler
// Fallback for any URL not matched by a specific platform handler.
// Relies entirely on yt-dlp's built-in extractor support (2000+ sites).

import type { PlatformHandler, HandlerConfig } from "./base.js";

export class GenericHandler implements PlatformHandler {
  readonly name = "Generic";

  matches(_url: string): boolean {
    // Always matches — this is the fallback
    return true;
  }

  getConfig(): HandlerConfig {
    return {
      extraArgs: [],
      preferredFormats: [
        "bv[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv+ba/b/best",
        "best[ext=mp4]/best",
        "best",
        "worst",
      ],
    };
  }
}

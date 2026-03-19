// Facebook Handler
// Facebook video/Reel/Watch links are supported via yt-dlp.
// Facebook normally exposes "hd" and "sd" named formats; we request
// multiple API versions and user-agent combos to surface every available
// resolution tier so the quality picker shows as many options as possible.

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
        "--add-header", "Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        // Request all available formats sorted by resolution (highest first)
        "--format-sort", "res:2160,fps,vcodec:h264,acodec:aac,size",
        // Try to get DASH/m3u8 adaptive streams which have more quality levels
        "--extractor-args", "facebook:api_version=v19.0",
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

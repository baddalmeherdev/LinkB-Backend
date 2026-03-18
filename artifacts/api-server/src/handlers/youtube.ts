// YouTube Handler
// YouTube returns separate video and audio streams for HD.
// android + web clients give proper mp4/m4a streams (including for Shorts).
// Temp-file download is used server-side so ffmpeg can seek freely.

import type { PlatformHandler, HandlerConfig } from "./base.js";

export class YouTubeHandler implements PlatformHandler {
  readonly name = "YouTube";

  matches(url: string): boolean {
    return /youtube\.com|youtu\.be/.test(url);
  }

  getConfig(): HandlerConfig {
    return {
      // android client gives real mp4 streams for regular videos and Shorts.
      // web gives https/DASH streams. ios is a last resort for HLS-only content.
      extraArgs: [
        "--extractor-args", "youtube:player_client=android,web,tv_embedded,ios",
        "--format-sort", "+proto:https:dash:m3u8",
      ],
      preferredFormats: [
        "bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4][height<=720]/best[height<=720]",
        "bestvideo[ext=mp4][height<=480]+bestaudio[ext=m4a]/best[ext=mp4][height<=480]/best[height<=480]",
        "best[ext=mp4]/best",
        "worst",
      ],
      downloadFormatOverride: (formatId: string, isAudio: boolean) => {
        if (isAudio) return `${formatId}/bestaudio[ext=m4a]/bestaudio`;
        // Complex selectors (contains "/" or "[") — pass through unchanged.
        if (formatId.includes("/") || formatId.includes("[")) return formatId;
        // Simple numeric/named format ID: build a robust fallback chain.
        return `${formatId}+bestaudio[ext=m4a]/${formatId}+bestaudio[ext=webm]/${formatId}+bestaudio/${formatId}/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best`;
      },
    };
  }
}

// YouTube Handler
// YouTube returns separate video and audio streams for HD.
// We prefer MP4 video + M4A audio, then fall back gracefully.

import type { PlatformHandler, HandlerConfig } from "./base.js";

export class YouTubeHandler implements PlatformHandler {
  readonly name = "YouTube";

  matches(url: string): boolean {
    return /youtube\.com|youtu\.be/.test(url);
  }

  getConfig(): HandlerConfig {
    return {
      extraArgs: [
        "--extractor-args", "youtube:player_client=web,mweb",
      ],
      preferredFormats: [
        "bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720][ext=mp4]/best[height<=720]/best[ext=mp4]/best",
        "best[ext=mp4][height<=480]/best[height<=480]",
        "best[ext=mp4]/best",
        "worst",
      ],
      downloadFormatOverride: (formatId: string, isAudio: boolean) => {
        if (isAudio) return `${formatId}/bestaudio[ext=m4a]/bestaudio`;
        return `${formatId}+bestaudio[ext=m4a]/${formatId}+bestaudio/${formatId}/bestvideo+bestaudio/best[ext=mp4]/best`;
      },
    };
  }
}

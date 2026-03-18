// YouTube Handler
// YouTube returns separate video and audio streams for HD.
// We prefer https-protocol (direct byte-range) streams over DASH and HLS
// because https streams are seekable and mux cleanly to stdout.

import type { PlatformHandler, HandlerConfig } from "./base.js";

export class YouTubeHandler implements PlatformHandler {
  readonly name = "YouTube";

  matches(url: string): boolean {
    return /youtube\.com|youtu\.be/.test(url);
  }

  getConfig(): HandlerConfig {
    return {
      // Use web client first — it returns https/DASH streams which ffmpeg
      // can mux to stdout reliably. ios client is used for Shorts fallback.
      extraArgs: [
        "--extractor-args", "youtube:player_client=web,tv_embedded,ios",
        // Prefer direct https streams > DASH > HLS to avoid ffmpeg stdout failures
        "--format-sort", "+proto:https:dash:m3u8",
      ],
      preferredFormats: [
        "best[ext=mp4][acodec!=none][vcodec!=none][height<=720]/bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]",
        "best[ext=mp4][height<=480]/best[height<=480]",
        "best[ext=mp4]/best",
        "worst",
      ],
      downloadFormatOverride: (formatId: string, isAudio: boolean) => {
        if (isAudio) return `${formatId}/bestaudio[ext=m4a]/bestaudio`;
        // Complex selectors (sentinel formats with / chains) are used as-is —
        // appending protocol filters to a multi-clause selector is invalid syntax.
        if (formatId.includes("/")) return formatId;
        // Simple numeric/named format ID: build a robust fallback chain.
        // Avoids HLS by not specifying protocol=m3u8; --format-sort already deprioritises it.
        return `${formatId}+bestaudio[ext=m4a]/${formatId}+bestaudio[ext=webm]/${formatId}+bestaudio/${formatId}/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best`;
      },
    };
  }
}

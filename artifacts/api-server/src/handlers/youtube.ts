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
      // ios is the most reliable client for Shorts + regular videos on servers.
      // tv_embedded also works for age-gated content. web/mweb are kept as
      // last-resort fallbacks — they often fail in server environments.
      // format-sort prefers DASH (dash) over HLS (m3u8) streams to avoid
      // ffmpeg HLS-to-mp4 muxing failures when piping to stdout.
      extraArgs: [
        "--extractor-args", "youtube:player_client=ios,tv_embedded,web",
        "--format-sort", "+proto:dash,https:http",
        "--hls-prefer-native",
      ],
      preferredFormats: [
        "bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720][ext=mp4]/best[height<=720]/best[ext=mp4]/best",
        "best[ext=mp4][height<=480]/best[height<=480]",
        "best[ext=mp4]/best",
        "worst",
      ],
      downloadFormatOverride: (formatId: string, isAudio: boolean) => {
        if (isAudio) return `${formatId}/bestaudio[ext=m4a]/bestaudio`;
        // Prefer DASH video+DASH audio combination; HLS streams fail with stdout muxing
        return `${formatId}[protocol=dash]+bestaudio[ext=m4a][protocol=dash]/${formatId}+bestaudio[ext=m4a]/${formatId}+bestaudio[ext=webm]/${formatId}+bestaudio/${formatId}/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best`;
      },
    };
  }
}

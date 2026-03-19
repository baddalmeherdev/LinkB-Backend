// Base handler interface
// Each platform handler implements this to provide platform-specific
// yt-dlp configuration. Generic fallback is used for all other sites.

export interface HandlerConfig {
  // Extra yt-dlp CLI arguments specific to this platform
  extraArgs: string[];

  // Preferred format strings for PLAYBACK (ordered, first that works wins)
  preferredFormats?: string[];

  // Override the download format string for this platform
  downloadFormatOverride?: (formatId: string, isAudio: boolean) => string;

  // Optional: transform the URL before passing it to yt-dlp
  // (e.g. Instagram: rewrite /p/ and /tv/ to /reel/ for better extraction)
  urlTransform?: (url: string) => string;
}

export interface PlatformHandler {
  // Returns true if this handler should handle the given URL
  matches(url: string): boolean;

  // Returns the config to use for extraction/download
  getConfig(): HandlerConfig;

  // Human-readable name of this handler (for logging)
  readonly name: string;
}

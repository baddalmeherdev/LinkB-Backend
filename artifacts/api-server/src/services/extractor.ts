// Universal Extraction Engine
// Uses yt-dlp as the primary engine with a multi-strategy fallback chain.
// Supports 2000+ websites — any site yt-dlp supports works automatically.

import { execFile, spawn } from "child_process";
import { promisify } from "util";
import type { HandlerConfig } from "../handlers/base.js";

const execFileAsync = promisify(execFile);
export const YTDLP = "yt-dlp";
export const FFMPEG = "ffmpeg";

// Base args applied to every yt-dlp invocation
const BASE_ARGS = [
  "--no-warnings",
  "--no-playlist",
  "--socket-timeout", "60",
  "--extractor-retries", "5",
  "--no-check-certificate",
  "--concurrent-fragments", "16",
  "--buffer-size", "1M",
  "--http-chunk-size", "10M",
  "--retries", "10",
  "--fragment-retries", "10",
];

// Rotate user agents on retry to avoid rate-limiting
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
];

// ---- Types ----------------------------------------------------------------

export interface RawFormat {
  format_id: string;
  ext: string;
  height: number | null;
  width: number | null;
  filesize: number | null;
  filesize_approx: number | null;
  vcodec: string | null;
  acodec: string | null;
  abr: number | null;
  vbr: number | null;
  tbr: number | null;
  format_note: string | null;
  url?: string | null;
  protocol?: string | null;
}

export interface ExtractedInfo {
  title: string;
  thumbnail: string | null;
  duration: number | null;
  uploader: string | null;
  formats: RawFormat[];
  originalUrl: string;
  directUrl?: string | null;    // For single-format sites (no formats array)
  directExt?: string | null;
}

export interface QualityOption {
  formatId: string;
  quality: string;
  label: string;
  resolution: string;
  ext: string;
  filesize: number | null;
  isAudioOnly: boolean;
  isHD: boolean;
}

// ---- Fatal error detection ------------------------------------------------

function isFatalError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("unsupported url") ||
    m.includes("no such extractor") ||
    m.includes("video is private") ||
    m.includes("this video is unavailable") ||
    m.includes("video unavailable") ||
    m.includes("this video has been removed") ||
    m.includes("account has been terminated") ||
    m.includes("enoent")
  );
}

// ---- Core Extraction ------------------------------------------------------

export async function extractInfo(url: string, handler?: HandlerConfig): Promise<ExtractedInfo> {
  const extraArgs = handler?.extraArgs ?? [];
  let lastError: Error = new Error("Extraction failed");

  for (let i = 0; i < USER_AGENTS.length; i++) {
    const ua = USER_AGENTS[i];
    try {
      const { stdout } = await execFileAsync(YTDLP, [
        ...BASE_ARGS,
        ...extraArgs,
        "--dump-json",
        "--user-agent", ua,
        url,
      ], { timeout: 60000, maxBuffer: 50 * 1024 * 1024 });

      const info = JSON.parse(stdout) as Record<string, unknown>;

      // Capture direct URL for single-format sites
      const directUrl = (info.url as string | null) ?? null;
      const directExt = (info.ext as string | null) ?? null;

      // Build synthetic format list from direct URL when formats array is missing
      let formats = ((info.formats as RawFormat[] | undefined) ?? []);

      // If no formats but yt-dlp gave a direct URL, build a synthetic single format
      if (formats.length === 0 && directUrl) {
        formats = [{
          format_id: "best",
          ext: directExt ?? "mp4",
          height: (info.height as number | null) ?? null,
          width: (info.width as number | null) ?? null,
          filesize: (info.filesize as number | null) ?? null,
          filesize_approx: (info.filesize_approx as number | null) ?? null,
          vcodec: (info.vcodec as string | null) ?? "h264",
          acodec: (info.acodec as string | null) ?? "mp4a",
          abr: null,
          vbr: null,
          tbr: (info.tbr as number | null) ?? null,
          format_note: "best",
          url: directUrl,
          protocol: (info.protocol as string | null) ?? null,
        }];
      }

      return {
        title: String(info.title ?? "Unknown Title"),
        thumbnail: (info.thumbnail as string | null) ?? null,
        duration: (info.duration as number | null) ?? null,
        uploader: (info.uploader as string | null) ?? null,
        formats,
        originalUrl: url,
        directUrl,
        directExt,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (isFatalError(lastError.message)) throw lastError;
      // Otherwise retry with next user agent
    }
  }

  throw lastError;
}

// ---- Robust Extraction Engine ---------------------------------------------
// Tries progressively more permissive strategies before giving up.
// Returns the info plus metadata about how many retries it took.

export interface RobustResult {
  info: ExtractedInfo;
  strategy: string;
  retries: number;
}

// Platform-specific fallback arg sets tried in order after the primary handler fails.
const PLATFORM_FALLBACKS: Record<string, Array<{ name: string; extraArgs: string[] }>> = {
  tiktok: [
    {
      name: "tiktok-mobile-ua",
      extraArgs: [
        "--extractor-args", "tiktok:webpage_download=1",
        "--add-header", "Referer:https://www.tiktok.com/",
        "--user-agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      ],
    },
    {
      name: "tiktok-embed",
      extraArgs: [
        "--extractor-args", "tiktok:webpage_download=1",
      ],
    },
    { name: "tiktok-bare", extraArgs: [] },
  ],
  instagram: [
    {
      name: "instagram-embed",
      extraArgs: [
        "--add-header", "Referer:https://www.instagram.com/",
        "--add-header", "X-IG-App-ID:936619743392459",
      ],
    },
    {
      name: "instagram-mobile",
      extraArgs: [
        "--user-agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "--add-header", "Referer:https://www.instagram.com/",
      ],
    },
    { name: "instagram-bare", extraArgs: [] },
  ],
  twitter: [
    {
      name: "twitter-api",
      extraArgs: [
        "--add-header", "Referer:https://twitter.com/",
      ],
    },
    { name: "twitter-bare", extraArgs: [] },
  ],
  facebook: [
    {
      name: "facebook-mobile",
      extraArgs: [
        "--user-agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "--add-header", "Referer:https://m.facebook.com/",
      ],
    },
    { name: "facebook-bare", extraArgs: [] },
  ],
  youtube: [
    {
      name: "youtube-android",
      extraArgs: [
        "--extractor-args", "youtube:player_client=android",
      ],
    },
    {
      name: "youtube-web",
      extraArgs: [
        "--extractor-args", "youtube:player_client=web",
      ],
    },
    {
      name: "youtube-ios",
      extraArgs: [
        "--extractor-args", "youtube:player_client=ios",
      ],
    },
  ],
  reddit: [
    {
      name: "reddit-mobile",
      extraArgs: [
        "--user-agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        "--add-header", "Referer:https://www.reddit.com/",
      ],
    },
    { name: "reddit-bare", extraArgs: [] },
  ],
  twitter_x: [
    {
      name: "x-api",
      extraArgs: [
        "--add-header", "Referer:https://x.com/",
      ],
    },
    { name: "x-bare", extraArgs: [] },
  ],
};

// Generic fallback strategies applied to all platforms when platform-specific fails
const GENERIC_FALLBACKS: Array<{ name: string; extraArgs: string[] }> = [
  // Try with generic extractor enabled
  { name: "generic-no-playlist", extraArgs: [] },
  // Try with format sort by size (gets smallest working format first)
  { name: "generic-size-sort", extraArgs: ["--format-sort", "+size"] },
  // Force generic extractor
  { name: "generic-extractor", extraArgs: ["--force-generic-extractor"] },
  // Try allowing all formats
  { name: "generic-all-formats", extraArgs: ["--format", "best"] },
  // Try with HLS preference
  { name: "generic-hls", extraArgs: ["--format", "best[protocol^=m3u8]/best"] },
  // Absolute last resort - no restrictions
  { name: "generic-worst", extraArgs: ["--format", "worst"] },
];

function getPlatformKey(url: string): string {
  if (/tiktok\.com|vm\.tiktok\.com/.test(url)) return "tiktok";
  if (/instagram\.com/.test(url)) return "instagram";
  if (/twitter\.com/.test(url)) return "twitter";
  if (/x\.com/.test(url)) return "twitter_x";
  if (/facebook\.com|fb\.watch|m\.facebook\.com/.test(url)) return "facebook";
  if (/youtube\.com|youtu\.be/.test(url)) return "youtube";
  if (/reddit\.com|v\.redd\.it/.test(url)) return "reddit";
  return "generic";
}

export async function extractInfoRobust(
  url: string,
  handler: HandlerConfig,
): Promise<RobustResult> {
  let retries = 0;
  let lastError: Error = new Error("Extraction failed");

  // Strategy 1: Primary handler (already retries across 3 user-agents)
  try {
    const info = await extractInfo(url, handler);
    return { info, strategy: "primary", retries };
  } catch (err) {
    lastError = err instanceof Error ? err : new Error(String(err));
    if (isFatalError(lastError.message)) throw lastError;
  }

  retries++;

  // Strategy 2: Platform-specific fallbacks
  const platformKey = getPlatformKey(url);
  const platformFallbacks = PLATFORM_FALLBACKS[platformKey] ?? [];

  for (const fallback of platformFallbacks) {
    try {
      const info = await extractInfo(url, { extraArgs: fallback.extraArgs });
      return { info, strategy: fallback.name, retries };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (isFatalError(lastError.message)) throw lastError;
      retries++;
    }
  }

  // Strategy 3: Generic fallbacks (bestvideo+bestaudio → best → worst format chains)
  for (const fallback of GENERIC_FALLBACKS) {
    try {
      const info = await extractInfo(url, { extraArgs: fallback.extraArgs });
      return { info, strategy: fallback.name, retries };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (isFatalError(lastError.message)) throw lastError;
      retries++;
    }
  }

  throw lastError;
}

// ---- Quality Processing ---------------------------------------------------

export function processQualities(info: ExtractedInfo): QualityOption[] {
  const { formats } = info;
  const qualities: QualityOption[] = [];
  const seenHeights = new Set<number>();

  // ── Audio-only formats ──────────────────────────────────────────────────
  const audioFormats = formats
    .filter((f) => (f.vcodec === "none" || f.vcodec === null) && f.acodec != null && f.acodec !== "none")
    .sort((a, b) => ((b.abr ?? b.tbr ?? 0) - (a.abr ?? a.tbr ?? 0)));

  if (audioFormats[0]) {
    const af = audioFormats[0];
    qualities.push({
      formatId: af.format_id,
      quality: "Audio Only",
      label: "Audio Only",
      resolution: "audio",
      ext: "mp3",
      filesize: af.filesize ?? af.filesize_approx ?? null,
      isAudioOnly: true,
      isHD: false,
    });
  }

  // ── Video formats with explicit heights ─────────────────────────────────
  // Include all formats that have a height — even if vcodec info is missing
  // (some sites expose combined streams with no separate vcodec field)
  const videoFormats = formats
    .filter((f) => f.height != null && f.height > 0 && f.vcodec !== "none")
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0));

  for (const target of [144, 240, 360, 480, 720, 1080, 1440, 2160]) {
    const closest = videoFormats.reduce<RawFormat | null>((best, f) => {
      if (!best) return f;
      return Math.abs((f.height ?? 0) - target) < Math.abs((best.height ?? 0) - target) ? f : best;
    }, null);

    if (closest?.height != null && !seenHeights.has(closest.height)) {
      const h = closest.height;
      seenHeights.add(h);
      qualities.push({
        formatId: closest.format_id,
        quality: `${h}p`,
        label: qualityLabel(h),
        resolution: `${closest.width ?? "?"}x${h}`,
        ext: closest.ext === "webm" ? "webm" : "mp4",
        filesize: closest.filesize ?? closest.filesize_approx ?? null,
        isAudioOnly: false,
        isHD: h > 720,
      });
    }
  }

  // ── If still no video qualities — try ANY format with height ────────────
  if (qualities.filter((q) => !q.isAudioOnly).length === 0) {
    const anyFormats = formats
      .filter((f) => f.height != null && f.height > 0)
      .sort((a, b) => (b.height ?? 0) - (a.height ?? 0));

    for (const f of anyFormats) {
      const h = f.height!;
      if (!seenHeights.has(h)) {
        seenHeights.add(h);
        qualities.push({
          formatId: f.format_id,
          quality: `${h}p`,
          label: qualityLabel(h),
          resolution: `${f.width ?? "?"}x${h}`,
          ext: "mp4",
          filesize: f.filesize ?? f.filesize_approx ?? null,
          isAudioOnly: false,
          isHD: h > 720,
        });
        if (qualities.filter((q) => !q.isAudioOnly).length >= 4) break;
      }
    }
  }

  // ── If still no video qualities — try any non-audio format ─────────────
  if (qualities.filter((q) => !q.isAudioOnly).length === 0) {
    const anyVideo = formats.filter((f) => f.acodec !== "none" || f.vcodec !== "none");
    if (anyVideo.length > 0) {
      const f = anyVideo[0];
      qualities.push({
        formatId: f.format_id,
        quality: "Best",
        label: "Best Available",
        resolution: "auto",
        ext: "mp4",
        filesize: f.filesize ?? f.filesize_approx ?? null,
        isAudioOnly: false,
        isHD: false,
      });
    }
  }

  // ── Ultimate fallback for sites with no structured formats ──────────────
  // Uses simple "best" selector that yt-dlp always resolves on any site
  if (qualities.filter((q) => !q.isAudioOnly).length === 0) {
    qualities.push({
      formatId: "best[ext=mp4]/best[ext=webm]/best",
      quality: "Best",
      label: "Best Available",
      resolution: "auto",
      ext: "mp4",
      filesize: null,
      isAudioOnly: false,
      isHD: false,
    });
  }

  // ── For sites that do have video qualities, ensure 720p free tier option ─
  const videoQualitiesOnly = qualities.filter((q) => !q.isAudioOnly);
  if (videoQualitiesOnly.length > 0 && videoQualitiesOnly[0].quality !== "Best") {
    const hasFree720 = qualities.some((q) => !q.isAudioOnly && !q.isHD && parseInt(q.quality) >= 720);
    const hasTrueHD = qualities.some((q) => !q.isAudioOnly && q.isHD);

    if (!hasFree720 || hasTrueHD) {
      const sentinel: QualityOption = {
        formatId: "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720][ext=mp4]/best[height<=720]/best",
        quality: "720p",
        label: "Best Free HD",
        resolution: "up to 720p",
        ext: "mp4",
        filesize: null,
        isAudioOnly: false,
        isHD: false,
      };
      if (!qualities.some((q) => q.quality === "720p")) {
        qualities.push(sentinel);
      }
    }
  }

  const videoQualities = qualities
    .filter((q) => !q.isAudioOnly)
    .sort((a, b) => {
      const aH = parseInt(a.quality) || 0;
      const bH = parseInt(b.quality) || 0;
      return aH - bH;
    });

  return [
    ...qualities.filter((q) => q.isAudioOnly),
    ...videoQualities,
  ];
}

function qualityLabel(height: number): string {
  if (height >= 2160) return "4K Ultra HD";
  if (height >= 1440) return "2K Quad HD";
  if (height >= 1080) return "Full HD";
  if (height >= 720) return "HD";
  if (height >= 480) return "Standard";
  if (height >= 360) return "Medium";
  return "Low";
}

// ---- Playback URL resolution ----------------------------------------------

const PLAY_FORMAT_CHAIN = [
  "bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[ext=mp4][height<=1080]/best[height<=1080]",
  "bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4][height<=720]/best[height<=720]",
  "best[ext=mp4][height<=480]/best[height<=480]",
  "best[ext=mp4]/best",
  "worst",
];

export async function resolvePlaybackUrl(url: string, handler?: HandlerConfig): Promise<string> {
  const extraArgs = handler?.extraArgs ?? [];
  const formatChain = handler?.preferredFormats ?? PLAY_FORMAT_CHAIN;

  for (const fmt of formatChain) {
    for (const ua of USER_AGENTS.slice(0, 2)) {
      try {
        const { stdout } = await execFileAsync(YTDLP, [
          ...BASE_ARGS,
          ...extraArgs,
          "-f", fmt,
          "--get-url",
          "--user-agent", ua,
          url,
        ], { timeout: 35000 });

        const lines = stdout.trim().split("\n").filter((l) => l.startsWith("http"));
        if (lines[0]) return lines[0];
      } catch {
        // try next
      }
    }
  }

  throw new Error("Could not resolve a playback URL after all fallbacks.");
}

// ---- Format selector with fallback chain ----------------------------------
// Returns an array of format selectors to try in order, from most specific to most permissive

export function buildFormatFallbackChain(formatId: string, isAudioOnly: boolean): string[] {
  if (isAudioOnly) {
    return [
      `${formatId}/bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio`,
      "bestaudio[ext=m4a]/bestaudio",
      "bestaudio",
      "worst",
    ];
  }

  const isFullSelector = formatId.includes("/") || formatId.includes("[") || formatId.includes("+");

  if (isFullSelector) {
    return [
      formatId,
      "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      "best[ext=mp4]/best",
      "best",
      "worst",
    ];
  }

  return [
    `${formatId}+bestaudio[ext=m4a]/${formatId}+bestaudio[ext=webm]/${formatId}+bestaudio/${formatId}`,
    "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
    "best[ext=mp4]/best[ext=webm]/best",
    "best",
    "worst",
  ];
}

// ---- Download / Stream ----------------------------------------------------

export function spawnDownload(opts: {
  url: string;
  formatId: string;
  ext: string;
  extraArgs?: string[];
}): ReturnType<typeof spawn> {
  const { url, formatId, ext, extraArgs = [] } = opts;
  const [primaryFormat] = buildFormatFallbackChain(formatId, false);

  return spawn(YTDLP, [
    ...BASE_ARGS,
    ...extraArgs,
    "-f", primaryFormat,
    "--merge-output-format", ext,
    "-o", "-",
    url,
  ], { stdio: ["ignore", "pipe", "pipe"] });
}

// ---- Self-update ----------------------------------------------------------

export async function selfUpdate(): Promise<string> {
  const { stdout, stderr } = await execFileAsync(YTDLP, ["-U"], { timeout: 120000 });
  return (stdout + stderr).trim();
}

export async function getCurrentVersion(): Promise<string> {
  const { stdout } = await execFileAsync(YTDLP, ["--version"], { timeout: 5000 });
  return stdout.trim();
}

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
  "--socket-timeout", "30",
  "--extractor-retries", "3",
  "--no-check-certificate",
  "--concurrent-fragments", "4",
  "--buffer-size", "16K",
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
}

export interface ExtractedInfo {
  title: string;
  thumbnail: string | null;
  duration: number | null;
  uploader: string | null;
  formats: RawFormat[];
  originalUrl: string;
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
      ], { timeout: 45000 });

      const info = JSON.parse(stdout) as Record<string, unknown>;
      return {
        title: String(info.title ?? "Unknown Title"),
        thumbnail: (info.thumbnail as string | null) ?? null,
        duration: (info.duration as number | null) ?? null,
        uploader: (info.uploader as string | null) ?? null,
        formats: ((info.formats as RawFormat[] | undefined) ?? []),
        originalUrl: url,
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
      ],
    },
    { name: "instagram-bare", extraArgs: [] },
  ],
};

// Generic fallback strategies applied to all platforms when platform-specific fails
const GENERIC_FALLBACKS: Array<{ name: string; extraArgs: string[] }> = [
  { name: "generic-best", extraArgs: [] },
  { name: "generic-worst", extraArgs: ["--format-sort", "+size"] },
];

function getPlatformKey(url: string): string {
  if (/tiktok\.com|vm\.tiktok\.com/.test(url)) return "tiktok";
  if (/instagram\.com/.test(url)) return "instagram";
  if (/twitter\.com|x\.com/.test(url)) return "twitter";
  if (/facebook\.com|fb\.watch/.test(url)) return "facebook";
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

  // Best audio track
  const audioFormats = formats
    .filter((f) => f.vcodec === "none" && f.acodec != null && f.acodec !== "none")
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

  // Video formats — pick the closest to each standard height
  const videoFormats = formats
    .filter((f) => f.vcodec !== "none" && f.vcodec != null && f.height != null && f.height > 0)
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
        ext: "mp4",
        filesize: closest.filesize ?? closest.filesize_approx ?? null,
        isAudioOnly: false,
        isHD: h > 720,
      });
    }
  }

  // Fallback when no formats are listed (direct-URL sites)
  if (qualities.filter((q) => !q.isAudioOnly).length === 0) {
    qualities.push({
      formatId: "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4][height<=720]/best[height<=720]",
      quality: "720p",
      label: "Best Available",
      resolution: "up to 720p",
      ext: "mp4",
      filesize: null,
      isAudioOnly: false,
      isHD: false,
    });
  }

  // Always add a "Best Free HD (720p)" sentinel so free users always have a
  // clear highest-quality option even if the source has no discrete 720p format.
  const hasTrueHD = qualities.some((q) => !q.isAudioOnly && q.isHD);
  const hasFree720 = qualities.some((q) => !q.isAudioOnly && !q.isHD && parseInt(q.quality) >= 720);
  if (!hasFree720 || hasTrueHD) {
    const sentinel: QualityOption = {
      // Download uses temp file, so ffmpeg can seek — any protocol is fine.
      formatId: "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720][ext=mp4]/best[height<=720]",
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

// ---- Download / Stream ----------------------------------------------------

const DOWNLOAD_FORMAT_CHAINS = [
  (fid: string) => `${fid}+bestaudio[ext=m4a]/${fid}+bestaudio/${fid}/best[ext=mp4]/best`,
  (_fid: string) => "best[ext=mp4]/best",
  (_fid: string) => "best",
];

export function spawnDownload(opts: {
  url: string;
  formatId: string;
  ext: string;
  extraArgs?: string[];
}): ReturnType<typeof spawn> {
  const { url, formatId, ext, extraArgs = [] } = opts;
  const format = DOWNLOAD_FORMAT_CHAINS[0](formatId);

  return spawn(YTDLP, [
    ...BASE_ARGS,
    ...extraArgs,
    "-f", format,
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

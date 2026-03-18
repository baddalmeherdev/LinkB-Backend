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
];

// Rotate user agents on retry to avoid rate-limiting
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
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
      const msg = lastError.message.toLowerCase();

      // Fatal errors — no point retrying
      if (
        msg.includes("unsupported url") ||
        msg.includes("private") ||
        msg.includes("unavailable") ||
        msg.includes("not available") ||
        msg.includes("enoent") ||
        msg.includes("not found")
      ) {
        throw lastError;
      }
      // Otherwise retry with next user agent
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
        isHD: h >= 720,
      });
    }
  }

  // Fallback when no formats are listed (direct-URL sites)
  if (qualities.filter((q) => !q.isAudioOnly).length === 0) {
    qualities.push({
      formatId: "best",
      quality: "Best",
      label: "Best Available",
      resolution: "auto",
      ext: "mp4",
      filesize: null,
      isAudioOnly: false,
      isHD: false,
    });
  }

  return [
    ...qualities.filter((q) => q.isAudioOnly),
    ...qualities.filter((q) => !q.isAudioOnly).sort((a, b) => parseInt(a.quality) - parseInt(b.quality)),
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
  "bv[ext=mp4][height<=720]+ba[ext=m4a]/b[ext=mp4][height<=720]/b[height<=720]/best[ext=mp4]/best",
  "best[height<=480]/best[ext=mp4]/best",
  "best",
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
  const { stdout, stderr } = await execFileAsync(YTDLP, ["--update"], { timeout: 60000 });
  return (stdout + stderr).trim();
}

export async function getCurrentVersion(): Promise<string> {
  const { stdout } = await execFileAsync(YTDLP, ["--version"], { timeout: 5000 });
  return stdout.trim();
}

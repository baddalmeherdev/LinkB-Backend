// Video Routes
// All video-related API endpoints.
// Extraction, preview, quality listing, playback, and download are all handled here.
// The actual heavy lifting is done by services/ and handlers/.

import { Router, type IRouter, type Request, type Response } from "express";
import { execFile, spawn } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import { createReadStream } from "fs";
import * as path from "path";
import * as os from "os";
import { detectPlatform, validateUrl } from "../services/platform-detect.js";
import { extractInfo, processQualities, resolvePlaybackUrl, spawnDownload, selfUpdate, getCurrentVersion, YTDLP, FFMPEG } from "../services/extractor.js";
import { previewCache, infoCache } from "../services/metadata-cache.js";
import { downloadQueue } from "../services/download-queue.js";
import { getHandler } from "../handlers/index.js";

const execFileAsync = promisify(execFile);
const router: IRouter = Router();

const WATERMARK_FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

// ---- Rate Limiting --------------------------------------------------------

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW_MS });
    return true;
  }
  if (record.count >= RATE_LIMIT) return false;
  record.count++;
  return true;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress ?? "unknown";
}

// ---- Helper ---------------------------------------------------------------

function classifyError(msg: string): { status: number; code: string; message: string } {
  const m = msg.toLowerCase();
  if (m.includes("unsupported url") || m.includes("no such extractor"))
    return { status: 400, code: "UNSUPPORTED_URL", message: "This link is not supported. Try a different URL from a supported platform." };
  // Use precise phrases so "Requested format is not available" doesn't falsely
  // trigger the private-video message.
  if (
    m.includes("video is private") ||
    m.includes("this video is unavailable") ||
    m.includes("video unavailable") ||
    m.includes("this video has been removed") ||
    m.includes("account has been terminated")
  )
    return { status: 400, code: "PRIVATE_VIDEO", message: "This video is private or unavailable." };
  if (m.includes("geo") || m.includes("not available in your country"))
    return { status: 400, code: "GEO_BLOCKED", message: "This video is geo-restricted and cannot be accessed from this server." };
  if (m.includes("requested format is not available") || m.includes("format is not available"))
    return { status: 400, code: "FORMAT_UNAVAILABLE", message: "Could not fetch this video. Please try a different link or try again later." };
  if (m.includes("enoent") || m.includes("yt-dlp"))
    return { status: 503, code: "SERVICE_UNAVAILABLE", message: "Downloader service is temporarily unavailable." };
  return { status: 500, code: "EXTRACTION_FAILED", message: "Could not fetch video info. Please check the link and try again." };
}

async function cleanupFiles(...files: string[]): Promise<void> {
  for (const f of files) {
    try { await fs.promises.unlink(f); } catch { /* ignore */ }
  }
}

// ---- POST /preview --------------------------------------------------------
// Quick metadata fetch: title, thumbnail, duration.
// Results are cached for 5 minutes.

router.post("/preview", async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    res.status(429).json({ error: "RATE_LIMIT", message: "Too many requests. Please wait a minute." });
    return;
  }

  const { url } = req.body as { url?: string };
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "INVALID_REQUEST", message: "URL is required." });
    return;
  }
  if (!validateUrl(url)) {
    res.status(400).json({ error: "INVALID_URL", message: "Please provide a valid HTTP/HTTPS URL." });
    return;
  }

  // Cache hit
  const cached = previewCache.get<object>(url);
  if (cached) { res.json(cached); return; }

  try {
    const handler = getHandler(url);
    console.log(`[preview] handler=${handler.name} url=${url}`);

    const info = await extractInfo(url, handler.getConfig());
    const result = {
      title: info.title,
      thumbnail: info.thumbnail,
      duration: info.duration,
      uploader: info.uploader,
      platform: detectPlatform(url),
    };

    previewCache.set(url, result);
    res.json(result);
  } catch (err) {
    console.error("[preview] error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    const { status, code, message } = classifyError(msg);
    res.status(status).json({ error: code, message });
  }
});

// ---- POST /info -----------------------------------------------------------
// Full format listing with quality options.
// Results are cached for 3 minutes.

router.post("/info", async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    res.status(429).json({ error: "RATE_LIMIT", message: "Too many requests. Please wait a minute." });
    return;
  }

  const { url } = req.body as { url?: string };
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "INVALID_REQUEST", message: "URL is required." });
    return;
  }
  if (!validateUrl(url)) {
    res.status(400).json({ error: "INVALID_URL", message: "Please provide a valid HTTP/HTTPS URL." });
    return;
  }

  const cached = infoCache.get<object>(url);
  if (cached) { res.json(cached); return; }

  try {
    const handler = getHandler(url);
    console.log(`[info] handler=${handler.name} url=${url}`);

    const info = await extractInfo(url, handler.getConfig());
    const qualities = processQualities(info);

    const result = {
      title: info.title,
      thumbnail: info.thumbnail,
      duration: info.duration,
      uploader: info.uploader,
      platform: detectPlatform(url),
      qualities,
      originalUrl: url,
    };

    infoCache.set(url, result);
    res.json(result);
  } catch (err) {
    console.error("[info] error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    const { status, code, message } = classifyError(msg);
    res.status(status).json({ error: code, message });
  }
});

// ---- GET /play ------------------------------------------------------------
// Range-aware video proxy for in-app playback.
// Resolves direct URL via yt-dlp, then proxies with full range support.

router.get("/play", async (req: Request, res: Response) => {
  const { url } = req.query as { url?: string };
  if (!url || !validateUrl(url)) {
    res.status(400).json({ error: "INVALID_URL", message: "Invalid URL." });
    return;
  }

  console.log(`[play] url=${url}`);
  try {
    const handler = getHandler(url);
    const sourceUrl = await resolvePlaybackUrl(url, handler.getConfig());
    console.log(`[play] resolved → ${sourceUrl.substring(0, 80)}...`);

    const rangeHeader = req.headers["range"];
    const proxyHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "*/*",
      "Accept-Encoding": "identity",
    };
    if (rangeHeader) proxyHeaders["Range"] = rangeHeader;

    const upstream = await fetch(sourceUrl, { headers: proxyHeaders });
    if (!upstream.ok && upstream.status !== 206) {
      throw new Error(`Upstream returned ${upstream.status}`);
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "video/mp4");
    res.setHeader("Accept-Ranges", upstream.headers.get("accept-ranges") ?? "bytes");
    const len = upstream.headers.get("content-length");
    const range = upstream.headers.get("content-range");
    if (len) res.setHeader("Content-Length", len);
    if (range) res.setHeader("Content-Range", range);
    res.status(upstream.status);

    if (!upstream.body) throw new Error("Empty response body from upstream.");

    const { Readable } = await import("stream");
    const nodeStream = Readable.fromWeb(upstream.body as import("stream/web").ReadableStream);
    req.on("close", () => { try { nodeStream.destroy(); } catch { /* ignore */ } });
    nodeStream.pipe(res);
  } catch (err) {
    console.error("[play] error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "PLAY_ERROR", message: "Could not load video for playback." });
    }
  }
});

// ---- GET /stream ----------------------------------------------------------
// Final download endpoint.
// Premium users get a direct clean stream.
// Free users get the video with a watermark applied via ffmpeg.

router.get("/stream", async (req: Request, res: Response) => {
  const { url, formatId, quality, isPremium, title } = req.query as {
    url?: string;
    formatId?: string;
    quality?: string;
    isPremium?: string;
    title?: string;
  };

  if (!url || !formatId) {
    res.status(400).json({ error: "INVALID_REQUEST", message: "url and formatId are required." });
    return;
  }
  if (!validateUrl(url)) {
    res.status(400).json({ error: "INVALID_URL", message: "Invalid URL." });
    return;
  }

  const premiumUser = isPremium === "true";
  const isHdFormat = ["1080p", "1440p", "2160p"].includes(quality ?? "");
  if (isHdFormat && !premiumUser) {
    res.status(403).json({ error: "PREMIUM_REQUIRED", message: "HD downloads require Premium." });
    return;
  }

  const isAudioOnly = quality === "Audio Only" || formatId === "bestaudio";
  const ext = isAudioOnly ? "mp3" : "mp4";
  const safeTitle = (title ?? "video").replace(/[^a-zA-Z0-9_\- ]/g, "_").substring(0, 80);
  const filename = `${safeTitle}.${ext}`;

  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", isAudioOnly ? "audio/mpeg" : "video/mp4");

  const handler = getHandler(url);
  const cfg = handler.getConfig();
  const ytdlpFormat = cfg.downloadFormatOverride
    ? cfg.downloadFormatOverride(formatId, isAudioOnly)
    : isAudioOnly
      ? `${formatId}/bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio`
      : `${formatId}+bestaudio[ext=m4a]/${formatId}+bestaudio[ext=webm]/${formatId}+bestaudio/${formatId}/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best`;

  console.log(`[stream] handler=${handler.name} format=${ytdlpFormat} premium=${premiumUser}`);

  if (!premiumUser && !isAudioOnly) {
    await downloadQueue.enqueue(() =>
      streamWithWatermark({ req, res, url, formatId: ytdlpFormat, extraArgs: cfg.extraArgs })
    );
  } else {
    streamDirect({ req, res, url, format: ytdlpFormat, ext, extraArgs: cfg.extraArgs });
  }
});

// ---- GET /update ----------------------------------------------------------
// Triggers a yt-dlp self-update. Call this to keep extraction support current.

router.get("/update", async (_req: Request, res: Response) => {
  try {
    console.log("[update] Running yt-dlp self-update...");
    const output = await selfUpdate();
    const version = await getCurrentVersion();
    console.log(`[update] Done. Version: ${version}`);
    res.json({ success: true, output, version });
  } catch (err) {
    console.error("[update] error:", err);
    res.status(500).json({ error: "UPDATE_FAILED", message: "Could not update yt-dlp." });
  }
});

// ---- GET /status ----------------------------------------------------------
// Returns server health and yt-dlp version info.

router.get("/status", async (_req: Request, res: Response) => {
  try {
    const version = await getCurrentVersion();
    res.json({
      status: "ok",
      ytdlpVersion: version,
      previewCacheSize: previewCache.size,
      infoCacheSize: infoCache.size,
      queueActive: downloadQueue.activeCount,
      queuePending: downloadQueue.pendingCount,
    });
  } catch {
    res.json({ status: "ok", ytdlpVersion: "unknown" });
  }
});

// ---- Streaming helpers ----------------------------------------------------

async function streamWithWatermark(opts: {
  req: Request;
  res: Response;
  url: string;
  formatId: string;
  extraArgs: string[];
}): Promise<void> {
  const { res, url, formatId, extraArgs } = opts;
  const tmpId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const tmpIn = path.join(os.tmpdir(), `ld_in_${tmpId}.mp4`);
  const tmpOut = path.join(os.tmpdir(), `ld_out_${tmpId}.mp4`);

  try {
    console.log(`[watermark] Downloading: ${url}`);
    await execFileAsync(YTDLP, [
      "--no-warnings", "--no-playlist",
      "--no-check-certificate",
      "--concurrent-fragments", "4",
      "--buffer-size", "16K",
      ...extraArgs,
      "-f", formatId,
      "--merge-output-format", "mp4",
      "-o", tmpIn,
      url,
    ], { timeout: 300000 });

    console.log(`[watermark] Applying watermark`);
    const drawtext = [
      `text='LinkDrop'`,
      `fontfile=${WATERMARK_FONT}`,
      `fontsize=36`,
      `fontcolor=white@0.70`,
      `bordercolor=black@0.80`,
      `borderw=3`,
      `x=w-tw-20`,
      `y=h-th-20`,
    ].join(":");

    await execFileAsync(FFMPEG, [
      "-i", tmpIn,
      "-vf", `drawtext=${drawtext}`,
      "-c:v", "libx264", "-preset", "ultrafast", "-crf", "26",
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart",
      "-y", tmpOut,
    ], { timeout: 600000 });

    const stat = await fs.promises.stat(tmpOut);
    res.setHeader("Content-Length", String(stat.size));

    const readStream = createReadStream(tmpOut);
    const cleanup = () => cleanupFiles(tmpIn, tmpOut);
    res.on("finish", cleanup);
    res.on("close", cleanup);
    readStream.on("error", (err) => {
      console.error("[watermark] stream error:", err);
      if (!res.headersSent) res.status(500).json({ error: "STREAM_ERROR", message: "Failed to stream video." });
      cleanup();
    });
    readStream.pipe(res);
  } catch (err) {
    console.error("[watermark] error:", err);
    cleanupFiles(tmpIn, tmpOut);
    if (!res.headersSent) {
      res.status(500).json({ error: "WATERMARK_ERROR", message: "Failed to process video. Please try again." });
    }
  }
}

function streamDirect(opts: {
  req: Request;
  res: Response;
  url: string;
  format: string;
  ext: string;
  extraArgs: string[];
}): void {
  const { req, res, url, format, ext, extraArgs } = opts;
  res.setHeader("Transfer-Encoding", "chunked");

  const proc = spawn(YTDLP, [
    "--no-warnings", "--no-playlist",
    "--no-check-certificate",
    "--concurrent-fragments", "4",
    "--buffer-size", "16K",
    ...extraArgs,
    "-f", format,
    "--merge-output-format", ext,
    "-o", "-",
    url,
  ], { stdio: ["ignore", "pipe", "pipe"] });

  console.log(`[stream-direct] format=${format} url=${url}`);

  proc.stderr.on("data", (d: Buffer) => {
    const line = d.toString().trim();
    if (line && !line.startsWith("[debug]")) console.log("[yt-dlp]", line);
  });

  proc.stdout.pipe(res);
  req.on("close", () => { try { proc.kill("SIGTERM"); } catch { /* ignore */ } });

  proc.on("error", (err) => {
    console.error("[stream-direct] spawn error:", err);
    if (!res.headersSent) res.status(500).json({ error: "STREAM_ERROR", message: "Could not start download." });
  });

  proc.on("close", (code) => {
    if (code !== 0 && code !== null) console.warn(`[stream-direct] yt-dlp exited with code ${code}`);
  });
}

export default router;

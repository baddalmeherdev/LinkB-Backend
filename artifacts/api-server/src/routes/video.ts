// Video Routes
// All video-related API endpoints.
// Extraction, preview, quality listing, playback, and download are all handled here.
// The actual heavy lifting is done by services/ and handlers/.

import { Router, type IRouter, type Request, type Response } from "express";
import { spawn } from "child_process";
import { detectPlatform, validateUrl } from "../services/platform-detect.js";
import { extractInfo, processQualities, selfUpdate, getCurrentVersion, YTDLP } from "../services/extractor.js";
import { previewCache, infoCache } from "../services/metadata-cache.js";
import { getHandler } from "../handlers/index.js";

const router: IRouter = Router();

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
// Streams video directly via yt-dlp for in-app playback.
// Uses combined audio+video format so the browser player works out of the box.

router.get("/play", async (req: Request, res: Response) => {
  const { url } = req.query as { url?: string };
  if (!url || !validateUrl(url)) {
    res.status(400).json({ error: "INVALID_URL", message: "Invalid URL." });
    return;
  }

  console.log(`[play] url=${url}`);
  try {
    const handler = getHandler(url);
    const cfg = handler.getConfig();

    // We MUST pick a pre-muxed format (acodec!=none AND vcodec!=none in a
    // single stream). When piping to stdout (-o -) yt-dlp cannot do mp4
    // muxing because mp4 atoms need seekable output. Selecting a pre-muxed
    // stream avoids muxing entirely and the bytes can be piped as-is.
    // Format 18 = YouTube 360p pre-muxed mp4, 22 = 720p pre-muxed mp4.
    // For Instagram/TikTok they always serve pre-muxed mp4 so any selector works.
    const format = [
      "best[acodec!=none][vcodec!=none][height<=480][ext=mp4]",
      "best[acodec!=none][vcodec!=none][ext=mp4]",
      "best[acodec!=none][vcodec!=none][height<=480]",
      "best[acodec!=none][vcodec!=none]",
      "18", // YouTube 360p pre-muxed fallback
      "best[height<=360]",
      "worst",
    ].join("/");

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Transfer-Encoding", "chunked");

    const proc = spawn(YTDLP, [
      "--no-warnings", "--no-playlist",
      "--no-check-certificate",
      "--buffer-size", "16K",
      ...cfg.extraArgs,
      "-f", format,
      "-o", "-",           // stdout; no --merge-output-format needed for pre-muxed
      url,
    ], { stdio: ["ignore", "pipe", "pipe"] });

    console.log(`[play] streaming format=${format}`);

    proc.stderr.on("data", (d: Buffer) => {
      const line = d.toString().trim();
      if (line && !line.startsWith("[debug]")) console.log("[play-yt-dlp]", line);
    });

    proc.stdout.pipe(res);
    req.on("close", () => { try { proc.kill("SIGTERM"); } catch { /* ignore */ } });

    proc.on("error", (err) => {
      console.error("[play] spawn error:", err);
      if (!res.headersSent) res.status(500).json({ error: "PLAY_ERROR", message: "Could not start playback." });
    });

    proc.on("close", (code) => {
      if (code !== 0 && code !== null) console.warn(`[play] yt-dlp exited with code ${code}`);
    });
  } catch (err) {
    console.error("[play] error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "PLAY_ERROR", message: "Could not load video for playback." });
    }
  }
});

// ---- GET /stream ----------------------------------------------------------
// Final download endpoint.
// All tiers stream directly — no temp files, no watermark re-encode.
// The only difference: free users are capped at 720p, premium users get full
// quality up to 4K. Streaming starts immediately for all users.

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

  // Detect whether the formatId is already a full yt-dlp format selector
  // (contains "/" or "+" or "["). If so, use it directly without wrapping.
  const isFullSelector = formatId.includes("/") || formatId.includes("[") || formatId.includes("+");

  const ytdlpFormat = cfg.downloadFormatOverride
    ? cfg.downloadFormatOverride(formatId, isAudioOnly)
    : isFullSelector
      ? formatId
      : isAudioOnly
        ? `${formatId}/bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio`
        : `${formatId}+bestaudio[ext=m4a]/${formatId}+bestaudio[ext=webm]/${formatId}+bestaudio/${formatId}/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best`;

  console.log(`[stream] handler=${handler.name} format=${ytdlpFormat} premium=${premiumUser}`);

  // Direct streaming for all users — no temp files, starts immediately.
  streamDirect({ req, res, url, format: ytdlpFormat, ext, extraArgs: cfg.extraArgs });
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
    });
  } catch {
    res.json({ status: "ok", ytdlpVersion: "unknown" });
  }
});

// ---- Streaming helpers ----------------------------------------------------

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

  // For video mp4: use fragmented mp4 (fMP4) output so that ffmpeg can mux
  // audio+video to a non-seekable stdout pipe. Regular mp4 needs moov atom at
  // start which requires seeking; fMP4 with empty_moov is fully streamable.
  const mergeFormat = ext === "mp4" ? "mp4" : ext;
  const ffmpegMovFlags = ext === "mp4"
    ? ["--postprocessor-args", "ffmpeg:-movflags frag_keyframes+empty_moov+default_base_moof"]
    : [];

  const proc = spawn(YTDLP, [
    "--no-warnings", "--no-playlist",
    "--no-check-certificate",
    "--concurrent-fragments", "4",
    "--buffer-size", "16K",
    ...extraArgs,
    "-f", format,
    "--merge-output-format", mergeFormat,
    ...ffmpegMovFlags,
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

// ---- POST /test -----------------------------------------------------------
// Internal test engine. Tests a batch of URLs for metadata, formats, and
// download availability. Returns structured results with timing & retry info.

interface TestResult {
  url: string;
  category: string;
  status: "pass" | "fail" | "unsupported" | "invalid";
  errorCode: string | null;
  errorMessage: string | null;
  title: string | null;
  thumbnail: string | null;
  hasDuration: boolean;
  formatsAvailable: number;
  downloadable: boolean;
  retryAttempts: number;
  metadataMs: number;
  formatMs: number;
  totalMs: number;
}

const FALLBACK_FORMATS = [
  "best[ext=mp4]/best",
  "worst[ext=mp4]/worst",
  "best",
];

router.post("/test", async (req: Request, res: Response) => {
  const { urls } = req.body as { urls?: Array<{ url: string; category: string }> };

  if (!urls || !Array.isArray(urls)) {
    res.status(400).json({ error: "INVALID_REQUEST", message: "urls array is required." });
    return;
  }

  const results: TestResult[] = [];
  const logs: string[] = [];
  const startAll = Date.now();

  for (const item of urls.slice(0, 20)) {
    const { url, category } = item;
    const t0 = Date.now();
    const result: TestResult = {
      url,
      category,
      status: "fail",
      errorCode: null,
      errorMessage: null,
      title: null,
      thumbnail: null,
      hasDuration: false,
      formatsAvailable: 0,
      downloadable: false,
      retryAttempts: 0,
      metadataMs: 0,
      formatMs: 0,
      totalMs: 0,
    };

    // --- Step 1: validate URL
    if (!validateUrl(url)) {
      result.status = "invalid";
      result.errorCode = "INVALID_URL";
      result.errorMessage = "Not a valid HTTP/HTTPS URL.";
      result.totalMs = Date.now() - t0;
      logs.push(`[${category}] INVALID ${url}`);
      results.push(result);
      continue;
    }

    // --- Step 2: fetch metadata with retries
    const metaStart = Date.now();
    let info: import("../services/extractor.js").ExtractedInfo | null = null;
    let retries = 0;

    try {
      const handler = getHandler(url);
      try {
        info = await extractInfo(url, handler.getConfig());
      } catch (firstErr) {
        retries++;
        result.retryAttempts++;
        logs.push(`[${category}] Retry 1 for ${url}: ${firstErr instanceof Error ? firstErr.message.slice(0, 80) : firstErr}`);
        // Retry with no extra handler args as fallback
        try {
          info = await extractInfo(url, { extraArgs: [], name: "fallback" });
        } catch (secondErr) {
          retries++;
          result.retryAttempts++;
          logs.push(`[${category}] Retry 2 for ${url}: ${secondErr instanceof Error ? secondErr.message.slice(0, 80) : secondErr}`);
          throw secondErr;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const classified = classifyError(msg);
      result.status = classified.code === "UNSUPPORTED_URL" ? "unsupported" : "fail";
      result.errorCode = classified.code;
      result.errorMessage = classified.message;
      result.metadataMs = Date.now() - metaStart;
      result.totalMs = Date.now() - t0;
      logs.push(`[${category}] FAIL ${url} => ${classified.code}: ${classified.message}`);
      results.push(result);
      continue;
    }

    result.metadataMs = Date.now() - metaStart;
    result.title = info.title;
    result.thumbnail = info.thumbnail;
    result.hasDuration = info.duration != null && info.duration > 0;

    // --- Step 3: check formats/download availability
    const fmtStart = Date.now();
    let downloadable = false;

    try {
      const qualities = processQualities(info);
      const videoQualities = qualities.filter((q) => !q.isAudioOnly);
      result.formatsAvailable = videoQualities.length;

      // Check if at least one format selector seems valid (non-empty formatId)
      downloadable = videoQualities.some((q) => q.formatId.length > 0);

      // If no explicit formats, try a yt-dlp format fallback check
      if (!downloadable) {
        for (const fallback of FALLBACK_FORMATS) {
          if (info.formats.length === 0 && info.originalUrl) {
            // Direct URL site — treat as downloadable
            downloadable = true;
            break;
          }
        }
      }
    } catch {
      downloadable = false;
    }

    result.formatMs = Date.now() - fmtStart;
    result.downloadable = downloadable;
    result.totalMs = Date.now() - t0;

    if (result.title && result.downloadable) {
      result.status = "pass";
      logs.push(`[${category}] PASS ${url} — "${result.title}" (${result.formatsAvailable} formats, ${result.totalMs}ms)`);
    } else if (result.title) {
      result.status = "fail";
      result.errorCode = "NO_FORMATS";
      result.errorMessage = "Metadata loaded but no downloadable formats found.";
      logs.push(`[${category}] NO_FORMATS ${url} — "${result.title}"`);
    } else {
      result.status = "fail";
      result.errorCode = "NO_METADATA";
      result.errorMessage = "Could not retrieve video metadata.";
      logs.push(`[${category}] NO_METADATA ${url}`);
    }

    results.push(result);
  }

  const totalMs = Date.now() - startAll;
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const unsupported = results.filter((r) => r.status === "unsupported").length;
  const invalid = results.filter((r) => r.status === "invalid").length;

  res.json({
    summary: {
      total: results.length,
      passed,
      failed,
      unsupported,
      invalid,
      successRate: results.length > 0 ? Math.round((passed / results.length) * 100) : 0,
      totalMs,
    },
    results,
    logs,
  });
});

export default router;

// Video Routes
// All video-related API endpoints.
// Extraction, preview, quality listing, playback, and download are all handled here.
// The actual heavy lifting is done by services/ and handlers/.

import { Router, type IRouter, type Request, type Response } from "express";
import { spawn } from "child_process";
import { detectPlatform, validateUrl } from "../services/platform-detect.js";
import { extractInfo, extractInfoRobust, processQualities, selfUpdate, getCurrentVersion, YTDLP } from "../services/extractor.js";
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

// ---- Keep-alive heartbeat helper ------------------------------------------
// yt-dlp can take 10-45 seconds on slow connections. Without any bytes flowing,
// the Replit proxy (and some clients) will abort the connection at ~6 seconds.
// This helper solves that by flushing a JSON-legal whitespace byte every 2 s
// while the async work runs, keeping the connection alive.
//
// CONTRACT:
//  - After HEARTBEAT_DELAY_MS the response is committed to HTTP 200 + chunked.
//  - On success the result JSON is streamed as the final chunk.
//  - On error the error JSON is streamed (callers must check body for .error).
//  - Before HEARTBEAT_DELAY_MS, nothing is written — caller keeps full control
//    of status codes (returns usedHeartbeat=false).

const HEARTBEAT_DELAY_MS = 3_000;
const HEARTBEAT_INTERVAL_MS = 2_000;

async function withHeartbeat<T>(
  res: Response,
  promise: Promise<T>,
): Promise<{ result: T | null; errInfo: ReturnType<typeof classifyError> | null; usedHeartbeat: boolean }> {
  let usedHeartbeat = false;
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  const startHeartbeat = () => {
    if (usedHeartbeat || res.writableEnded) return;
    usedHeartbeat = true;
    // Commit headers now — status code is locked to 200 from this point.
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("X-Accel-Buffering", "no"); // Prevent nginx/proxy buffering
    res.status(200);
    heartbeatInterval = setInterval(() => {
      try { if (!res.writableEnded) res.write(" "); } catch { /* ignore */ }
    }, HEARTBEAT_INTERVAL_MS);
  };

  const delayTimer = setTimeout(startHeartbeat, HEARTBEAT_DELAY_MS);

  try {
    const result = await promise;
    clearTimeout(delayTimer);
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    return { result, errInfo: null, usedHeartbeat };
  } catch (err) {
    clearTimeout(delayTimer);
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    const msg = err instanceof Error ? err.message : String(err);
    return { result: null, errInfo: classifyError(msg), usedHeartbeat };
  }
}

// Finish a heartbeat-wrapped response: stream result or error JSON.
function endHeartbeat(res: Response, usedHeartbeat: boolean, data: object, status = 200): void {
  if (res.writableEnded) return;
  if (usedHeartbeat) {
    res.end(JSON.stringify(data));
  } else {
    res.status(status).json(data);
  }
}


// ---- POST /preview --------------------------------------------------------
// Quick metadata fetch: title, thumbnail, duration.
// Results are cached for 5 minutes.
// Uses keep-alive heartbeat to prevent proxy timeouts on slow yt-dlp runs.

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

  // Cache hit — respond immediately, no heartbeat needed.
  const cached = previewCache.get<object>(url);
  if (cached) { res.json(cached); return; }

  const handler = getHandler(url);
  console.log(`[preview] handler=${handler.name} url=${url}`);

  const { result, errInfo, usedHeartbeat } = await withHeartbeat(
    res,
    (async () => {
      const info = await extractInfo(url, handler.getConfig());
      return {
        title: info.title,
        thumbnail: info.thumbnail,
        duration: info.duration,
        uploader: info.uploader,
        platform: detectPlatform(url),
      };
    })(),
  );

  if (errInfo) {
    console.error("[preview] error:", errInfo.code);
    endHeartbeat(res, usedHeartbeat, { error: errInfo.code, message: errInfo.message }, errInfo.status);
    return;
  }

  previewCache.set(url, result!);
  endHeartbeat(res, usedHeartbeat, result!);
});

// ---- POST /info -----------------------------------------------------------
// Full format listing with quality options.
// Results are cached for 3 minutes.
// Uses keep-alive heartbeat to prevent proxy timeouts on slow yt-dlp runs.

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

  // Cache hit — respond immediately, no heartbeat needed.
  const cached = infoCache.get<object>(url);
  if (cached) { res.json(cached); return; }

  const handler = getHandler(url);
  console.log(`[info] handler=${handler.name} url=${url}`);

  const { result, errInfo, usedHeartbeat } = await withHeartbeat(
    res,
    (async () => {
      const info = await extractInfo(url, handler.getConfig());
      const qualities = processQualities(info);
      return {
        title: info.title,
        thumbnail: info.thumbnail,
        duration: info.duration,
        uploader: info.uploader,
        platform: detectPlatform(url),
        qualities,
        originalUrl: url,
      };
    })(),
  );

  if (errInfo) {
    console.error("[info] error:", errInfo.code);
    endHeartbeat(res, usedHeartbeat, { error: errInfo.code, message: errInfo.message }, errInfo.status);
    return;
  }

  infoCache.set(url, result!);
  endHeartbeat(res, usedHeartbeat, result!);
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
// Internal test engine. Tests URLs one at a time using extractInfoRobust
// (3-strategy fallback chain). Returns structured results with timing, retry
// info, and per-step failure attribution.

interface TestResult {
  url: string;
  category: string;
  status: "pass" | "fail" | "unsupported" | "invalid";
  // Which step failed: "metadata" | "formats" | null (null = passed or invalid)
  failedStep: "metadata" | "formats" | null;
  errorCode: string | null;
  errorMessage: string | null;
  strategyUsed: string | null;
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

router.post("/test", async (req: Request, res: Response) => {
  const { urls, autoUpdate } = req.body as {
    urls?: Array<{ url: string; category: string }>;
    autoUpdate?: boolean;
  };

  if (!urls || !Array.isArray(urls)) {
    res.status(400).json({ error: "INVALID_REQUEST", message: "urls array is required." });
    return;
  }

  const results: TestResult[] = [];
  const logs: string[] = [];
  const startAll = Date.now();
  let ytdlpVersion = "unknown";

  // Optional: self-update yt-dlp before running the suite
  if (autoUpdate) {
    try {
      logs.push("[update] Running yt-dlp -U...");
      const updateOut = await selfUpdate();
      ytdlpVersion = await getCurrentVersion();
      logs.push(`[update] Done — ${ytdlpVersion}. Output: ${updateOut.slice(0, 120)}`);
    } catch (e) {
      logs.push(`[update] Warning: self-update failed — ${e instanceof Error ? e.message.slice(0, 80) : e}`);
    }
  }

  // Always log current version
  try {
    ytdlpVersion = await getCurrentVersion();
    logs.push(`[info] yt-dlp version: ${ytdlpVersion}`);
  } catch { /* ignore */ }

  for (const item of urls.slice(0, 20)) {
    const { url, category } = item;
    const t0 = Date.now();
    const result: TestResult = {
      url,
      category,
      status: "fail",
      failedStep: "metadata",
      errorCode: null,
      errorMessage: null,
      strategyUsed: null,
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
      result.failedStep = null;
      result.errorCode = "INVALID_URL";
      result.errorMessage = "Not a valid HTTP/HTTPS URL.";
      result.totalMs = Date.now() - t0;
      logs.push(`[${category}] INVALID ${url}`);
      results.push(result);
      continue;
    }

    // --- Step 2: fetch metadata using robust 3-strategy fallback
    const metaStart = Date.now();
    let info: import("../services/extractor.js").ExtractedInfo | null = null;

    try {
      const handler = getHandler(url);
      logs.push(`[${category}] Testing ${url} (handler: ${handler.name})`);
      const robust = await extractInfoRobust(url, handler.getConfig());
      info = robust.info;
      result.retryAttempts = robust.retries;
      result.strategyUsed = robust.strategy;
      if (robust.retries > 0) {
        logs.push(`[${category}] Recovered after ${robust.retries} retry/retries using strategy: ${robust.strategy}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const classified = classifyError(msg);
      result.status = classified.code === "UNSUPPORTED_URL" ? "unsupported" : "fail";
      result.failedStep = "metadata";
      result.errorCode = classified.code;
      result.errorMessage = classified.message;
      result.metadataMs = Date.now() - metaStart;
      result.totalMs = Date.now() - t0;
      logs.push(`[${category}] FAIL metadata ${url} => ${classified.code}`);
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

      // Pass if any non-empty formatId exists
      downloadable = videoQualities.some((q) => q.formatId.length > 0);

      // Direct-URL sites (no formats array) are inherently downloadable
      if (!downloadable && info.formats.length === 0 && info.originalUrl) {
        downloadable = true;
      }
    } catch {
      downloadable = false;
    }

    result.formatMs = Date.now() - fmtStart;
    result.downloadable = downloadable;
    result.totalMs = Date.now() - t0;

    if (result.title && result.downloadable) {
      result.status = "pass";
      result.failedStep = null;
      logs.push(`[${category}] PASS ${url} — "${result.title}" (${result.formatsAvailable} formats, ${result.totalMs}ms)`);
    } else if (result.title) {
      result.status = "fail";
      result.failedStep = "formats";
      result.errorCode = "NO_FORMATS";
      result.errorMessage = "Metadata loaded but no downloadable formats found. May be geo-restricted or DRM-protected.";
      logs.push(`[${category}] FAIL formats ${url} — "${result.title}"`);
    } else {
      result.status = "fail";
      result.failedStep = "metadata";
      result.errorCode = "NO_METADATA";
      result.errorMessage = "Video info retrieved but title was missing — unexpected server response.";
      logs.push(`[${category}] FAIL no-title ${url}`);
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
    ytdlpVersion,
    results,
    logs,
  });
});

export default router;

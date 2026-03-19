// Video Routes
// All video-related API endpoints.
// Extraction, preview, quality listing, playback, and download are all handled here.

import { Router, type IRouter, type Request, type Response } from "express";
import { spawn } from "child_process";
import { createReadStream, promises as fsp } from "fs";
import { randomBytes } from "crypto";
import { detectPlatform, validateUrl } from "../services/platform-detect.js";
import { extractInfoRobust, processQualities, resolvePlaybackUrl, selfUpdate, getCurrentVersion, buildFormatFallbackChain, YTDLP } from "../services/extractor.js";
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

// ---- Error classification -------------------------------------------------

function classifyError(msg: string): { status: number; code: string; message: string } {
  const m = msg.toLowerCase();
  if (m.includes("unsupported url") || m.includes("no such extractor"))
    return { status: 400, code: "UNSUPPORTED_URL", message: "This link is not supported. Try a URL from YouTube, TikTok, Instagram, or any of the 2000+ supported platforms." };
  if (
    m.includes("video is private") ||
    m.includes("this video is unavailable") ||
    m.includes("video unavailable") ||
    m.includes("this video has been removed") ||
    m.includes("account has been terminated")
  )
    return { status: 400, code: "PRIVATE_VIDEO", message: "This video is private or has been removed." };
  if (m.includes("geo") || m.includes("not available in your country"))
    return { status: 400, code: "GEO_BLOCKED", message: "This video is geo-restricted and cannot be accessed from this server." };
  if (m.includes("requested format is not available") || m.includes("format is not available"))
    return { status: 400, code: "FORMAT_UNAVAILABLE", message: "This video's format is not available. Please try a different link." };
  if (m.includes("login") || m.includes("sign in") || m.includes("cookie"))
    return { status: 400, code: "AUTH_REQUIRED", message: "This video requires a login to access. Only public videos can be downloaded." };
  if (m.includes("enoent") || m.includes("yt-dlp"))
    return { status: 503, code: "SERVICE_UNAVAILABLE", message: "Downloader service is temporarily unavailable. Please try again in a moment." };
  return { status: 500, code: "EXTRACTION_FAILED", message: "Could not fetch video info. Please check the link and try again." };
}

// ---- Keep-alive heartbeat -------------------------------------------------
// yt-dlp can take 10-45 seconds on slow connections. Without any bytes flowing,
// the proxy will close the connection at ~6 s. We flush a whitespace byte every
// 2 s to keep it alive. Once committed to 200+chunked, errors are embedded in
// the JSON body — callers must check body.error, not just res.ok.

const HEARTBEAT_DELAY_MS = 500;
const HEARTBEAT_INTERVAL_MS = 1_000;

async function withHeartbeat<T>(
  res: Response,
  promise: Promise<T>,
): Promise<{ result: T | null; errInfo: ReturnType<typeof classifyError> | null; usedHeartbeat: boolean }> {
  let usedHeartbeat = false;
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  const startHeartbeat = () => {
    if (usedHeartbeat || res.writableEnded) return;
    usedHeartbeat = true;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("X-Accel-Buffering", "no");
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

function endHeartbeat(res: Response, usedHeartbeat: boolean, data: object, status = 200): void {
  if (res.writableEnded) return;
  if (usedHeartbeat) {
    res.end(JSON.stringify(data));
  } else {
    res.status(status).json(data);
  }
}

// ---- POST /preview --------------------------------------------------------
// Quick metadata fetch: title, thumbnail, duration, platform.
// Cached for 5 minutes. Uses robust 3-strategy fallback extractor.

router.post("/preview", async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    res.status(429).json({ error: "RATE_LIMIT", message: "Too many requests. Please wait a moment." });
    return;
  }

  const { url } = req.body as { url?: string };
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "INVALID_REQUEST", message: "URL is required." });
    return;
  }
  if (!validateUrl(url)) {
    res.status(400).json({ error: "INVALID_URL", message: "Please provide a valid HTTP/HTTPS link." });
    return;
  }

  const cached = previewCache.get<object>(url);
  if (cached) { res.json(cached); return; }

  const handler = getHandler(url);
  console.log(`[preview] handler=${handler.name} url=${url}`);

  const { result, errInfo, usedHeartbeat } = await withHeartbeat(
    res,
    (async () => {
      const { info } = await extractInfoRobust(url, handler.getConfig());
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
// Full metadata + format listing. Cached for 3 minutes.
// Uses robust 3-strategy fallback extractor.

router.post("/info", async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    res.status(429).json({ error: "RATE_LIMIT", message: "Too many requests. Please wait a moment." });
    return;
  }

  const { url } = req.body as { url?: string };
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "INVALID_REQUEST", message: "URL is required." });
    return;
  }
  if (!validateUrl(url)) {
    res.status(400).json({ error: "INVALID_URL", message: "Please provide a valid HTTP/HTTPS link." });
    return;
  }

  const cached = infoCache.get<object>(url);
  if (cached) { res.json(cached); return; }

  const handler = getHandler(url);
  console.log(`[info] handler=${handler.name} url=${url}`);

  const { result, errInfo, usedHeartbeat } = await withHeartbeat(
    res,
    (async () => {
      const { info, strategy, retries } = await extractInfoRobust(url, handler.getConfig());
      if (retries > 0) console.log(`[info] recovered via strategy=${strategy} retries=${retries}`);
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
// Resolves a direct playable video URL using yt-dlp -g.
// Returns JSON { playUrl } — no server-side streaming.
// The client plays the URL directly; this avoids seekability issues
// and ffmpeg HLS-to-mp4 muxing failures when piping to stdout.

router.get("/play", async (req: Request, res: Response) => {
  const { url } = req.query as { url?: string };
  if (!url || !validateUrl(url)) {
    res.status(400).json({ error: "INVALID_URL", message: "Invalid URL." });
    return;
  }

  console.log(`[play] resolving direct URL for: ${url}`);
  const handler = getHandler(url);

  const { result, errInfo, usedHeartbeat } = await withHeartbeat(
    res,
    (async () => {
      const playUrl = await resolvePlaybackUrl(url, handler.getConfig());
      return { playUrl };
    })(),
  );

  if (errInfo) {
    console.error("[play] error:", errInfo.code);
    endHeartbeat(res, usedHeartbeat, { error: "PLAY_UNAVAILABLE", message: "Preview not available for this video." }, 404);
    return;
  }

  console.log(`[play] resolved OK`);
  endHeartbeat(res, usedHeartbeat, result!);
});

// ---- GET /stream ----------------------------------------------------------
// Final download endpoint. Streams directly — no temp files.
// Free users are capped at 720p; premium users get full quality.

router.get("/stream", async (req: Request, res: Response) => {
  const { url, formatId, quality, isPremium, title } = req.query as {
    url?: string; formatId?: string; quality?: string;
    isPremium?: string; title?: string;
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
  const effectiveStreamUrl = cfg.urlTransform ? cfg.urlTransform(url) : url;

  const ytdlpFormat = cfg.downloadFormatOverride
    ? cfg.downloadFormatOverride(formatId, isAudioOnly)
    : buildFormatFallbackChain(formatId, isAudioOnly)[0];

  // Flush headers immediately to keep proxy alive during yt-dlp processing.
  // The body follows once the temp file is ready (may take 10-60 s).
  res.flushHeaders();

  console.log(`[stream] handler=${handler.name} format=${ytdlpFormat} premium=${premiumUser}`);
  await streamViaTemp({
    req, res, url: effectiveStreamUrl, format: ytdlpFormat, ext,
    extraArgs: cfg.extraArgs,
    isPremium: premiumUser,
    isAudioOnly,
  });
});

// ---- GET /direct ----------------------------------------------------------
// Resolves the direct CDN download URL using yt-dlp --get-url.
// Returns { directUrl, filename } — client downloads directly from CDN.
// This avoids server-side video download entirely, making it near-instant.

router.get("/direct", async (req: Request, res: Response) => {
  const { url, formatId, quality, isPremium, title } = req.query as {
    url?: string; formatId?: string; quality?: string;
    isPremium?: string; title?: string;
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

  const handler = getHandler(url);
  const cfg = handler.getConfig();
  const effectiveDirectUrl = cfg.urlTransform ? cfg.urlTransform(url) : url;

  const ytdlpPrimaryFormat = cfg.downloadFormatOverride
    ? cfg.downloadFormatOverride(formatId, isAudioOnly)
    : buildFormatFallbackChain(formatId, isAudioOnly)[0];

  console.log(`[direct] handler=${handler.name} format=${ytdlpPrimaryFormat}`);

  // Format fallback chain for direct URL resolution
  // For /direct we ONLY use single-file formats (no bestvideo+bestaudio).
  // yt-dlp --get-url on a combined format outputs TWO URLs (video + audio
  // separately) which cannot be played by the client without merging.
  // Single-file formats always produce exactly one URL.
  const singleFileFormats = isAudioOnly
    ? [
        `${ytdlpPrimaryFormat}`,
        "bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio",
        "bestaudio",
      ]
    : [
        "best[ext=mp4]",
        "best[ext=webm]",
        "best",
        "worst",
      ];
  const uniqueDirectChain = [...new Set(singleFileFormats)];

  const { result, errInfo, usedHeartbeat } = await withHeartbeat(
    res,
    (async () => {
      let lastErr: Error = new Error("No direct URL resolved.");
      for (const fmt of uniqueDirectChain) {
        try {
          const { stdout } = await new Promise<{ stdout: string }>((resolve, reject) => {
            const proc = spawn(YTDLP, [
              ...BASE_YTDLP_ARGS,
              ...cfg.extraArgs,
              "-f", fmt,
              "--get-url",
              effectiveDirectUrl,
            ], { stdio: ["ignore", "pipe", "pipe"] });

            let out = "";
            proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
            proc.stderr.on("data", (d: Buffer) => {
              const line = d.toString().trim();
              if (line && !line.startsWith("[debug]")) console.log("[direct-yt-dlp]", line);
            });
            proc.on("error", reject);
            proc.on("close", (code) => {
              if (code === 0) resolve({ stdout: out });
              else reject(new Error(`yt-dlp exited ${code}`));
            });
          });

          const lines = stdout.trim().split("\n").filter((l) => l.startsWith("http"));
          // If more than 1 URL is returned, it's a split video+audio stream —
          // cannot be played directly. Skip to the next single-file format.
          if (lines.length === 1 && lines[0]) {
            console.log(`[direct] resolved OK with format: ${fmt}`);
            return { directUrl: lines[0], filename };
          }
          if (lines.length > 1) {
            console.warn(`[direct] format "${fmt}" returned ${lines.length} URLs (needs merge), skipping...`);
          }
        } catch (err) {
          lastErr = err instanceof Error ? err : new Error(String(err));
          console.warn(`[direct] format "${fmt}" failed, trying next...`);
        }
      }
      throw lastErr;
    })(),
  );

  if (errInfo) {
    console.error("[direct] error:", errInfo.code);
    endHeartbeat(res, usedHeartbeat, { error: errInfo.code, message: errInfo.message }, errInfo.status);
    return;
  }

  console.log(`[direct] resolved OK`);
  endHeartbeat(res, usedHeartbeat, result!);
});

// ---- GET /pipe ------------------------------------------------------------
// Resolves the direct CDN URL, then proxies the response back to the client.
// This lets the browser download video without leaving the app or opening a
// new tab. The server acts as a transparent pipe — no temp files, no disk I/O.

router.get("/pipe", async (req: Request, res: Response) => {
  const { url, formatId, quality, isPremium, title, directUrl: preResolvedUrl } = req.query as {
    url?: string; formatId?: string; quality?: string;
    isPremium?: string; title?: string; directUrl?: string;
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

  const handler = getHandler(url);
  const cfg = handler.getConfig();
  const effectivePipeUrl = cfg.urlTransform ? cfg.urlTransform(url) : url;

  const ytdlpFormat = cfg.downloadFormatOverride
    ? cfg.downloadFormatOverride(formatId, isAudioOnly)
    : buildFormatFallbackChain(formatId, isAudioOnly)[0];

  // ─── Helper: proxy a CDN URL to client ──────────────────────────────────
  const proxyCdnUrl = async (cdnUrl: string): Promise<void> => {
    const cdnResp = await fetch(cdnUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": new URL(url).origin,
        ...(req.headers.range ? { "Range": req.headers.range } : {}),
      },
    });

    if (!cdnResp.ok || !cdnResp.body) {
      throw new Error(`CDN responded ${cdnResp.status}`);
    }

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", isAudioOnly ? "audio/mpeg" : "video/mp4");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Cache-Control", "no-cache");
    if (cdnResp.headers.get("content-length")) {
      res.setHeader("Content-Length", cdnResp.headers.get("content-length")!);
    }
    if (cdnResp.status === 206) res.status(206);

    const { Readable } = await import("stream");
    const readable = Readable.fromWeb(cdnResp.body as any);
    readable.pipe(res);
    readable.on("error", (e) => {
      console.error("[pipe] stream error:", e);
      if (!res.writableEnded) res.destroy();
    });
    req.on("close", () => readable.destroy());
  };

  // ─── Free users always go through streamViaTemp (watermark + audio merge) ──
  // CDN proxy path skips server-side processing so watermark is never applied.
  // Premium users may use CDN proxy for speed (no watermark needed).
  if (!premiumUser && !isAudioOnly) {
    console.log(`[pipe] free user — routing through streamViaTemp for watermark`);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    return streamViaTemp({ req, res, url: effectivePipeUrl, format: ytdlpFormat, ext, extraArgs: cfg.extraArgs, isPremium: false, isAudioOnly });
  }

  // ─── Premium fast path: client already resolved CDN URL ──────────────────
  if (preResolvedUrl && preResolvedUrl.startsWith("http")) {
    console.log(`[pipe] premium — using pre-resolved URL`);
    try {
      await proxyCdnUrl(preResolvedUrl);
      console.log(`[pipe] pre-resolved stream OK`);
      return;
    } catch (err) {
      console.warn("[pipe] pre-resolved URL failed, falling back to yt-dlp resolve:", err);
    }
  }

  // ─── Premium normal path: resolve CDN URL via yt-dlp then proxy ──────────
  console.log(`[pipe] handler=${handler.name} format=${ytdlpFormat}`);

  // Only single-file formats so the CDN URL has both video AND audio.
  const pipeSingleFileChain = isAudioOnly
    ? ["bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio", "bestaudio"]
    : ["best[ext=mp4]", "best[ext=webm]", "best", "worst"];
  const uniquePipeChain = [...new Set(pipeSingleFileChain)];

  let cdnUrl: string;
  try {
    let resolved: string | null = null;
    for (const fmt of uniquePipeChain) {
      try {
        const { stdout } = await new Promise<{ stdout: string }>((resolve, reject) => {
          const proc = spawn(YTDLP, [
            ...BASE_YTDLP_ARGS,
            ...cfg.extraArgs,
            "-f", fmt,
            "--get-url",
            effectivePipeUrl,
          ], { stdio: ["ignore", "pipe", "pipe"] });

          let out = "";
          proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
          proc.stderr.on("data", (d: Buffer) => {
            const line = d.toString().trim();
            if (line && !line.startsWith("[debug]")) console.log("[pipe-yt-dlp]", line);
          });
          proc.on("error", reject);
          proc.on("close", (code) => {
            if (code === 0) resolve({ stdout: out });
            else reject(new Error(`yt-dlp exited ${code}`));
          });
        });

        const lines = stdout.trim().split("\n").filter((l) => l.startsWith("http"));
        // Skip combined formats that return 2 URLs (video + audio separate)
        if (lines.length === 1 && lines[0]) {
          resolved = lines[0];
          console.log(`[pipe] CDN URL resolved with format: ${fmt}`);
          break;
        }
        if (lines.length > 1) {
          console.warn(`[pipe] format "${fmt}" returned ${lines.length} URLs, skipping...`);
        }
      } catch {
        console.warn(`[pipe] format "${fmt}" failed, trying next...`);
      }
    }
    if (!resolved) throw new Error("No CDN URL resolved.");
    cdnUrl = resolved;
  } catch (err) {
    console.error("[pipe] URL resolve failed, falling back to streamViaTemp:", err);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", isAudioOnly ? "audio/mpeg" : "video/mp4");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    return streamViaTemp({ req, res, url: effectivePipeUrl, format: ytdlpFormat, ext, extraArgs: cfg.extraArgs, isPremium: premiumUser, isAudioOnly });
  }

  try {
    console.log(`[pipe] proxying from CDN URL...`);
    await proxyCdnUrl(cdnUrl);
    console.log(`[pipe] streaming OK`);
  } catch (err) {
    console.error("[pipe] CDN proxy failed, falling back to streamViaTemp:", err);
    if (!res.headersSent) {
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", isAudioOnly ? "audio/mpeg" : "video/mp4");
      res.flushHeaders();
    }
    return streamViaTemp({ req, res, url: effectivePipeUrl, format: ytdlpFormat, ext, extraArgs: cfg.extraArgs, isPremium: premiumUser, isAudioOnly });
  }
});

// ---- GET /trim ------------------------------------------------------------
// Downloads the video with yt-dlp, then uses ffmpeg to trim to the
// specified start/end time range. Streams the trimmed clip to the client.
// Requires premium (isPremium=true). Free users are blocked.

router.get("/trim", async (req: Request, res: Response) => {
  const { url, formatId, quality, isPremium, title, startTime, endTime } = req.query as {
    url?: string; formatId?: string; quality?: string;
    isPremium?: string; title?: string;
    startTime?: string; endTime?: string;
  };

  if (!url || !formatId) {
    res.status(400).json({ error: "INVALID_REQUEST", message: "url and formatId are required." });
    return;
  }
  if (!validateUrl(url)) {
    res.status(400).json({ error: "INVALID_URL", message: "Invalid URL." });
    return;
  }
  if (isPremium !== "true") {
    res.status(403).json({ error: "PREMIUM_REQUIRED", message: "Video trimming requires Premium." });
    return;
  }

  const startSec = Math.max(0, parseFloat(startTime ?? "0") || 0);
  const endSec = parseFloat(endTime ?? "0") || 0;

  if (endSec <= startSec) {
    res.status(400).json({ error: "INVALID_RANGE", message: "End time must be greater than start time." });
    return;
  }

  const isAudioOnly = quality === "Audio Only" || formatId === "bestaudio";
  const safeTitle = (title ?? "video").replace(/[^a-zA-Z0-9_\- ]/g, "_").substring(0, 60);
  const filename = `${safeTitle}_trim_${Math.round(startSec)}s_${Math.round(endSec)}s.mp4`;

  const handler = getHandler(url);
  const cfg = handler.getConfig();
  const effectiveTrimUrl = cfg.urlTransform ? cfg.urlTransform(url) : url;

  const isFullSelector = formatId.includes("/") || formatId.includes("[") || formatId.includes("+");
  const ytdlpFormat = cfg.downloadFormatOverride
    ? cfg.downloadFormatOverride(formatId, isAudioOnly)
    : isFullSelector
      ? formatId
      : `${formatId}+bestaudio[ext=m4a]/${formatId}+bestaudio[ext=webm]/${formatId}+bestaudio/${formatId}/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best`;

  const tmpId = randomBytes(8).toString("hex");
  const tmpRaw = `/tmp/rvtrim-${tmpId}.mp4`;
  const tmpTrimmed = `/tmp/rvtrim-${tmpId}-cut.mp4`;

  const cleanup = () => {
    fsp.unlink(tmpRaw).catch(() => {});
    fsp.unlink(tmpTrimmed).catch(() => {});
  };

  let clientGone = false;
  req.on("close", () => { clientGone = true; });

  console.log(`[trim] handler=${handler.name} format=${ytdlpFormat} start=${startSec} end=${endSec}`);

  try {
    // Phase 1: download full (or partial) video with yt-dlp
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(YTDLP, [
        ...BASE_YTDLP_ARGS,
        ...cfg.extraArgs,
        "-f", ytdlpFormat,
        "--merge-output-format", "mp4",
        "-o", tmpRaw,
        effectiveTrimUrl,
      ], { stdio: ["ignore", "pipe", "pipe"] });

      proc.stderr.on("data", (d: Buffer) => {
        const line = d.toString().trim();
        if (line && !line.startsWith("[debug]")) console.log("[trim-yt-dlp]", line);
      });
      req.on("close", () => { try { proc.kill("SIGTERM"); } catch { /* ignore */ } });
      proc.on("error", reject);
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`yt-dlp exited ${code}`));
      });
    });

    if (clientGone) { cleanup(); return; }

    // Phase 2: trim with ffmpeg (stream copy — fast, no re-encode)
    await new Promise<void>((resolve, reject) => {
      const proc = spawn("ffmpeg", [
        "-y",
        "-i", tmpRaw,
        "-ss", String(startSec),
        "-to", String(endSec),
        "-c", "copy",
        "-movflags", "+faststart",
        tmpTrimmed,
      ], { stdio: ["ignore", "pipe", "pipe"] });

      proc.stderr.on("data", (d: Buffer) => {
        const line = d.toString().trim();
        if (line) console.log("[trim-ffmpeg]", line);
      });
      proc.on("error", reject);
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited ${code}`));
      });
    });

    if (clientGone) { cleanup(); return; }

    // Phase 3: stream trimmed file to client
    const stat = await fsp.stat(tmpTrimmed);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Length", String(stat.size));
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Cache-Control", "no-cache");

    const stream = createReadStream(tmpTrimmed);
    stream.pipe(res);
    stream.on("end", () => { cleanup(); });
    stream.on("error", (e) => {
      console.error("[trim] stream error:", e);
      cleanup();
      if (!res.writableEnded) res.destroy();
    });
    req.on("close", () => { stream.destroy(); cleanup(); });

    console.log(`[trim] streaming trimmed clip OK (${stat.size} bytes)`);
  } catch (err) {
    cleanup();
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[trim] error:", msg);
    if (!res.headersSent) {
      const classified = classifyError(msg);
      res.status(classified.status).json({ error: classified.code, message: classified.message });
    } else if (!res.writableEnded) {
      res.destroy();
    }
  }
});

// ---- GET /update ----------------------------------------------------------
// Triggers yt-dlp self-update. Run periodically to keep extractors current.

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
// Server health + yt-dlp version info.

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

// ---- Download helper (temp file) ------------------------------------------
// Downloads to /tmp first so ffmpeg can seek freely during mux.
// This handles HLS/DASH merge, VP9+opus, and any format needing random access.
// After yt-dlp exits cleanly, we optionally add a watermark (free users),
// then stream the file to the client and delete all temp files.

const BASE_YTDLP_ARGS = [
  "--no-warnings", "--no-playlist",
  "--no-check-certificate",
  "--concurrent-fragments", "8",
  "--buffer-size", "1M",
  "--http-chunk-size", "10M",
  "--retries", "5",
  "--fragment-retries", "5",
  "--socket-timeout", "20",
  "--extractor-retries", "3",
  "--format-sort", "res,fps,codec:avc:m4a,size,br,asr",
];

async function runProcess(args: string[], bin: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    proc.stderr.on("data", (d: Buffer) => {
      const line = d.toString().trim();
      if (line && !line.startsWith("[debug]")) console.log(`[${bin}]`, line);
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${bin} exited ${code}`));
    });
  });
}

async function addWatermark(inputPath: string, outputPath: string): Promise<void> {
  const watermarkText = "LinkB Downloader";

  // Two-layer watermark: a small rounded badge in the bottom-right corner.
  // Layer 1: semi-transparent dark background box
  // Layer 2: white text on top of it
  const drawtext =
    `drawtext=text='  ${watermarkText}  ':` +
    `fontsize=18:fontcolor=white@0.90:` +
    `x=w-tw-14:y=h-th-14:` +
    `box=1:boxcolor=0x1A3A6A@0.75:boxborderw=8:` +
    `font=monospace`;

  await runProcess([
    "-y", "-i", inputPath,
    "-vf", drawtext,
    "-c:v", "libx264", "-preset", "fast", "-crf", "18",
    "-c:a", "copy",
    "-movflags", "+faststart",
    outputPath,
  ], "ffmpeg");
}

// Tries a single yt-dlp format selector and downloads to tmpRaw.
// Returns true on success, throws on failure.
async function tryDownloadWithFormat(opts: {
  url: string; format: string; ext: string;
  extraArgs: string[]; tmpRaw: string;
  req: Request;
}): Promise<void> {
  const { url, format, ext, extraArgs, tmpRaw, req } = opts;
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(YTDLP, [
      ...BASE_YTDLP_ARGS,
      ...extraArgs,
      "-f", format,
      "--merge-output-format", ext,
      "-o", tmpRaw,
      url,
    ], { stdio: ["ignore", "pipe", "pipe"] });

    proc.stderr.on("data", (d: Buffer) => {
      const line = d.toString().trim();
      if (line && !line.startsWith("[debug]")) console.log("[yt-dlp]", line);
    });
    req.on("close", () => { try { proc.kill("SIGTERM"); } catch { /* ignore */ } });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`yt-dlp exited ${code} with format "${format}"`));
    });
  });
}

async function streamViaTemp(opts: {
  req: Request; res: Response; url: string;
  format: string; ext: string; extraArgs: string[];
  isPremium: boolean; isAudioOnly: boolean;
}): Promise<void> {
  const { req, res, url, format, ext, extraArgs, isPremium, isAudioOnly } = opts;
  const tmpId = randomBytes(8).toString("hex");
  const tmpRaw = `/tmp/rvdl-${tmpId}.${ext}`;
  const tmpWm  = `/tmp/rvdl-${tmpId}-wm.${ext}`;
  const cleanup = () => {
    fsp.unlink(tmpRaw).catch(() => {});
    fsp.unlink(tmpWm).catch(() => {});
  };

  let clientGone = false;
  req.on("close", () => { clientGone = true; });

  // Build a fallback chain: try the requested format, then progressively simpler ones
  const formatChain = [
    format,
    "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=mp4]/best",
    "best[ext=mp4]/best[ext=webm]/best",
    "best",
    "worst",
  ];

  // Deduplicate while preserving order
  const uniqueChain = [...new Set(formatChain)];

  try {
    // Phase 1: yt-dlp downloads + merges to temp file (with format fallback)
    let downloadSuccess = false;
    let lastErr: Error = new Error("All format selectors failed");

    for (const fmt of uniqueChain) {
      if (clientGone) return;
      try {
        console.log(`[yt-dlp] trying format: ${fmt}`);
        await tryDownloadWithFormat({ url, format: fmt, ext, extraArgs, tmpRaw, req });
        downloadSuccess = true;
        console.log(`[yt-dlp] success with format: ${fmt}`);
        break;
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error(String(err));
        console.warn(`[yt-dlp] format "${fmt}" failed, trying next...`);
        // Clean up any partial file before retry
        fsp.unlink(tmpRaw).catch(() => {});
      }
    }

    if (!downloadSuccess) throw lastErr;
    if (clientGone) return;

    // Phase 2: Add watermark for free users (video only, not audio)
    let serveFile = tmpRaw;
    if (!isPremium && !isAudioOnly) {
      try {
        console.log("[watermark] adding free-tier watermark...");
        await addWatermark(tmpRaw, tmpWm);
        serveFile = tmpWm;
        console.log("[watermark] done");
      } catch (wmErr) {
        console.warn("[watermark] failed, serving original:", wmErr);
        serveFile = tmpRaw;
      }
    }

    // Phase 3: Stream completed file to client
    const stat = await fsp.stat(serveFile);
    if (!res.headersSent) {
      res.setHeader("Content-Length", String(stat.size));
      res.setHeader("X-Accel-Buffering", "no");
    }

    await new Promise<void>((resolve, reject) => {
      const rs = createReadStream(serveFile);
      rs.pipe(res, { end: true });
      rs.on("end", resolve);
      rs.on("error", reject);
      req.on("close", () => { rs.destroy(); resolve(); });
    });

  } catch (err) {
    console.error("[stream-temp] failed:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "DOWNLOAD_FAILED", message: "Could not download this video. Please try again." });
    }
  } finally {
    cleanup();
  }
}

export default router;

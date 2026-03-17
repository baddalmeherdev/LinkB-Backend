import { Router, type IRouter, type Request, type Response } from "express";
import { execFile, spawn } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import { createReadStream } from "fs";
import * as path from "path";
import * as os from "os";

const execFileAsync = promisify(execFile);
const router: IRouter = Router();

const YTDLP = "yt-dlp";
const FFMPEG = "ffmpeg";
const WATERMARK_FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 20;
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

function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function detectPlatform(url: string): string {
  if (/youtube\.com|youtu\.be/.test(url)) return "YouTube";
  if (/instagram\.com/.test(url)) return "Instagram";
  if (/facebook\.com|fb\.watch/.test(url)) return "Facebook";
  if (/twitter\.com|x\.com/.test(url)) return "X/Twitter";
  if (/tiktok\.com/.test(url)) return "TikTok";
  if (/vimeo\.com/.test(url)) return "Vimeo";
  if (/dailymotion\.com/.test(url)) return "Dailymotion";
  if (/twitch\.tv/.test(url)) return "Twitch";
  if (/reddit\.com/.test(url)) return "Reddit";
  if (/pinterest\.com/.test(url)) return "Pinterest";
  if (/linkedin\.com/.test(url)) return "LinkedIn";
  if (/snapchat\.com/.test(url)) return "Snapchat";
  if (/bilibili\.com/.test(url)) return "Bilibili";
  if (/soundcloud\.com/.test(url)) return "SoundCloud";
  if (/rumble\.com/.test(url)) return "Rumble";
  if (/odysee\.com/.test(url)) return "Odysee";
  if (/kick\.com/.test(url)) return "Kick";
  return "Web";
}

async function cleanupFiles(...files: string[]): Promise<void> {
  for (const f of files) {
    try {
      await fs.promises.unlink(f);
    } catch {
    }
  }
}

router.post("/preview", async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    res.status(429).json({ error: "RATE_LIMIT", message: "Too many requests. Please wait a minute." });
    return;
  }

  const { url } = req.body as { url?: string };
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "INVALID_REQUEST", message: "URL is required" });
    return;
  }
  if (!validateUrl(url)) {
    res.status(400).json({ error: "INVALID_URL", message: "Please provide a valid HTTP/HTTPS URL" });
    return;
  }

  try {
    const { stdout } = await execFileAsync(YTDLP, [
      "--dump-json",
      "--no-playlist",
      "--no-warnings",
      url,
    ], { timeout: 20000 });

    const info = JSON.parse(stdout) as Record<string, unknown>;

    res.json({
      title: String(info.title ?? "Unknown Title"),
      thumbnail: (info.thumbnail as string | null) ?? null,
      duration: (info.duration as number | null) ?? null,
      uploader: (info.uploader as string | null) ?? null,
      platform: detectPlatform(url),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unsupported URL") || msg.includes("unsupported url")) {
      res.status(400).json({ error: "UNSUPPORTED_URL", message: "This URL is not supported." });
      return;
    }
    if (msg.includes("private") || msg.includes("unavailable")) {
      res.status(400).json({ error: "PREVIEW_FAILED", message: "This video is private or unavailable." });
      return;
    }
    res.status(400).json({ error: "PREVIEW_FAILED", message: "Could not fetch video preview. Please check the URL." });
  }
});

router.post("/info", async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    res.status(429).json({ error: "RATE_LIMIT", message: "Too many requests. Please wait a minute." });
    return;
  }

  const { url } = req.body as { url?: string };
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "INVALID_REQUEST", message: "URL is required" });
    return;
  }
  if (!validateUrl(url)) {
    res.status(400).json({ error: "INVALID_URL", message: "Please provide a valid HTTP/HTTPS URL" });
    return;
  }

  try {
    const { stdout } = await execFileAsync(YTDLP, [
      "--dump-json",
      "--no-playlist",
      "--no-warnings",
      "--compat-options", "no-youtube-unavailable-videos",
      url,
    ], { timeout: 45000 });

    const info = JSON.parse(stdout) as Record<string, unknown>;
    const formats = (info.formats as Record<string, unknown>[]) ?? [];

    type QualityItem = {
      formatId: string;
      quality: string;
      resolution: string;
      ext: string;
      filesize: number | null;
      isAudioOnly: boolean;
    };

    const qualities: QualityItem[] = [];
    const seenResolutions = new Set<string>();

    const audioFormats = formats.filter(
      (f) => f.vcodec === "none" && f.acodec !== "none" && f.acodec !== null
    );
    const bestAudio = audioFormats.sort((a, b) => ((b.abr as number) ?? 0) - ((a.abr as number) ?? 0))[0];
    if (bestAudio) {
      qualities.push({
        formatId: String(bestAudio.format_id),
        quality: "Audio Only",
        resolution: "audio",
        ext: "mp3",
        filesize: (bestAudio.filesize as number | null) ?? null,
        isAudioOnly: true,
      });
    }

    const videoFormats = formats
      .filter(
        (f) =>
          f.vcodec !== "none" &&
          f.vcodec !== null &&
          f.height &&
          typeof f.height === "number" &&
          f.height > 0
      )
      .sort((a, b) => ((b.height as number) ?? 0) - ((a.height as number) ?? 0));

    const targetQualities = [144, 240, 360, 480, 720, 1080];
    for (const target of targetQualities) {
      const closest = videoFormats.reduce<Record<string, unknown> | null>((best, f) => {
        const h = f.height as number;
        if (!best) return f;
        const bestH = best.height as number;
        if (Math.abs(h - target) < Math.abs(bestH - target)) return f;
        return best;
      }, null);

      if (closest) {
        const h = closest.height as number;
        const resKey = String(h);
        if (!seenResolutions.has(resKey)) {
          seenResolutions.add(resKey);
          qualities.push({
            formatId: String(closest.format_id),
            quality: `${h}p`,
            resolution: `${closest.width ?? "?"}x${h}`,
            ext: "mp4",
            filesize: (closest.filesize as number | null) ?? null,
            isAudioOnly: false,
          });
        }
      }
    }

    if (qualities.length === 0 && info.url) {
      qualities.push({
        formatId: "best",
        quality: "Best Available",
        resolution: "auto",
        ext: "mp4",
        filesize: null,
        isAudioOnly: false,
      });
    }

    const sortedQualities = [
      ...qualities.filter((q) => q.isAudioOnly),
      ...qualities
        .filter((q) => !q.isAudioOnly)
        .sort((a, b) => {
          const aH = parseInt(a.quality) || 0;
          const bH = parseInt(b.quality) || 0;
          return aH - bH;
        }),
    ];

    res.json({
      title: String(info.title ?? "Unknown Title"),
      thumbnail: (info.thumbnail as string | null) ?? null,
      duration: (info.duration as number | null) ?? null,
      uploader: (info.uploader as string | null) ?? null,
      platform: detectPlatform(url),
      qualities: sortedQualities,
      originalUrl: url,
    });
  } catch (err: unknown) {
    console.error("yt-dlp error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("ENOENT")) {
      res.status(500).json({ error: "YT_DLP_MISSING", message: "Downloader service is unavailable. Please try again later." });
      return;
    }
    if (msg.includes("private") || msg.includes("unavailable") || msg.includes("not available")) {
      res.status(400).json({ error: "FETCH_FAILED", message: "This video is private or unavailable. Please check the URL and try again." });
      return;
    }
    if (msg.includes("Unsupported URL") || msg.includes("unsupported url")) {
      res.status(400).json({ error: "UNSUPPORTED_URL", message: "This URL is not supported. Please try a URL from YouTube, Instagram, TikTok, Facebook, Twitter, or another supported platform." });
      return;
    }
    res.status(500).json({
      error: "FETCH_FAILED",
      message: "Could not fetch media info. Please check the URL and try again.",
    });
  }
});

router.get("/stream", async (req: Request, res: Response) => {
  const { url, formatId, quality, isPremium, title } = req.query as {
    url?: string;
    formatId?: string;
    quality?: string;
    isPremium?: string;
    title?: string;
  };

  if (!url || !formatId) {
    res.status(400).json({ error: "INVALID_REQUEST", message: "url and formatId are required" });
    return;
  }
  if (!validateUrl(url)) {
    res.status(400).json({ error: "INVALID_URL", message: "Invalid URL" });
    return;
  }

  const premiumUser = isPremium === "true";
  const isHdFormat = ["720p", "1080p", "2160p"].includes(quality ?? "");
  if (isHdFormat && !premiumUser) {
    res.status(403).json({ error: "PREMIUM_REQUIRED", message: "HD downloads require Premium" });
    return;
  }

  const isAudioOnly = formatId === "bestaudio" || formatId.startsWith("audio") || quality === "Audio Only";
  const ext = isAudioOnly ? "mp3" : "mp4";
  const safeTitle = (title ?? "video").replace(/[^a-zA-Z0-9_\- ]/g, "_").substring(0, 80);
  const filename = `${safeTitle}.${ext}`;

  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", isAudioOnly ? "audio/mpeg" : "video/mp4");

  const ytdlpFormat = isAudioOnly
    ? `${formatId}/bestaudio/best`
    : `${formatId}+bestaudio/${formatId}/best`;

  if (!premiumUser && !isAudioOnly) {
    await streamWithWatermark({ req, res, url, formatId: ytdlpFormat, safeTitle });
  } else {
    streamDirect({ req, res, url, format: ytdlpFormat, ext });
  }
});

async function streamWithWatermark(opts: {
  req: Request;
  res: Response;
  url: string;
  formatId: string;
  safeTitle: string;
}): Promise<void> {
  const { res, url, formatId } = opts;
  const tmpId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const tmpIn = path.join(os.tmpdir(), `ld_in_${tmpId}.mp4`);
  const tmpOut = path.join(os.tmpdir(), `ld_out_${tmpId}.mp4`);

  try {
    console.log(`[watermark] Downloading: ${url}`);
    await execFileAsync(YTDLP, [
      "--no-warnings",
      "--no-playlist",
      "-f", formatId,
      "--merge-output-format", "mp4",
      "-o", tmpIn,
      url,
    ], { timeout: 300000 });

    console.log(`[watermark] Applying watermark to ${tmpIn}`);

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
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "26",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      "-y",
      tmpOut,
    ], { timeout: 600000 });

    const stat = await fs.promises.stat(tmpOut);
    res.setHeader("Content-Length", String(stat.size));

    const readStream = createReadStream(tmpOut);
    readStream.pipe(res);

    const cleanup = () => cleanupFiles(tmpIn, tmpOut);
    res.on("finish", cleanup);
    res.on("close", cleanup);
    readStream.on("error", (err) => {
      console.error("[watermark] read stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "STREAM_ERROR", message: "Failed to stream watermarked video." });
      }
      cleanup();
    });
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
}): void {
  const { req, res, url, format, ext } = opts;
  res.setHeader("Transfer-Encoding", "chunked");

  const args = [
    "--no-warnings",
    "--no-playlist",
    "-f", format,
    "--merge-output-format", ext,
    "-o", "-",
    url,
  ];

  console.log(`[stream] Direct: ${url} format=${format}`);
  const proc = spawn(YTDLP, args, { stdio: ["ignore", "pipe", "pipe"] });

  proc.stderr.on("data", (d: Buffer) => {
    const line = d.toString().trim();
    if (line) console.log("[yt-dlp]", line);
  });

  proc.stdout.pipe(res);

  req.on("close", () => {
    proc.kill("SIGTERM");
  });

  proc.on("error", (err) => {
    console.error("spawn error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "STREAM_ERROR", message: "Could not start download." });
    }
  });

  proc.on("close", (code) => {
    if (code !== 0) {
      console.error(`yt-dlp exited with code ${code}`);
    }
  });
}

export default router;

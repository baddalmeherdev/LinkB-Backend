import { Router, type IRouter, type Request, type Response } from "express";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const router: IRouter = Router();

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10;
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
  return "Unknown";
}

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
    const ytdlpPath = "yt-dlp";
    const { stdout } = await execFileAsync(ytdlpPath, [
      "--dump-json",
      "--no-playlist",
      "--no-warnings",
      url,
    ], { timeout: 30000 });

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
        ext: String(bestAudio.ext ?? "m4a"),
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
            ext: String(closest.ext ?? "mp4"),
            filesize: (closest.filesize as number | null) ?? null,
            isAudioOnly: false,
          });
        }
      }
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
      res.status(500).json({
        error: "YT_DLP_MISSING",
        message: "yt-dlp is not installed on the server.",
      });
      return;
    }
    res.status(500).json({
      error: "FETCH_FAILED",
      message: "Could not fetch video info. The URL may not be supported or the video may be private.",
    });
  }
});

router.post("/download", async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    res.status(429).json({ error: "RATE_LIMIT", message: "Too many requests. Please wait a minute." });
    return;
  }

  const { url, formatId, isPremium } = req.body as {
    url?: string;
    formatId?: string;
    isPremium?: boolean;
  };

  if (!url || !formatId) {
    res.status(400).json({ error: "INVALID_REQUEST", message: "URL and formatId are required" });
    return;
  }
  if (!validateUrl(url)) {
    res.status(400).json({ error: "INVALID_URL", message: "Please provide a valid URL" });
    return;
  }

  const isHD = ["720", "1080", "2160"].some((q) => formatId.includes(q));
  if (isHD && !isPremium) {
    res.status(403).json({ error: "PREMIUM_REQUIRED", message: "HD downloads require a Premium account" });
    return;
  }

  try {
    const { stdout } = await execFileAsync("yt-dlp", [
      "--dump-json",
      "--no-playlist",
      "--no-warnings",
      "-f", formatId,
      url,
    ], { timeout: 30000 });

    const info = JSON.parse(stdout) as Record<string, unknown>;
    const formats = (info.formats as Record<string, unknown>[]) ?? [];
    const format = formats.find((f) => String(f.format_id) === formatId) ?? info;

    const downloadUrl = String(
      (format as Record<string, unknown>).url ?? info.url ?? ""
    );
    const title = String(info.title ?? "video").replace(/[^a-zA-Z0-9_\- ]/g, "_");
    const ext = String((format as Record<string, unknown>).ext ?? "mp4");
    const height = (format as Record<string, unknown>).height;
    const isAudioOnly = (format as Record<string, unknown>).vcodec === "none";
    const quality = isAudioOnly ? "audio" : height ? `${height}p` : "unknown";

    res.json({
      downloadUrl,
      filename: `${title}_${quality}.${ext}`,
      quality,
      isAudioOnly: !!isAudioOnly,
    });
  } catch (err) {
    console.error("download error:", err);
    res.status(500).json({
      error: "DOWNLOAD_FAILED",
      message: "Could not get download link.",
    });
  }
});

export default router;

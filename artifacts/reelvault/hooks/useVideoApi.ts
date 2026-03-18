import { useState } from "react";
import type { VideoInfo, VideoQuality } from "@/context/AppContext";
import type { PreviewData } from "@/components/LinkPreviewCard";

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

// Maximum time to wait for a single API attempt (90 s).
// yt-dlp can take 10-45 s on first run; we give generous room.
const REQUEST_TIMEOUT_MS = 90_000;

// Retry configuration: 2 retries after initial failure, with a back-off delay.
const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [2_000, 4_000]; // back-off per retry index

// ---- Internal fetch helper ------------------------------------------------
// Wraps fetch with:
//  • A per-attempt AbortController timeout
//  • Automatic retries on network error or server 5xx
//  • Checks BOTH HTTP status AND body.error (heartbeat endpoints always 200)

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await new Promise<void>((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1] ?? 4_000));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);

      let data: Record<string, unknown> = {};
      try {
        const text = await res.text();
        data = JSON.parse(text.trim()) as Record<string, unknown>;
      } catch {
        data = {};
      }

      // Retry on 5xx server errors (but not 4xx — those are caller's problem)
      if (res.status >= 500 && attempt < retries) {
        lastErr = new Error(`Server error ${res.status}`);
        continue;
      }

      // Heartbeat endpoints commit to 200 and embed errors in body.
      // Treat body.error exactly like a non-2xx status.
      const bodyHasError = typeof data.error === "string";
      const ok = res.ok && !bodyHasError;

      return { ok, status: res.status, data };
    } catch (err) {
      clearTimeout(timeoutId);
      lastErr = err;

      // Don't retry on 4xx-equivalent AbortErrors from explicit user cancel
      // (identified elsewhere), but DO retry on AbortError caused by our timeout
      // and on plain network errors (TypeError).
      const isRetryable =
        (err instanceof Error && err.name === "AbortError") ||
        (err instanceof TypeError);

      if (!isRetryable || attempt >= retries) {
        throw err;
      }
    }
  }

  throw lastErr ?? new Error("Request failed after retries.");
}

function friendlyError(err: unknown, data?: Record<string, unknown>): string {
  // Body-level error message takes priority
  if (data?.message && typeof data.message === "string") return data.message;

  if (err instanceof Error) {
    if (err.name === "AbortError") {
      return "The request timed out. The server is processing — please try again in a moment.";
    }
    if (err instanceof TypeError || err.message.includes("network") || err.message.includes("fetch")) {
      return "Network error. Please check your internet connection and try again.";
    }
  }
  return "Something went wrong. Please try again.";
}

// ---- Public hook ----------------------------------------------------------

export function useVideoApi() {
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSlowRequest, setIsSlowRequest] = useState(false);

  const fetchPreview = async (url: string): Promise<PreviewData | null> => {
    setIsLoadingPreview(true);
    setIsSlowRequest(false);
    setError(null);

    // Show "Processing, please wait…" after 5 seconds
    const slowTimer = setTimeout(() => setIsSlowRequest(true), 5_000);

    try {
      const { ok, data } = await fetchWithRetry(
        `${BASE_URL}/api/video/preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        },
      );

      if (!ok) {
        setError(String(data.message ?? "Could not fetch preview."));
        return null;
      }
      return data as unknown as PreviewData;
    } catch (err) {
      setError(friendlyError(err));
      return null;
    } finally {
      clearTimeout(slowTimer);
      setIsLoadingPreview(false);
      setIsSlowRequest(false);
    }
  };

  const fetchVideoInfo = async (url: string): Promise<VideoInfo | null> => {
    setIsLoadingInfo(true);
    setIsSlowRequest(false);
    setError(null);

    const slowTimer = setTimeout(() => setIsSlowRequest(true), 5_000);

    try {
      const { ok, data } = await fetchWithRetry(
        `${BASE_URL}/api/video/info`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        },
      );

      if (!ok) {
        setError(String(data.message ?? "Could not fetch video info. Please try again."));
        return null;
      }
      return data as unknown as VideoInfo;
    } catch (err) {
      setError(friendlyError(err));
      return null;
    } finally {
      clearTimeout(slowTimer);
      setIsLoadingInfo(false);
      setIsSlowRequest(false);
    }
  };

  const getPlayUrl = (videoUrl: string): string => {
    const params = new URLSearchParams({ url: videoUrl });
    return `${BASE_URL}/api/video/play?${params.toString()}`;
  };

  const getStreamUrl = (
    videoUrl: string,
    quality: VideoQuality,
    title: string,
    isPremium: boolean
  ): string => {
    const params = new URLSearchParams({
      url: videoUrl,
      formatId: quality.formatId,
      quality: quality.quality,
      isPremium: String(isPremium),
      title,
    });
    return `${BASE_URL}/api/video/stream?${params.toString()}`;
  };

  // Resolves the direct CDN download URL (fast path — no server-side download).
  // Falls back to null if unsupported (caller should fall back to /stream).
  const getDirectDownloadUrl = async (
    videoUrl: string,
    quality: VideoQuality,
    title: string,
    isPremium: boolean
  ): Promise<{ directUrl: string; filename: string } | null> => {
    try {
      const params = new URLSearchParams({
        url: videoUrl,
        formatId: quality.formatId,
        quality: quality.quality,
        isPremium: String(isPremium),
        title,
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);

      const res = await fetch(`${BASE_URL}/api/video/direct?${params.toString()}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const text = await res.text();
      const data = JSON.parse(text.trim()) as Record<string, unknown>;

      if (typeof data.directUrl === "string" && data.directUrl.startsWith("http")) {
        return {
          directUrl: data.directUrl as string,
          filename: (data.filename as string) ?? `video_${quality.quality}.mp4`,
        };
      }
      return null;
    } catch {
      return null;
    }
  };

  // Returns a URL that the server resolves + pipes directly to the client.
  // No temp file, no new tab — the browser downloads in-app via fetch→blob.
  const getPipeUrl = (
    videoUrl: string,
    quality: VideoQuality,
    title: string,
    isPremium: boolean,
    preResolvedDirectUrl?: string
  ): string => {
    const params = new URLSearchParams({
      url: videoUrl,
      formatId: quality.formatId,
      quality: quality.quality,
      isPremium: String(isPremium),
      title,
    });
    if (preResolvedDirectUrl) params.set("directUrl", preResolvedDirectUrl);
    return `${BASE_URL}/api/video/pipe?${params.toString()}`;
  };

  const clearError = () => setError(null);

  return {
    fetchPreview,
    fetchVideoInfo,
    getPlayUrl,
    getStreamUrl,
    getPipeUrl,
    getDirectDownloadUrl,
    isLoadingPreview,
    isLoadingInfo,
    isSlowRequest,
    error,
    clearError,
  };
}

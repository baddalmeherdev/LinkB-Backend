import { useState } from "react";
import type { VideoInfo, VideoQuality } from "@/context/AppContext";

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

type DownloadResult = {
  downloadUrl: string;
  filename: string;
  quality: string;
  isAudioOnly: boolean;
};

export function useVideoApi() {
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [isLoadingDownload, setIsLoadingDownload] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVideoInfo = async (url: string): Promise<VideoInfo | null> => {
    setIsLoadingInfo(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/api/video/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) {
        setError(String((data as { message?: string }).message ?? "Failed to fetch video info"));
        return null;
      }
      return data as unknown as VideoInfo;
    } catch {
      setError("Network error. Please check your connection.");
      return null;
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const fetchDownloadLink = async (
    url: string,
    quality: VideoQuality,
    isPremium: boolean
  ): Promise<DownloadResult | null> => {
    setIsLoadingDownload(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/api/video/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, formatId: quality.formatId, isPremium }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) {
        const errData = data as { error?: string; message?: string };
        if (errData.error === "PREMIUM_REQUIRED") {
          setError("PREMIUM_REQUIRED");
        } else {
          setError(String(errData.message ?? "Failed to get download link"));
        }
        return null;
      }
      return data as unknown as DownloadResult;
    } catch {
      setError("Network error. Please check your connection.");
      return null;
    } finally {
      setIsLoadingDownload(false);
    }
  };

  const clearError = () => setError(null);

  return { fetchVideoInfo, fetchDownloadLink, isLoadingInfo, isLoadingDownload, error, clearError };
}

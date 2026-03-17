import { useState } from "react";
import type { VideoInfo, VideoQuality } from "@/context/AppContext";

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

export function useVideoApi() {
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
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
        setError(String((data as { message?: string }).message ?? "Could not fetch video info. Please try again."));
        return null;
      }
      return data as unknown as VideoInfo;
    } catch {
      setError("Network error. Please check your internet connection.");
      return null;
    } finally {
      setIsLoadingInfo(false);
    }
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
      isPremium: String(isPremium),
      title,
    });
    return `${BASE_URL}/api/video/stream?${params.toString()}`;
  };

  const clearError = () => setError(null);

  return { fetchVideoInfo, getStreamUrl, isLoadingInfo, error, clearError };
}

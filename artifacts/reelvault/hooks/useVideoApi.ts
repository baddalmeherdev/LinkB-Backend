import { useState } from "react";
import type { VideoInfo, VideoQuality } from "@/context/AppContext";
import type { PreviewData } from "@/components/LinkPreviewCard";

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

export function useVideoApi() {
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPreview = async (url: string): Promise<PreviewData | null> => {
    setIsLoadingPreview(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/api/video/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) {
        setError(String((data as { message?: string }).message ?? "Could not fetch preview."));
        return null;
      }
      return data as unknown as PreviewData;
    } catch {
      setError("Network error. Please check your internet connection.");
      return null;
    } finally {
      setIsLoadingPreview(false);
    }
  };

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

  const clearError = () => setError(null);

  return {
    fetchPreview,
    fetchVideoInfo,
    getPlayUrl,
    getStreamUrl,
    isLoadingPreview,
    isLoadingInfo,
    error,
    clearError,
  };
}

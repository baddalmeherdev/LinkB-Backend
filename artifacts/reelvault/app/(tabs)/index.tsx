import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinkBLogo } from "@/components/LinkBLogo";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { showRewardedAd, showInterstitialAd } from "@/utils/unityAds";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinkPreviewCard, type PreviewData } from "@/components/LinkPreviewCard";
import { AdBanner } from "@/components/AdBanner";
import { PremiumModal } from "@/components/PremiumModal";
import { QualityRow } from "@/components/QualityRow";
import { VideoInfoSkeleton } from "@/components/SkeletonLoader";
import { VideoCard } from "@/components/VideoCard";
import Colors from "@/constants/colors";
import { useApp, type VideoInfo, type VideoQuality } from "@/context/AppContext";
import { useVideoApi } from "@/hooks/useVideoApi";

const C = Colors.dark;

function isValidUrl(text: string): boolean {
  return text.startsWith("http://") || text.startsWith("https://");
}

function generateCaptions(title: string, platform: string): string {
  const lines = [
    `🎬 ${title}`,
    ``,
    `Watch this amazing video from ${platform}! Don't forget to like and share.`,
    ``,
    `📌 Key Highlights:`,
    `• Engaging content you won't want to miss`,
    `• Perfect for sharing with friends & family`,
    `• Downloaded with LinkB Downloader ⚡`,
  ];
  return lines.join("\n");
}

function generateHashtags(title: string, platform: string): string {
  const words = title
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .split(" ")
    .filter((w) => w.length > 3)
    .slice(0, 5)
    .map((w) => `#${w.charAt(0).toUpperCase()}${w.slice(1).toLowerCase()}`);

  const platformTags: Record<string, string[]> = {
    YouTube: ["#YouTube", "#YouTubeVideo", "#VideoOfTheDay"],
    Instagram: ["#Instagram", "#Reels", "#InstagramReels"],
    TikTok: ["#TikTok", "#TikTokVideo", "#ForYou", "#FYP"],
    Facebook: ["#Facebook", "#FacebookVideo"],
    "X/Twitter": ["#Twitter", "#Trending"],
    Vimeo: ["#Vimeo", "#VideoArt"],
  };

  const platTags = platformTags[platform] ?? ["#Video", "#Trending"];
  const allTags = [...words, ...platTags, "#LinkBDownloader", "#VideoDownloader", "#MustWatch"];
  return [...new Set(allTags)].join(" ");
}

export default function DownloadScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isPremium, addToHistory, unlockPremiumOnce } = useApp();
  const { autoUrl, shareText } = useLocalSearchParams<{ autoUrl?: string; shareText?: string }>();
  const {
    fetchPreview,
    fetchVideoInfo,
    getStreamUrl,
    getPipeUrl,
    getDirectDownloadUrl,
    isLoadingPreview,
    isLoadingInfo,
    isSlowRequest,
    error,
    clearError,
  } = useVideoApi();

  const [url, setUrl] = useState("");
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [downloadedUri, setDownloadedUri] = useState<string | null>(null);
  const [lastDownloadedQuality, setLastDownloadedQuality] = useState<VideoQuality | null>(null);
  const [captionText, setCaptionText] = useState<string | null>(null);
  const [hashtagText, setHashtagText] = useState<string | null>(null);
  const [showCaptions, setShowCaptions] = useState(false);
  const [showHashtags, setShowHashtags] = useState(false);
  const [isPlayModalOpen, setIsPlayModalOpen] = useState(false);
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);
  const [videoPlayerError, setVideoPlayerError] = useState(false);
  const [videoPlayerLoading, setVideoPlayerLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadPhase, setDownloadPhase] = useState<"preparing" | "downloading" | "done" | "">("");
  const [nativeFileUri, setNativeFileUri] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const downloadAbortRef = useRef<AbortController | null>(null);
  const downloadResumableRef = useRef<FileSystem.DownloadResumable | null>(null);
  const inputBorderAnim = useSharedValue(0);

  const downloadCountRef = useRef(0);
  const [adLoading, setAdLoading] = useState(false);
  const adUnlockedForHDRef = useRef(false);

  // Pre-resolved CDN URL cache — populated in background after video info loads.
  // CDN URLs expire ~5 min; we conservatively cache for 4 min.
  const preResolvedRef = useRef<{
    formatId: string;
    directUrl: string;
    filename: string;
    expires: number;
  } | null>(null);

  // Save a downloaded file to the device gallery (media library).
  // Silently no-ops on web or if permission is denied.
  const saveToGallery = async (uri: string, isAudio: boolean): Promise<void> => {
    if (Platform.OS === "web") return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") return;
      const asset = await MediaLibrary.createAssetAsync(uri);
      const albumName = isAudio ? "LinkB Audio" : "LinkB Downloads";
      const album = await MediaLibrary.getAlbumAsync(albumName);
      if (album == null) {
        await MediaLibrary.createAlbumAsync(albumName, asset, false);
      } else {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      }
    } catch (e) {
      console.warn("[Gallery] Could not save to gallery:", e);
    }
  };

  const inputStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(59, 130, 246, ${inputBorderAnim.value})`,
  }));

  const handleFocus = () => { inputBorderAnim.value = withSpring(1); };
  const handleBlur = () => { inputBorderAnim.value = withSpring(0); };

  const resetState = () => {
    setPreviewData(null);
    setVideoInfo(null);
    setDownloadedUri(null);
    setLastDownloadedQuality(null);
    setCaptionText(null);
    setHashtagText(null);
    setShowCaptions(false);
    setShowHashtags(false);
    setIsPlayModalOpen(false);
    setVideoModalUrl(null);
    setVideoPlayerError(false);
    setVideoPlayerLoading(false);
  };

  const handleUrlChange = (text: string) => {
    setUrl(text);
    resetState();
    clearError();

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = text.trim();
    if (isValidUrl(trimmed)) {
      debounceRef.current = setTimeout(async () => {
        // Step 1: Fast preview for instant feedback
        const preview = await fetchPreview(trimmed);
        if (preview) {
          setPreviewData(preview);
          setTimeout(() => scrollRef.current?.scrollTo({ y: 200, animated: true }), 200);
        }
        // Step 2: Auto-fetch formats — no button click needed
        const info = await fetchVideoInfo(trimmed);
        if (info) {
          setVideoInfo(info);
          setTimeout(() => scrollRef.current?.scrollTo({ y: 280, animated: true }), 200);
          // Pre-resolve CDN URL only for premium users (free users go through /stream for watermark)
          preResolvedRef.current = null;
          if (isPremium) {
            const bestQ = info.qualities.find((q) => !q.isAudioOnly && !q.isHD)
              ?? info.qualities.find((q) => !q.isAudioOnly);
            if (bestQ) {
              getDirectDownloadUrl(trimmed, bestQ, info.title, isPremium).then((res) => {
                if (res) {
                  preResolvedRef.current = {
                    formatId: bestQ.formatId,
                    directUrl: res.directUrl,
                    filename: res.filename,
                    expires: Date.now() + 4 * 60 * 1000,
                  };
                }
              }).catch(() => {});
            }
          }
        }
      }, 700);
    }
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (videoLoadTimerRef.current) clearTimeout(videoLoadTimerRef.current);
    };
  }, []);


  // Handle URLs shared to the app via Android intent (ACTION_SEND / deep links)
  useEffect(() => {
    const handleIncomingUrl = (rawUrl: string | null) => {
      if (!rawUrl) return;
      // Direct URL shared (e.g. YouTube link via share sheet)
      if (isValidUrl(rawUrl)) {
        handleUrlChange(rawUrl);
        return;
      }
      // Deep-link URL may carry the target as a query param
      try {
        const parsed = new URL(rawUrl);
        const target =
          parsed.searchParams.get("url") ??
          parsed.searchParams.get("text") ??
          parsed.searchParams.get("shareText");
        if (target && isValidUrl(target)) {
          handleUrlChange(target);
        }
      } catch {}
    };

    // Cold start — app was opened via intent
    Linking.getInitialURL().then(handleIncomingUrl).catch(() => {});

    // Warm start — URL arrives while app is already running
    const subscription = Linking.addEventListener("url", ({ url }) =>
      handleIncomingUrl(url)
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (autoUrl && typeof autoUrl === "string" && isValidUrl(autoUrl)) {
      handleUrlChange(autoUrl);
      return;
    }
    // Handle text shared from PWA share target that may contain a URL
    if (shareText && typeof shareText === "string") {
      const match = shareText.match(/https?:\/\/[^\s]+/);
      if (match && isValidUrl(match[0])) {
        handleUrlChange(match[0]);
      }
    }
  }, [autoUrl, shareText]);

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      handleUrlChange(text);
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleFetch = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed || !isValidUrl(trimmed)) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearError();
    resetState();

    // Step 1: Fast preview for instant feedback
    const preview = await fetchPreview(trimmed);
    if (preview) {
      setPreviewData(preview);
      setTimeout(() => scrollRef.current?.scrollTo({ y: 200, animated: true }), 200);
    }
    // Step 2: Auto-fetch formats
    const info = await fetchVideoInfo(trimmed);
    if (info) {
      setVideoInfo(info);
      setTimeout(() => scrollRef.current?.scrollTo({ y: 280, animated: true }), 200);
      preResolvedRef.current = null;
      // Pre-resolve CDN URL only for premium users (free users use /stream for watermark)
      if (isPremium) {
        const bestQ = info.qualities.find((q) => !q.isAudioOnly && !q.isHD)
          ?? info.qualities.find((q) => !q.isAudioOnly);
        if (bestQ) {
          getDirectDownloadUrl(trimmed, bestQ, info.title, isPremium).then((r) => {
            if (r) {
              preResolvedRef.current = {
                formatId: bestQ.formatId,
                directUrl: r.directUrl,
                filename: r.filename,
                expires: Date.now() + 4 * 60 * 1000,
              };
            }
          }).catch(() => {});
        }
      }
    }
  }, [url, fetchPreview, fetchVideoInfo, clearError, isPremium]);

  const handleCancelDownload = () => {
    downloadAbortRef.current?.abort();
    downloadResumableRef.current?.pauseAsync().catch(() => {});
    setIsDownloading(false);
    setDownloadProgress(0);
    setDownloadPhase("");
  };

  // Auto-dismiss "done" banner after 2.5 seconds
  useEffect(() => {
    if (downloadPhase === "done") {
      const t = setTimeout(() => setDownloadPhase(""), 2500);
      return () => clearTimeout(t);
    }
  }, [downloadPhase]);

  const handleDownload = async (quality: VideoQuality) => {
    if (!videoInfo) return;

    if (quality.isHD && !isPremium && !adUnlockedForHDRef.current) {
      Alert.alert(
        "🎬 Unlock HD/4K — Watch 1 Ad",
        "Watch a short ad to download this video in HD or 4K quality.",
        [
          {
            text: "Watch Ad",
            onPress: async () => {
              const earned = await showRewardedAd();
              if (earned) {
                adUnlockedForHDRef.current = true;
                await handleDownload(quality);
                adUnlockedForHDRef.current = false;
              } else {
                Alert.alert("Ad Skipped", "Watch the full ad to unlock HD/4K download.");
              }
            },
          },
          { text: "Cancel", style: "cancel" },
        ]
      );
      return;
    }

    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const ext = quality.isAudioOnly ? "mp3" : "mp4";
    const safeTitle = videoInfo.title.replace(/[^a-zA-Z0-9 _-]/g, "_").substring(0, 60);
    const fallbackFilename = `${safeTitle}_${quality.quality}.${ext}`;

    setLastDownloadedQuality(quality);
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadPhase("preparing");
    setNativeFileUri(null);

    if (Platform.OS === "web") {
      // ── WEB: stream through /pipe (server proxies CDN, no temp file, no new tab) ──
      try {
        const controller = new AbortController();
        downloadAbortRef.current = controller;

        // Use pre-resolved CDN URL if we have a fresh cache for this quality.
        // This skips yt-dlp entirely → pipe starts instantly instead of 3-8s wait.
        const cached = preResolvedRef.current;
        const cachedUrl =
          cached &&
          cached.formatId === quality.formatId &&
          cached.expires > Date.now()
            ? cached.directUrl
            : undefined;

        const pipeUrl = getPipeUrl(
          videoInfo.originalUrl, quality, videoInfo.title, isPremium, cachedUrl
        );

        setDownloadPhase("downloading");

        let fakeProgress = 0;
        const fakeTimer = setInterval(() => {
          fakeProgress = Math.min(fakeProgress + 0.008, 0.88);
          setDownloadProgress(fakeProgress);
        }, 400);

        const response = await fetch(pipeUrl, { signal: controller.signal });
        if (!response.ok) throw new Error(`Server error: ${response.status}`);

        const contentLength = Number(response.headers.get("content-length")) || 0;
        const reader = response.body!.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          if (contentLength > 0) {
            clearInterval(fakeTimer);
            setDownloadProgress(received / contentLength);
          }
        }

        clearInterval(fakeTimer);
        setDownloadProgress(1);
        setDownloadPhase("done");

        const mimeType = quality.isAudioOnly ? "audio/mpeg" : "video/mp4";
        const blob = new Blob(chunks as BlobPart[], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);

        // Trigger browser download — stays in app, no new tab
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = fallbackFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
        setDownloadedUri(blobUrl);

        await addToHistory({
          title: videoInfo.title,
          thumbnail: videoInfo.thumbnail,
          platform: videoInfo.platform,
          quality: quality.quality,
          url: videoInfo.originalUrl,
          filename: fallbackFilename,
          isAudio: quality.isAudioOnly,
        });
        downloadCountRef.current += 1;
        if (!isPremium && downloadCountRef.current % 3 === 0) {
          showInterstitialAd();
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          Alert.alert("Download failed", "Could not download the video. Please try again.");
        }
        setDownloadPhase("");
      } finally {
        setIsDownloading(false);
        downloadAbortRef.current = null;
      }
    } else {
      // ── NATIVE: download via server ───────────────────────────────────────
      // Free users always use /stream (server merges audio + applies watermark).
      // Premium users may use pre-resolved CDN URL for speed (no server round-trip).
      try {
        let downloadUrl: string;
        let filename: string;

        if (isPremium) {
          const cached = preResolvedRef.current;
          let direct: { directUrl: string; filename: string } | null =
            cached && cached.formatId === quality.formatId && cached.expires > Date.now()
              ? { directUrl: cached.directUrl, filename: cached.filename }
              : null;

          if (!direct) {
            direct = await getDirectDownloadUrl(
              videoInfo.originalUrl, quality, videoInfo.title, isPremium
            );
          }

          downloadUrl = direct?.directUrl
            ?? getStreamUrl(videoInfo.originalUrl, quality, videoInfo.title, isPremium);
          filename = direct?.filename ?? fallbackFilename;
        } else {
          // Free users: always stream through server (watermark + audio merge guaranteed)
          downloadUrl = getStreamUrl(videoInfo.originalUrl, quality, videoInfo.title, isPremium);
          filename = fallbackFilename;
        }

        const destPath = `${FileSystem.documentDirectory}${filename}`;
        const downloadResumable = FileSystem.createDownloadResumable(
          downloadUrl,
          destPath,
          {},
          (progress) => {
            const { totalBytesWritten, totalBytesExpectedToWrite } = progress;
            if (totalBytesExpectedToWrite > 0) {
              setDownloadProgress(totalBytesWritten / totalBytesExpectedToWrite);
            } else {
              setDownloadProgress((p) => Math.min(p + 0.015, 0.88));
            }
            setDownloadPhase("downloading");
          }
        );
        downloadResumableRef.current = downloadResumable;

        setDownloadPhase("downloading");
        const result = await downloadResumable.downloadAsync();
        setDownloadProgress(1);
        setDownloadPhase("done");

        const savedUri = result?.uri ?? null;
        if (savedUri) {
          setNativeFileUri(savedUri);
          setDownloadedUri(savedUri);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await saveToGallery(savedUri, quality.isAudioOnly);
        }

        await addToHistory({
          title: videoInfo.title,
          thumbnail: videoInfo.thumbnail,
          platform: videoInfo.platform,
          quality: quality.quality,
          url: videoInfo.originalUrl,
          filename,
          localUri: savedUri ?? undefined,
          isAudio: quality.isAudioOnly,
        });
        downloadCountRef.current += 1;
        if (!isPremium && downloadCountRef.current % 3 === 0) {
          showInterstitialAd();
        }
      } catch (e: any) {
        if (!String(e).includes("cancel")) {
          // Fallback: stream via server
          try {
            const streamUrl = getStreamUrl(videoInfo.originalUrl, quality, videoInfo.title, isPremium);
            const destPath = `${FileSystem.documentDirectory}${fallbackFilename}`;
            const dlr = FileSystem.createDownloadResumable(
              streamUrl, destPath, {},
              (p) => {
                if (p.totalBytesExpectedToWrite > 0) {
                  setDownloadProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
                } else {
                  setDownloadProgress((prev) => Math.min(prev + 0.015, 0.88));
                }
              }
            );
            downloadResumableRef.current = dlr;
            const result2 = await dlr.downloadAsync();
            setDownloadProgress(1);
            setDownloadPhase("done");
            const savedUri = result2?.uri ?? null;
            if (savedUri) {
              setNativeFileUri(savedUri);
              setDownloadedUri(savedUri);
              await saveToGallery(savedUri, quality.isAudioOnly);
            }
            await addToHistory({
              title: videoInfo.title,
              thumbnail: videoInfo.thumbnail,
              platform: videoInfo.platform,
              quality: quality.quality,
              url: videoInfo.originalUrl,
              filename: fallbackFilename,
              localUri: savedUri ?? undefined,
              isAudio: quality.isAudioOnly,
            });
            downloadCountRef.current += 1;
            if (!isPremium && downloadCountRef.current % 3 === 0) {
              showInterstitialAd();
            }
          } catch {
            setDownloadPhase("");
          }
        } else {
          setDownloadPhase("");
        }
      } finally {
        setIsDownloading(false);
        downloadResumableRef.current = null;
      }
    }
  };

  const handleShare = async () => {
    if (!videoInfo) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Native: share the actual file if downloaded
    if (Platform.OS !== "web") {
      if (nativeFileUri) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(nativeFileUri, {
            mimeType: lastDownloadedQuality?.isAudioOnly ? "audio/mpeg" : "video/mp4",
            dialogTitle: `Share ${videoInfo.title}`,
          });
          return;
        }
      }
      // No file downloaded: share the URL via native share sheet
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await (Sharing as any).shareAsync?.(videoInfo.originalUrl).catch(() =>
          Linking.openURL(videoInfo.originalUrl)
        );
      } else {
        await Linking.openURL(videoInfo.originalUrl);
      }
      return;
    }

    // Web: use Web Share API
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        // Try sharing the downloaded blob if available
        if (downloadedUri?.startsWith("blob:") && lastDownloadedQuality) {
          const response = await fetch(downloadedUri);
          const blob = await response.blob();
          const ext = lastDownloadedQuality.isAudioOnly ? "mp3" : "mp4";
          const safeTitle = videoInfo.title.replace(/[^a-zA-Z0-9 _-]/g, "_").substring(0, 50);
          const file = new File([blob], `${safeTitle}.${ext}`, { type: blob.type });

          if ((navigator as any).canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], title: videoInfo.title });
            return;
          }
        }
        // Fall back to sharing the URL
        await navigator.share({
          title: videoInfo.title,
          text: `Download "${videoInfo.title}" with LinkB Downloader`,
          url: videoInfo.originalUrl,
        });
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          Alert.alert("Share", "Sharing not supported on this browser.");
        }
      }
      return;
    }

    // No Web Share API: copy link to clipboard
    await Clipboard.setStringAsync(videoInfo.originalUrl);
    Alert.alert("Link Copied!", "Video URL copied to clipboard.");
  };

  // One-click download — picks the best accessible quality automatically
  const handleQuickDownload = async () => {
    if (!videoInfo || isDownloading) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Pick best quality: premium → any, free → best non-HD
    const available = videoInfo.qualities.filter(
      (q) => !q.isAudioOnly && (isPremium || !q.isHD)
    );
    if (available.length === 0) {
      setShowPremiumModal(true);
      return;
    }
    // Highest resolution in allowed tier
    const best = available.sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0))[0];
    await handleDownload(best);
  };

  const handleCaption = () => {
    if (!videoInfo) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const caption = generateCaptions(videoInfo.title, videoInfo.platform);
    setCaptionText(caption);
    setShowCaptions(true);
    setShowHashtags(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
  };

  const handleHashtags = () => {
    if (!videoInfo) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const tags = generateHashtags(videoInfo.title, videoInfo.platform);
    setHashtagText(tags);
    setShowHashtags(true);
    setShowCaptions(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
  };

  const handleCopyCaption = async () => {
    if (!captionText) return;
    await Clipboard.setStringAsync(captionText);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Copied!", "Caption copied to clipboard.");
  };

  const handleCopyHashtags = async () => {
    if (!hashtagText) return;
    await Clipboard.setStringAsync(hashtagText);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Copied!", "Hashtags copied to clipboard.");
  };

  const handlePlay = async (videoUrl: string) => {
    if (Platform.OS === "web") {
      // Open modal immediately with loading state, then resolve the direct URL.
      setVideoPlayerError(false);
      setVideoPlayerLoading(true);
      setVideoModalUrl(null);
      setIsPlayModalOpen(true);

      try {
        const BASE = "https://linkb-backend-api.onrender.com";
        const params = new URLSearchParams({ url: videoUrl });
        const controller = new AbortController();
        const playTimeout = setTimeout(() => controller.abort(), 60_000);
        let data: Record<string, unknown> = {};
        try {
          const res = await fetch(`${BASE}/api/video/play?${params.toString()}`, {
            signal: controller.signal,
          });
          clearTimeout(playTimeout);
          const text = await res.text();
          data = JSON.parse(text.trim()) as Record<string, unknown>;
        } catch {
          clearTimeout(playTimeout);
        }

        if (typeof data.playUrl === "string" && data.playUrl.startsWith("http")) {
          setVideoModalUrl(data.playUrl);
        } else {
          setVideoPlayerError(true);
          setVideoPlayerLoading(false);
        }
      } catch {
        setVideoPlayerError(true);
        setVideoPlayerLoading(false);
      }
    } else {
      await WebBrowser.openBrowserAsync(videoUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });
    }
  };

  const closeVideoModal = () => {
    if (videoLoadTimerRef.current) clearTimeout(videoLoadTimerRef.current);
    setIsPlayModalOpen(false);
    setVideoModalUrl(null);
    setVideoPlayerError(false);
    setVideoPlayerLoading(false);
  };

  const handleTrim = () => {
    if (!videoInfo) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!isPremium) {
      Alert.alert(
        "Unlock Trim for Free",
        "Watch a short ad to use the Trim feature.",
        [
          {
            text: "Watch Ad",
            onPress: async () => {
              const earned = await showRewardedAd();
              if (earned) {
                await unlockPremiumOnce();
                router.push({ pathname: "/(tabs)/trim", params: { url: videoInfo.originalUrl } });
              } else {
                Alert.alert("Ad Skipped", "Watch the full ad to unlock the Trim feature.");
              }
            },
          },
          { text: "Cancel", style: "cancel" },
        ]
      );
      return;
    }
    router.push({ pathname: "/(tabs)/trim", params: { url: videoInfo.originalUrl } });
  };

  const topPad = Platform.OS === "web" ? 8 : insets.top;
  const isBusy = isLoadingPreview || isLoadingInfo;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <LinearGradient
        colors={["#0A0A1E", C.background]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.4 }}
      />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <LinkBLogo size={40} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.appName} numberOfLines={1} adjustsFontSizeToFit>LinkB Downloader</Text>
            <Text style={styles.tagline} numberOfLines={1}>Download any video, anywhere</Text>
          </View>
        </View>
        {isPremium ? (
          <View style={styles.premiumBadge}>
            <MaterialCommunityIcons name="crown" size={14} color={C.gold} />
            <Text style={styles.premiumBadgeText}>Premium</Text>
          </View>
        ) : (
          <Pressable style={styles.goPremiumBtn} onPress={() => setShowPremiumModal(true)}>
            <MaterialCommunityIcons name="crown-outline" size={14} color={C.gold} />
            <Text style={styles.goPremiumText}>Go Premium</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 90 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inputSection}>
          <Animated.View style={[styles.inputWrap, inputStyle]}>
            <Feather name="link-2" size={18} color={C.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={url}
              onChangeText={handleUrlChange}
              placeholder="Paste any video URL here..."
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={handleFetch}
              onFocus={handleFocus}
              onBlur={handleBlur}
              selectionColor={C.accent}
            />
            {url.length > 0 ? (
              <Pressable onPress={() => { setUrl(""); resetState(); clearError(); }} style={styles.clearBtn}>
                <Feather name="x-circle" size={16} color={C.textMuted} />
              </Pressable>
            ) : null}
          </Animated.View>

          <View style={styles.inputActions}>
            <Pressable style={styles.pasteBtn} onPress={handlePaste}>
              <Feather name="clipboard" size={14} color={C.textSecondary} />
              <Text style={styles.pasteBtnText}>Paste</Text>
            </Pressable>
            <Pressable
              style={[styles.fetchBtn, (!url.trim() || isBusy) && styles.fetchBtnDisabled]}
              onPress={handleFetch}
              disabled={!url.trim() || isBusy}
            >
              {isBusy ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.fetchBtnText}>
                    {isSlowRequest
                      ? "Waking up…"
                      : isLoadingPreview
                      ? "Previewing…"
                      : "Loading…"}
                  </Text>
                </>
              ) : (
                <>
                  <Feather name="download-cloud" size={16} color="#fff" />
                  <Text style={styles.fetchBtnText}>Download</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        {error ? (
          <Animated.View entering={FadeIn} style={styles.errorBox}>
            <Feather name="alert-circle" size={16} color={C.error} />
            <Text style={styles.errorText}>{error}</Text>
          </Animated.View>
        ) : null}

        {isSlowRequest && isBusy ? (
          <Animated.View entering={FadeIn} style={styles.slowRequestBox}>
            <ActivityIndicator size="small" color={C.accent} />
            <View style={styles.slowRequestText}>
              <Text style={styles.slowRequestTitle}>Waking up server… this might take a minute</Text>
              <Text style={styles.slowRequestSub}>
                The server goes to sleep when idle. First request can take 30–60 seconds. Please wait, it will load!
              </Text>
            </View>
          </Animated.View>
        ) : null}

        {/* Preview skeleton — shown while fetching preview and no data yet */}
        {isLoadingPreview && !previewData && !videoInfo ? (
          <Animated.View entering={FadeIn} style={styles.skeletonWrap}>
            <LinkPreviewCard preview={null} isLoading />
          </Animated.View>
        ) : null}

        {/* Preview card + formats skeleton — shown while preview loaded but formats still loading */}
        {previewData && !videoInfo && isLoadingInfo ? (
          <Animated.View entering={FadeInDown} style={styles.previewSection}>
            <LinkPreviewCard
              preview={previewData}
              isLoading={false}
              onPlay={() => handlePlay(url.trim())}
            />
            <Animated.View entering={FadeIn} style={styles.skeletonWrap}>
              <VideoInfoSkeleton />
            </Animated.View>
          </Animated.View>
        ) : null}

        {/* Preview card — shown after preview loaded if formats fetch not yet started */}
        {previewData && !videoInfo && !isLoadingInfo ? (
          <Animated.View entering={FadeInDown} style={styles.previewSection}>
            <LinkPreviewCard
              preview={previewData}
              isLoading={false}
              onPlay={() => handlePlay(url.trim())}
            />
          </Animated.View>
        ) : null}

        {/* Formats skeleton — shown when fetching info directly with no preview yet */}
        {isLoadingInfo && !previewData && !videoInfo ? (
          <Animated.View entering={FadeIn} style={styles.skeletonWrap}>
            <VideoInfoSkeleton />
          </Animated.View>
        ) : null}

        {videoInfo && !isLoadingInfo ? (
          <Animated.View entering={FadeInDown} style={styles.resultSection}>
            <VideoCard
              info={videoInfo}
              onPlay={() => handlePlay(videoInfo.originalUrl)}
            />

            {/* ⚡ One-click download button */}
            <Pressable
              style={[styles.quickDownloadBtn, isDownloading && styles.quickDownloadBtnBusy]}
              onPress={handleQuickDownload}
              disabled={isDownloading}
            >
              <LinearGradient
                colors={isDownloading ? ["#1a2a3a", "#1a2a3a"] : ["#1D4ED8", "#2563EB", "#3B82F6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.quickDownloadGrad}
              >
                {isDownloading ? (
                  <>
                    <ActivityIndicator size="small" color="#60A5FA" />
                    <Text style={styles.quickDownloadText}>Downloading…</Text>
                  </>
                ) : (
                  <>
                    <Feather name="download" size={20} color="#fff" />
                    <View>
                      <Text style={styles.quickDownloadText}>
                        {isPremium ? "Download Best Quality" : "Download (720p)"}
                      </Text>
                      <Text style={styles.quickDownloadSub}>
                        {isPremium ? "1-click · Full HD / 4K" : "1-click · Free quality"}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.6)" style={{ marginLeft: "auto" }} />
                  </>
                )}
              </LinearGradient>
            </Pressable>

            {/* ── Big Share button shown after download completes ── */}
            {downloadedUri ? (
              <Animated.View entering={FadeInDown} style={styles.shareSuccessWrap}>
                <View style={styles.shareSuccessBanner}>
                  <Feather name="check-circle" size={15} color={C.success} />
                  <Text style={styles.shareSuccessText}>
                    {lastDownloadedQuality?.quality ?? "Video"} downloaded!
                  </Text>
                </View>
                <Pressable
                  style={styles.shareFileBigBtn}
                  onPress={handleShare}
                  android_ripple={{ color: "rgba(255,255,255,0.15)" }}
                >
                  <LinearGradient
                    colors={["#16A34A", "#15803D"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.shareFileBigGrad}
                  >
                    <Feather name="share-2" size={20} color="#fff" />
                    <View>
                      <Text style={styles.shareFileBigText}>Share Downloaded File</Text>
                      <Text style={styles.shareFileBigSub}>Send to friends, WhatsApp, Telegram…</Text>
                    </View>
                    <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.7)" style={{ marginLeft: "auto" }} />
                  </LinearGradient>
                </Pressable>
              </Animated.View>
            ) : null}

            {/* ── Secondary action row ── */}
            <View style={styles.actionRow}>
              {!downloadedUri ? (
                <Pressable style={styles.actionBtn} onPress={handleShare}>
                  <Feather name="share-2" size={15} color={C.accent} />
                  <Text style={styles.actionBtnText}>Share Link</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={styles.actionBtn}
                onPress={async () => {
                  await Clipboard.setStringAsync(videoInfo.originalUrl);
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Alert.alert("Copied!", "Link copied to clipboard.");
                }}
              >
                <Feather name="copy" size={15} color={C.accent} />
                <Text style={styles.actionBtnText}>Copy Link</Text>
              </Pressable>
              <Pressable
                style={styles.actionBtn}
                onPress={() => Linking.openURL(videoInfo.originalUrl)}
              >
                <Feather name="external-link" size={15} color={C.accent} />
                <Text style={styles.actionBtnText}>Open</Text>
              </Pressable>
            </View>

            <View style={styles.toolsSection}>
              <Text style={styles.sectionLabel}>Tools</Text>
              <View style={styles.toolsGrid}>
                <Pressable style={styles.toolCard} onPress={handleCaption}>
                  <View style={[styles.toolIcon, { backgroundColor: "#0D1A2A" }]}>
                    <Feather name="message-square" size={18} color={C.accent} />
                  </View>
                  <Text style={styles.toolTitle}>Caption</Text>
                  <Text style={styles.toolDesc}>Auto-generate</Text>
                </Pressable>

                <Pressable style={styles.toolCard} onPress={handleHashtags}>
                  <View style={[styles.toolIcon, { backgroundColor: "#1A0D2A" }]}>
                    <Feather name="hash" size={18} color="#A78BFA" />
                  </View>
                  <Text style={styles.toolTitle}>Hashtags</Text>
                  <Text style={styles.toolDesc}>One-click</Text>
                </Pressable>

                <Pressable style={styles.toolCard} onPress={handleTrim}>
                  <View style={[styles.toolIcon, { backgroundColor: "#1A1A0D" }]}>
                    <Feather name="scissors" size={18} color={C.gold} />
                  </View>
                  <Text style={styles.toolTitle}>Trim</Text>
                  <Text style={styles.toolDesc}>{isPremium ? "Cut video" : "Premium"}</Text>
                  {!isPremium && (
                    <View style={{ position: "absolute", top: 8, right: 8 }}>
                      <MaterialCommunityIcons name="crown" size={12} color={C.gold} />
                    </View>
                  )}
                </Pressable>
              </View>
            </View>

            {showCaptions && captionText ? (
              <Animated.View entering={FadeInDown} style={styles.outputCard}>
                <View style={styles.outputHeader}>
                  <View style={styles.outputTitleRow}>
                    <Feather name="message-square" size={14} color={C.accent} />
                    <Text style={styles.outputTitle}>Caption</Text>
                  </View>
                  <Pressable style={styles.copyBtn} onPress={handleCopyCaption}>
                    <Feather name="copy" size={14} color={C.accent} />
                    <Text style={styles.copyBtnText}>Copy</Text>
                  </Pressable>
                </View>
                <Text style={styles.outputText}>{captionText}</Text>
              </Animated.View>
            ) : null}

            {showHashtags && hashtagText ? (
              <Animated.View entering={FadeInDown} style={styles.outputCard}>
                <View style={styles.outputHeader}>
                  <View style={styles.outputTitleRow}>
                    <Feather name="hash" size={14} color="#A78BFA" />
                    <Text style={[styles.outputTitle, { color: "#A78BFA" }]}>Hashtags</Text>
                  </View>
                  <Pressable style={[styles.copyBtn, { borderColor: "#A78BFA" }]} onPress={handleCopyHashtags}>
                    <Feather name="copy" size={14} color="#A78BFA" />
                    <Text style={[styles.copyBtnText, { color: "#A78BFA" }]}>Copy</Text>
                  </Pressable>
                </View>
                <Text style={[styles.outputText, { color: "#A78BFA", lineHeight: 28 }]}>{hashtagText}</Text>
              </Animated.View>
            ) : null}

            <View style={styles.qualitiesSection}>
              <Text style={styles.sectionLabel}>Choose Quality</Text>

              {!isPremium ? (
                <Animated.View entering={FadeIn} style={styles.watermarkBanner}>
                  <View style={styles.watermarkLeft}>
                    <MaterialCommunityIcons name="crown-outline" size={16} color={C.gold} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.watermarkTitle}>Free plan: up to 720p with watermark</Text>
                      <Text style={styles.watermarkSub}>Upgrade for 1080p, 4K and watermark-free downloads</Text>
                    </View>
                  </View>
                  <Pressable style={styles.upgradeBtn} onPress={() => setShowPremiumModal(true)}>
                    <MaterialCommunityIcons name="crown" size={12} color="#000" />
                    <Text style={styles.upgradeBtnText}>Upgrade</Text>
                  </Pressable>
                </Animated.View>
              ) : (
                <Animated.View entering={FadeIn} style={styles.cleanBanner}>
                  <Feather name="check-circle" size={14} color={C.success} />
                  <Text style={styles.cleanBannerText}>Premium — full quality, no watermark, all resolutions</Text>
                </Animated.View>
              )}

              <View style={styles.qualitiesList}>
                {videoInfo.qualities.map((q) => (
                  <QualityRow
                    key={q.formatId}
                    quality={q}
                    isPremiumUser={isPremium}
                    onDownload={handleDownload}
                    onRequirePremium={() => setShowPremiumModal(true)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.inlineDisclaimer}>
              <Feather name="shield" size={11} color={C.textMuted} />
              <Text style={styles.inlineDisclaimerText}>
                Use for personal and permitted content only.
              </Text>
            </View>

          </Animated.View>
        ) : null}

        {!previewData && !videoInfo && !isLoadingPreview && !isLoadingInfo ? (
          <Animated.View entering={FadeIn} style={styles.emptyState}>
            <LinearGradient
              colors={["#1A0A3E", "#0A0A1E"]}
              style={styles.emptyIconWrap}
            >
              <Feather name="download-cloud" size={42} color={C.accent} />
            </LinearGradient>
            <Text style={styles.emptyTitle}>Download Any Video, Instantly</Text>
            <Text style={styles.emptySubtitle}>
              Supports 2000+ websites via yt-dlp — YouTube, Instagram, TikTok, Reddit, and much more
            </Text>

            <View style={styles.featuresRow}>
              <View style={styles.featureChip}>
                <Feather name="zap" size={12} color={C.gold} />
                <Text style={styles.featureChipText}>1-click Download</Text>
              </View>
              <View style={styles.featureChip}>
                <Feather name="play-circle" size={12} color={C.success} />
                <Text style={styles.featureChipText}>Preview & Play</Text>
              </View>
              <View style={styles.featureChip}>
                <Feather name="globe" size={12} color={C.accent} />
                <Text style={styles.featureChipText}>2000+ Sites</Text>
              </View>
            </View>

            <View style={styles.supportedPlatforms}>
              {[
                { label: "YouTube", color: "#FF0000" },
                { label: "Instagram", color: "#E1306C" },
                { label: "TikTok", color: "#69C9D0" },
                { label: "Facebook", color: "#1877F2" },
                { label: "Twitter", color: "#1DA1F2" },
                { label: "Reddit", color: "#FF4500" },
                { label: "Vimeo", color: "#1AB7EA" },
                { label: "+ More", color: C.textMuted },
              ].map((p) => (
                <View key={p.label} style={[styles.platformPill, { borderColor: p.color + "40" }]}>
                  <View style={[styles.platformDot, { backgroundColor: p.color }]} />
                  <Text style={[styles.platformPillText, { color: p.color }]}>{p.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.disclaimerBox}>
              <Feather name="shield" size={12} color={C.textMuted} />
              <Text style={styles.disclaimerText}>
                Use for personal and permitted content only. Respect creators and copyright laws.
              </Text>
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>

      {/* Footer branding + banner ad — pinned below scroll content */}
      {!isPremium && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom }]}>
          <Text style={styles.footerCredit}>by @baddalmeher</Text>
          <AdBanner />
        </View>
      )}

      <PremiumModal visible={showPremiumModal} onClose={() => setShowPremiumModal(false)} />

      {/* Download Progress Overlay */}
      {isDownloading || downloadPhase === "done" ? (
        <Animated.View entering={FadeIn} style={styles.downloadOverlay}>
          <View style={styles.downloadOverlayContent}>
            <View style={styles.downloadOverlayLeft}>
              {downloadPhase === "done" ? (
                <View style={styles.downloadDoneIcon}>
                  <Feather name="check-circle" size={20} color={C.success} />
                </View>
              ) : (
                <ActivityIndicator size="small" color={C.accent} />
              )}
              <View style={styles.downloadOverlayText}>
                <Text style={styles.downloadOverlayTitle}>
                  {downloadPhase === "preparing"
                    ? "Preparing download…"
                    : downloadPhase === "downloading"
                    ? `Downloading… ${Math.round(downloadProgress * 100)}%`
                    : "Download complete!"}
                </Text>
                {downloadPhase === "downloading" ? (
                  <View style={styles.downloadProgressBar}>
                    <View style={[styles.downloadProgressFill, { width: `${Math.round(downloadProgress * 100)}%` as any }]} />
                  </View>
                ) : downloadPhase === "done" ? (
                  <Text style={styles.downloadOverlaySub}>
                    {lastDownloadedQuality?.quality ?? ""} · Tap Share to send it
                  </Text>
                ) : null}
              </View>
            </View>
            {isDownloading && (
              <Pressable style={styles.downloadCancelBtn} onPress={handleCancelDownload}>
                <Feather name="x" size={16} color={C.textMuted} />
              </Pressable>
            )}
          </View>
        </Animated.View>
      ) : null}

      {Platform.OS === "web" && isPlayModalOpen ? (
        <Modal
          visible={isPlayModalOpen}
          transparent
          animationType="fade"
          onRequestClose={closeVideoModal}
        >
          <Pressable
            style={styles.videoModalOverlay}
            onPress={closeVideoModal}
          >
            <Pressable style={styles.videoModalContainer} onPress={(e) => e.stopPropagation()}>
              <View style={styles.videoModalHeader}>
                <View style={styles.videoModalTitleRow}>
                  <View style={styles.videoModalDot} />
                  <Text style={styles.videoModalTitle} numberOfLines={1}>
                    {previewData?.title ?? videoInfo?.title ?? "Now Playing"}
                  </Text>
                </View>
                <Pressable
                  onPress={closeVideoModal}
                  style={styles.videoModalClose}
                >
                  <Feather name="x" size={18} color="#fff" />
                </Pressable>
              </View>
              <View style={styles.videoPlayerWrap}>
                {videoPlayerError ? (
                  <View style={styles.videoErrorState}>
                    <Feather name="alert-circle" size={36} color={C.error} />
                    <Text style={styles.videoErrorText}>Preview not available</Text>
                    <Text style={styles.videoErrorSub}>Try downloading the video instead</Text>
                  </View>
                ) : !videoModalUrl ? (
                  <View style={styles.videoLoadingOverlay}>
                    <ActivityIndicator size="large" color={C.accent} />
                    <Text style={styles.videoLoadingText}>Preparing preview…</Text>
                  </View>
                ) : (
                  <>
                    {videoPlayerLoading ? (
                      <View style={styles.videoLoadingOverlay}>
                        <ActivityIndicator size="large" color={C.accent} />
                        <Text style={styles.videoLoadingText}>Loading video…</Text>
                      </View>
                    ) : null}
                    {/* @ts-ignore - web only */}
                    <video
                      src={videoModalUrl}
                      controls
                      autoPlay
                      controlsList="nodownload nofullscreen"
                      disablePictureInPicture
                      onContextMenu={(e: any) => e.preventDefault()}
                      style={{
                        width: "100%", height: "100%", display: "block",
                        backgroundColor: "#000",
                        opacity: videoPlayerLoading ? 0 : 1,
                      }}
                      onCanPlay={() => {
                        setVideoPlayerLoading(false);
                      }}
                      onError={() => {
                        setVideoPlayerError(true);
                        setVideoPlayerLoading(false);
                      }}
                    />
                  </>
                )}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  appName: { color: C.text, fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  tagline: { color: C.textMuted, fontSize: 11, fontFamily: "Inter_400Regular" },
  premiumBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#2A1A00", paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: "#4A3000",
  },
  premiumBadgeText: { color: C.gold, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  goPremiumBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#1A1200", paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: "#3D2A00",
  },
  goPremiumText: { color: C.gold, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4 },
  inputSection: { gap: 10, marginBottom: 16 },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.surfaceElevated, borderRadius: 14,
    borderWidth: 1.5, paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1, color: C.text, fontSize: 14,
    fontFamily: "Inter_400Regular", paddingVertical: 14,
  },
  clearBtn: { padding: 4 },
  inputActions: { flexDirection: "row", gap: 10, flexWrap: "nowrap" },
  pasteBtn: {
    flexShrink: 0,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.surfaceElevated, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1, borderColor: C.surfaceBorder,
  },
  pasteBtnText: { color: C.textSecondary, fontSize: 13, fontFamily: "Inter_500Medium", paddingRight: 2 },
  fetchBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8,
    backgroundColor: C.accent, paddingVertical: 13, borderRadius: 12,
    paddingHorizontal: 16,
  },
  fetchBtnDisabled: { opacity: 0.45 },
  fetchBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold", paddingRight: 2 },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#1A0000", borderRadius: 10, padding: 12,
    marginBottom: 16, borderWidth: 1, borderColor: "#4A0000",
  },
  errorText: { flex: 1, color: C.error, fontSize: 13, fontFamily: "Inter_400Regular" },
  slowRequestBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: "#0D1A2E", borderRadius: 10, padding: 14,
    marginBottom: 16, borderWidth: 1, borderColor: "#1E3A5F",
  },
  slowRequestText: { flex: 1, gap: 3 },
  slowRequestTitle: { color: C.accent, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  slowRequestSub: { color: C.textMuted, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  skeletonWrap: { marginBottom: 16 },
  previewSection: { gap: 12, marginBottom: 4 },
  resultSection: { gap: 16 },
  quickDownloadBtn: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  quickDownloadBtnBusy: {
    shadowOpacity: 0,
    elevation: 0,
  },
  quickDownloadGrad: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 14,
  },
  quickDownloadText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  quickDownloadSub: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: C.surfaceElevated, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1, borderColor: C.surfaceBorder,
  },
  actionBtnText: { color: C.accent, fontSize: 13, fontFamily: "Inter_500Medium" },
  actionBtnSuccess: { borderColor: C.success + "50", backgroundColor: "#0D2A1A" },
  shareSuccessWrap: { gap: 10 },
  shareSuccessBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#0D2A1A", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: "#1A4A2A",
  },
  shareSuccessText: { color: C.success, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  shareFileBigBtn: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#16A34A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  shareFileBigGrad: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 14,
  },
  shareFileBigText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  shareFileBigSub: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  toolsSection: { gap: 10 },
  toolsGrid: { flexDirection: "row", gap: 10 },
  toolCard: {
    flex: 1, backgroundColor: C.surfaceElevated, borderRadius: 14,
    padding: 14, gap: 8, borderWidth: 1, borderColor: C.surfaceBorder, alignItems: "center",
  },
  toolIcon: {
    width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center",
  },
  toolTitle: { color: C.text, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  toolDesc: { color: C.textMuted, fontSize: 11, fontFamily: "Inter_400Regular" },
  outputCard: {
    backgroundColor: C.surfaceElevated, borderRadius: 14,
    padding: 16, gap: 12, borderWidth: 1, borderColor: C.surfaceBorder,
  },
  outputHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  outputTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  outputTitle: { color: C.accent, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  copyBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#0D1A2A", paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: C.accent,
  },
  copyBtnText: { color: C.accent, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  outputText: { color: C.textSecondary, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  sectionLabel: {
    color: C.textSecondary, fontSize: 12, fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8, textTransform: "uppercase",
  },
  watermarkBanner: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#1A1000", borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: "#3D2A00", gap: 10,
  },
  watermarkLeft: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 10,
  },
  watermarkTitle: { color: C.gold, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  watermarkSub: { color: C.textMuted, fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  upgradeBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: C.gold, paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 8,
  },
  upgradeBtnText: { color: "#000", fontSize: 12, fontFamily: "Inter_700Bold" },
  cleanBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#0D2A1A", borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: "#1A4A2A",
  },
  cleanBannerText: { color: C.success, fontSize: 12, fontFamily: "Inter_500Medium" },
  qualitiesSection: { gap: 10 },
  qualitiesList: { gap: 8 },
  emptyState: { alignItems: "center", paddingTop: 40, paddingHorizontal: 4, gap: 12 },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    marginBottom: 4, borderWidth: 1, borderColor: C.accent + "30",
  },
  emptyTitle: { color: C.text, fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptySubtitle: {
    color: C.textSecondary, fontSize: 14, fontFamily: "Inter_400Regular",
    textAlign: "center", lineHeight: 22, maxWidth: 300,
  },
  featuresRow: {
    flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap", justifyContent: "center",
  },
  featureChip: {
    flexShrink: 0,
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: C.surfaceElevated, paddingLeft: 10, paddingRight: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: C.surfaceBorder,
  },
  featureChipText: { color: C.textSecondary, fontSize: 11, fontFamily: "Inter_500Medium" },
  supportedPlatforms: {
    flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap",
    justifyContent: "center", paddingHorizontal: 4,
  },
  platformPill: {
    flexShrink: 0,
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: C.surfaceElevated, paddingLeft: 10, paddingRight: 12, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: C.surfaceBorder,
  },
  platformDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  platformPillText: { color: C.textSecondary, fontSize: 11, fontFamily: "Inter_600SemiBold" },
  disclaimerBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 16,
    backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    maxWidth: 320,
  },
  disclaimerText: {
    flex: 1, color: C.textMuted, fontSize: 11,
    fontFamily: "Inter_400Regular", lineHeight: 16,
  },
  inlineDisclaimer: {
    flexDirection: "row", alignItems: "center", gap: 6,
    justifyContent: "center", paddingVertical: 8,
  },
  inlineDisclaimerText: {
    color: C.textMuted, fontSize: 11, fontFamily: "Inter_400Regular",
  },
  videoModalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.88)",
    alignItems: "center", justifyContent: "center",
    padding: 16,
  },
  videoModalContainer: {
    width: "100%", maxWidth: 860,
    backgroundColor: "#0A0A14",
    borderRadius: 20, overflow: "hidden",
    borderWidth: 1, borderColor: C.accent + "30",
  },
  videoModalHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.surfaceElevated,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: C.surfaceBorder,
  },
  videoModalTitleRow: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8, marginRight: 12,
  },
  videoModalDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: C.error,
  },
  videoModalTitle: {
    flex: 1, color: C.text, fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  videoModalClose: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  videoPlayerWrap: {
    aspectRatio: 16 / 9, backgroundColor: "#000",
    width: "100%",
  },
  videoErrorState: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "#0A0A14",
  },
  videoErrorText: {
    color: C.text, fontSize: 16, fontFamily: "Inter_600SemiBold",
  },
  videoErrorSub: {
    color: C.textMuted, fontSize: 13, fontFamily: "Inter_400Regular",
  },
  videoLoadingOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center", gap: 12,
    backgroundColor: "#000", zIndex: 10,
  },
  videoLoadingText: {
    color: C.textSecondary, fontSize: 13, fontFamily: "Inter_500Medium",
  },
  bottomBar: {
    backgroundColor: C.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.surfaceBorder,
    alignItems: "center",
    paddingTop: 4,
  },
  footerCredit: {
    color: "#888888",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingBottom: 2,
  },
  downloadOverlay: {
    position: "absolute",
    bottom: 90,
    left: 16,
    right: 16,
    backgroundColor: "#1A1A2E",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.3)",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
  },
  downloadOverlayContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  downloadOverlayLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  downloadDoneIcon: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  downloadOverlayText: {
    flex: 1,
    gap: 6,
  },
  downloadOverlayTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  downloadProgressBar: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 2,
    overflow: "hidden",
  },
  downloadProgressFill: {
    height: 4,
    backgroundColor: "#3B82F6",
    borderRadius: 2,
  },
  downloadOverlaySub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  downloadCancelBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
  },
});

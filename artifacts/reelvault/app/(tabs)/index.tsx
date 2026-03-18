import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { AdBanner } from "@/components/AdBanner";
import { LinkPreviewCard, type PreviewData } from "@/components/LinkPreviewCard";
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
    `• Downloaded with LinkDrop ⚡`,
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
  const allTags = [...words, ...platTags, "#LinkDrop", "#VideoDownloader", "#MustWatch"];
  return [...new Set(allTags)].join(" ");
}

export default function DownloadScreen() {
  const insets = useSafeAreaInsets();
  const { isPremium, addToHistory } = useApp();
  const {
    fetchPreview,
    fetchVideoInfo,
    getPlayUrl,
    getStreamUrl,
    isLoadingPreview,
    isLoadingInfo,
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
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);
  const [videoPlayerError, setVideoPlayerError] = useState(false);
  const [videoPlayerLoading, setVideoPlayerLoading] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputBorderAnim = useSharedValue(0);

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
    setVideoModalUrl(null);
  };

  const handleUrlChange = (text: string) => {
    setUrl(text);
    resetState();
    clearError();

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = text.trim();
    if (isValidUrl(trimmed)) {
      debounceRef.current = setTimeout(async () => {
        const preview = await fetchPreview(trimmed);
        if (preview) {
          setPreviewData(preview);
          setTimeout(() => scrollRef.current?.scrollTo({ y: 200, animated: true }), 200);
        }
      }, 700);
    }
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      handleUrlChange(text);
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleGetFormats = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const info = await fetchVideoInfo(trimmed);
    if (info) {
      setVideoInfo(info);
      setTimeout(() => scrollRef.current?.scrollTo({ y: 280, animated: true }), 300);
    }
  }, [url, fetchVideoInfo]);

  const handleFetch = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearError();
    resetState();

    if (isValidUrl(trimmed)) {
      const preview = await fetchPreview(trimmed);
      if (preview) {
        setPreviewData(preview);
        setTimeout(() => scrollRef.current?.scrollTo({ y: 200, animated: true }), 200);
      }
    } else {
      const info = await fetchVideoInfo(trimmed);
      if (info) {
        setVideoInfo(info);
        setTimeout(() => scrollRef.current?.scrollTo({ y: 220, animated: true }), 300);
      }
    }
  }, [url, fetchPreview, fetchVideoInfo, clearError]);

  const handleDownload = async (quality: VideoQuality) => {
    if (!videoInfo) return;

    const isHD = ["720p", "1080p", "2160p"].includes(quality.quality);
    if (isHD && !isPremium) {
      setShowPremiumModal(true);
      return;
    }

    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const streamUrl = getStreamUrl(videoInfo.originalUrl, quality, videoInfo.title, isPremium);
    const ext = quality.isAudioOnly ? "mp3" : "mp4";
    const safeTitle = videoInfo.title.replace(/[^a-zA-Z0-9 _-]/g, "_").substring(0, 60);
    const filename = `${safeTitle}_${quality.quality}.${ext}`;

    await addToHistory({
      title: videoInfo.title,
      thumbnail: videoInfo.thumbnail,
      platform: videoInfo.platform,
      quality: quality.quality,
      url: videoInfo.originalUrl,
      filename,
    });

    setLastDownloadedQuality(quality);

    if (Platform.OS === "web") {
      const a = document.createElement("a");
      a.href = streamUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setDownloadedUri(streamUrl);
    } else {
      await Linking.openURL(streamUrl);
      setDownloadedUri(streamUrl);
    }
  };

  const handleShare = async () => {
    if (!videoInfo) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const quality = lastDownloadedQuality ?? videoInfo.qualities.find(
      (q) => !["720p", "1080p", "2160p"].includes(q.quality) && !q.isAudioOnly
    ) ?? videoInfo.qualities[0];

    if (!quality) return;

    const streamUrl = getStreamUrl(videoInfo.originalUrl, quality, videoInfo.title, isPremium);
    const ext = quality.isAudioOnly ? "mp3" : "mp4";
    const safeTitle = videoInfo.title.replace(/[^a-zA-Z0-9 _-]/g, "_").substring(0, 60);
    const filename = `${safeTitle}_${quality.quality}.${ext}`;

    if (Platform.OS === "web") {
      const a = document.createElement("a");
      a.href = streamUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      await Linking.openURL(streamUrl);
    }
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
      setVideoPlayerError(false);
      setVideoPlayerLoading(true);
      setVideoModalUrl(getPlayUrl(videoUrl));
    } else {
      await WebBrowser.openBrowserAsync(videoUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });
    }
  };

  const handleTrim = () => {
    if (!videoInfo) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "Trim Video",
      "This will open a video trimmer in your browser.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open", onPress: () => Linking.openURL(`https://clideo.com/cut-video`) },
      ]
    );
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
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
        <View>
          <Text style={styles.appName}>LinkDrop</Text>
          <Text style={styles.tagline}>Download any video, anywhere</Text>
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
                  <Feather name="loader" size={16} color="#fff" />
                  <Text style={styles.fetchBtnText}>
                    {isLoadingPreview ? "Previewing..." : "Loading..."}
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

        {(isLoadingPreview && !previewData) ? (
          <Animated.View entering={FadeIn} style={styles.skeletonWrap}>
            <LinkPreviewCard preview={null} isLoading />
          </Animated.View>
        ) : null}

        {previewData && !videoInfo && !isLoadingInfo ? (
          <Animated.View entering={FadeInDown} style={styles.previewSection}>
            <LinkPreviewCard
              preview={previewData}
              isLoading={isLoadingPreview}
              onPlay={() => handlePlay(url.trim())}
            />

            <Pressable
              style={styles.getFormatsBtn}
              onPress={handleGetFormats}
              disabled={isLoadingInfo}
            >
              <Feather name="download-cloud" size={17} color="#fff" />
              <Text style={styles.getFormatsBtnText}>Get Download Options</Text>
              <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </Animated.View>
        ) : null}

        {isLoadingInfo ? (
          <Animated.View entering={FadeIn} style={styles.skeletonWrap}>
            <VideoInfoSkeleton />
          </Animated.View>
        ) : null}

        {videoInfo && !isLoadingInfo ? (
          <Animated.View entering={FadeInDown} style={styles.resultSection}>
            <VideoCard info={videoInfo} />

            <View style={styles.actionRow}>
              <Pressable
                style={styles.actionBtn}
                onPress={handleShare}
              >
                <Feather
                  name="share-2"
                  size={16}
                  color={downloadedUri ? C.success : C.accent}
                />
                <Text style={[styles.actionBtnText, downloadedUri ? { color: C.success } : {}]}>
                  {downloadedUri ? "Share Video" : "Share"}
                </Text>
              </Pressable>
              <Pressable
                style={styles.actionBtn}
                onPress={async () => {
                  await Clipboard.setStringAsync(videoInfo.originalUrl);
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Alert.alert("Copied!", "Link copied to clipboard.");
                }}
              >
                <Feather name="copy" size={16} color={C.accent} />
                <Text style={styles.actionBtnText}>Copy Link</Text>
              </Pressable>
              <Pressable
                style={styles.actionBtn}
                onPress={() => Linking.openURL(videoInfo.originalUrl)}
              >
                <Feather name="external-link" size={16} color={C.accent} />
                <Text style={styles.actionBtnText}>Open</Text>
              </Pressable>
            </View>

            {downloadedUri ? (
              <Animated.View entering={FadeIn} style={styles.downloadedBanner}>
                <Feather name="check-circle" size={16} color={C.success} />
                <Text style={styles.downloadedBannerText}>Video downloaded successfully!</Text>
                <Pressable onPress={handleShare} style={styles.shareNowBtn}>
                  <Text style={styles.shareNowText}>Share</Text>
                </Pressable>
              </Animated.View>
            ) : null}

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
                  <Text style={styles.toolDesc}>Cut video</Text>
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
                    <MaterialCommunityIcons name="watermark" size={16} color={C.gold} />
                    <View>
                      <Text style={styles.watermarkTitle}>Free downloads include a watermark</Text>
                      <Text style={styles.watermarkSub}>Upgrade to get clean, watermark-free videos</Text>
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
                  <Text style={styles.cleanBannerText}>Premium — no watermark on your downloads</Text>
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

            {!isPremium ? (
              <AdBanner onGoPremium={() => setShowPremiumModal(true)} />
            ) : null}
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
              Paste any video link below and download it in seconds
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
                <Text style={styles.featureChipText}>1000+ Sites</Text>
              </View>
            </View>

            <View style={styles.supportedPlatforms}>
              {[
                { label: "YouTube", color: "#FF0000" },
                { label: "Instagram", color: "#E1306C" },
                { label: "TikTok", color: "#69C9D0" },
                { label: "Facebook", color: "#1877F2" },
                { label: "Twitter", color: "#1DA1F2" },
                { label: "Vimeo", color: "#1AB7EA" },
                { label: "+ More", color: C.textMuted },
              ].map((p) => (
                <View key={p.label} style={[styles.platformPill, { borderColor: p.color + "40" }]}>
                  <View style={[styles.platformDot, { backgroundColor: p.color }]} />
                  <Text style={[styles.platformPillText, { color: p.color }]}>{p.label}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>

      <PremiumModal visible={showPremiumModal} onClose={() => setShowPremiumModal(false)} />

      {Platform.OS === "web" && videoModalUrl ? (
        <Modal
          visible={!!videoModalUrl}
          transparent
          animationType="fade"
          onRequestClose={() => { setVideoModalUrl(null); setVideoPlayerError(false); }}
        >
          <Pressable
            style={styles.videoModalOverlay}
            onPress={() => { setVideoModalUrl(null); setVideoPlayerError(false); }}
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
                  onPress={() => { setVideoModalUrl(null); setVideoPlayerError(false); }}
                  style={styles.videoModalClose}
                >
                  <Feather name="x" size={18} color="#fff" />
                </Pressable>
              </View>
              <View style={styles.videoPlayerWrap}>
                {videoPlayerError ? (
                  <View style={styles.videoErrorState}>
                    <Feather name="alert-circle" size={36} color={C.error} />
                    <Text style={styles.videoErrorText}>Could not load video</Text>
                    <Text style={styles.videoErrorSub}>Try downloading it instead</Text>
                  </View>
                ) : (
                  <>
                    {videoPlayerLoading ? (
                      <View style={styles.videoLoadingOverlay}>
                        <ActivityIndicator size="large" color={C.accent} />
                        <Text style={styles.videoLoadingText}>Loading video...</Text>
                      </View>
                    ) : null}
                    {/* @ts-ignore - web only */}
                    <video
                      src={videoModalUrl!}
                      controls
                      autoPlay
                      style={{
                        width: "100%", height: "100%", display: "block",
                        backgroundColor: "#000",
                        opacity: videoPlayerLoading ? 0 : 1,
                      }}
                      onCanPlay={() => setVideoPlayerLoading(false)}
                      onError={() => { setVideoPlayerError(true); setVideoPlayerLoading(false); }}
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
  appName: { color: C.text, fontSize: 26, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  tagline: { color: C.textMuted, fontSize: 12, fontFamily: "Inter_400Regular" },
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
  inputActions: { flexDirection: "row", gap: 10 },
  pasteBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.surfaceElevated, paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1, borderColor: C.surfaceBorder,
  },
  pasteBtnText: { color: C.textSecondary, fontSize: 13, fontFamily: "Inter_500Medium" },
  fetchBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8,
    backgroundColor: C.accent, paddingVertical: 13, borderRadius: 12,
  },
  fetchBtnDisabled: { opacity: 0.45 },
  fetchBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#1A0000", borderRadius: 10, padding: 12,
    marginBottom: 16, borderWidth: 1, borderColor: "#4A0000",
  },
  errorText: { flex: 1, color: C.error, fontSize: 13, fontFamily: "Inter_400Regular" },
  skeletonWrap: { marginBottom: 16 },
  previewSection: { gap: 12, marginBottom: 4 },
  getFormatsBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: C.accent, paddingVertical: 15, borderRadius: 14,
  },
  getFormatsBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold", flex: 1, textAlign: "center", marginLeft: -26 },
  resultSection: { gap: 16 },
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: C.surfaceElevated, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1, borderColor: C.surfaceBorder,
  },
  actionBtnText: { color: C.accent, fontSize: 13, fontFamily: "Inter_500Medium" },
  downloadedBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#0D2A1A", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "#1A4A2A",
  },
  downloadedBannerText: { flex: 1, color: C.success, fontSize: 13, fontFamily: "Inter_500Medium" },
  shareNowBtn: {
    backgroundColor: C.success, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8,
  },
  shareNowText: { color: "#000", fontSize: 12, fontFamily: "Inter_700Bold" },
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
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: C.surfaceElevated, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: C.surfaceBorder,
  },
  featureChipText: { color: C.textSecondary, fontSize: 11, fontFamily: "Inter_500Medium" },
  supportedPlatforms: {
    flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap", justifyContent: "center",
  },
  platformPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: C.surfaceElevated, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: C.surfaceBorder,
  },
  platformDot: { width: 6, height: 6, borderRadius: 3 },
  platformPillText: { color: C.textSecondary, fontSize: 11, fontFamily: "Inter_600SemiBold" },
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
});

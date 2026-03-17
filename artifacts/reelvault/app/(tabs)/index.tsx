import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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
import { PremiumModal } from "@/components/PremiumModal";
import { QualityRow } from "@/components/QualityRow";
import { SkeletonLoader, VideoInfoSkeleton } from "@/components/SkeletonLoader";
import { VideoCard } from "@/components/VideoCard";
import Colors from "@/constants/colors";
import { useApp, type VideoInfo, type VideoQuality } from "@/context/AppContext";
import { useVideoApi } from "@/hooks/useVideoApi";

const C = Colors.dark;

export default function DownloadScreen() {
  const insets = useSafeAreaInsets();
  const { isPremium, addToHistory } = useApp();
  const { fetchVideoInfo, fetchDownloadLink, isLoadingInfo, error, clearError } = useVideoApi();

  const [url, setUrl] = useState("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const inputBorderAnim = useSharedValue(0);

  const inputStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(59, 130, 246, ${inputBorderAnim.value})`,
  }));

  const handleFocus = () => {
    inputBorderAnim.value = withSpring(1);
  };

  const handleBlur = () => {
    inputBorderAnim.value = withSpring(0);
  };

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) setUrl(text);
  };

  const handleFetch = useCallback(async () => {
    if (!url.trim()) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearError();
    setVideoInfo(null);
    setShowPlayer(false);
    const info = await fetchVideoInfo(url.trim());
    if (info) {
      setVideoInfo(info);
      setTimeout(() => scrollRef.current?.scrollTo({ y: 200, animated: true }), 300);
    }
  }, [url, fetchVideoInfo, clearError]);

  const handleDownload = async (quality: VideoQuality) => {
    if (!videoInfo) return;
    const result = await fetchDownloadLink(videoInfo.originalUrl, quality, isPremium);
    if (result) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await addToHistory({
        title: videoInfo.title,
        thumbnail: videoInfo.thumbnail,
        platform: videoInfo.platform,
        quality: quality.quality,
        url: videoInfo.originalUrl,
        filename: result.filename,
      });
      if (Platform.OS === "web") {
        const a = document.createElement("a");
        a.href = result.downloadUrl;
        a.target = "_blank";
        a.download = result.filename;
        a.click();
      } else {
        await Linking.openURL(result.downloadUrl);
      }
    } else {
      const errMsg = error;
      if (errMsg === "PREMIUM_REQUIRED") {
        setShowPremiumModal(true);
      }
    }
  };

  const handleShare = async () => {
    if (!videoInfo) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({ message: videoInfo.originalUrl, url: videoInfo.originalUrl });
    } catch {}
  };

  const handleCopyLink = async () => {
    if (!videoInfo) return;
    await Clipboard.setStringAsync(videoInfo.originalUrl);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Copied!", "Video link copied to clipboard.");
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

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
          <Text style={styles.appName}>ReelVault</Text>
          <Text style={styles.tagline}>Download any video</Text>
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
          {
            paddingBottom: Platform.OS === "web"
              ? 34 + 84
              : insets.bottom + 90,
          },
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
              onChangeText={setUrl}
              placeholder="Paste video URL here..."
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
              <Pressable onPress={() => setUrl("")} style={styles.clearBtn}>
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
              style={[styles.fetchBtn, !url.trim() && styles.fetchBtnDisabled]}
              onPress={handleFetch}
              disabled={!url.trim() || isLoadingInfo}
            >
              {isLoadingInfo ? (
                <Feather name="loader" size={16} color="#000" />
              ) : (
                <>
                  <Feather name="search" size={16} color="#000" />
                  <Text style={styles.fetchBtnText}>Fetch</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        {error && error !== "PREMIUM_REQUIRED" ? (
          <Animated.View entering={FadeIn} style={styles.errorBox}>
            <Feather name="alert-circle" size={16} color={C.error} />
            <Text style={styles.errorText}>{error}</Text>
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
              <Pressable style={styles.actionBtn} onPress={handleShare}>
                <Feather name="share-2" size={16} color={C.accent} />
                <Text style={styles.actionBtnText}>Share</Text>
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={handleCopyLink}>
                <Feather name="copy" size={16} color={C.accent} />
                <Text style={styles.actionBtnText}>Copy Link</Text>
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={() => setShowPlayer(!showPlayer)}>
                <Feather name="play-circle" size={16} color={C.accent} />
                <Text style={styles.actionBtnText}>Preview</Text>
              </Pressable>
            </View>

            {showPlayer && videoInfo.thumbnail ? (
              <Animated.View entering={FadeInDown} style={styles.playerNote}>
                <Feather name="info" size={14} color={C.textSecondary} />
                <Text style={styles.playerNoteText}>
                  Video preview opens in browser for security reasons.
                </Text>
                <Pressable onPress={() => Linking.openURL(videoInfo.originalUrl)}>
                  <Text style={[styles.playerNoteText, { color: C.accent }]}>Open</Text>
                </Pressable>
              </Animated.View>
            ) : null}

            <View style={styles.aiSection}>
              <Text style={styles.sectionLabel}>AI Features</Text>
              <View style={styles.aiRow}>
                <Pressable style={styles.aiBtn} onPress={() => Alert.alert("Captions", "🎙 Auto-detecting speech...\n\n[Demo] This is a placeholder caption generated by AI for the video.")}>
                  <Feather name="message-square" size={15} color={C.accent} />
                  <Text style={styles.aiBtnText}>Caption</Text>
                </Pressable>
                <Pressable style={styles.aiBtn} onPress={() => Alert.alert("Hashtags", "#VideoDownload #Trending #Viral #Content #Share #ReelVault #MustWatch")}>
                  <Feather name="hash" size={15} color={C.accent} />
                  <Text style={styles.aiBtnText}>Hashtags</Text>
                </Pressable>
                <Pressable style={styles.aiBtn} onPress={() => Alert.alert("Trim Video", "Video trimming opens in your browser.\n\nStart: 0:00  End: " + (videoInfo.duration ? `${Math.floor((videoInfo.duration || 0) / 60)}:${String(Math.floor((videoInfo.duration || 0) % 60)).padStart(2,'0')}` : "unknown"), [{ text: "Cancel" }, { text: "Open", onPress: () => Linking.openURL(videoInfo.originalUrl) }])}>
                  <Feather name="scissors" size={15} color={C.accent} />
                  <Text style={styles.aiBtnText}>Trim</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.qualitiesSection}>
              <Text style={styles.sectionLabel}>Download Quality</Text>
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

        {!videoInfo && !isLoadingInfo ? (
          <Animated.View entering={FadeIn} style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Feather name="download-cloud" size={40} color={C.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>Paste a video link</Text>
            <Text style={styles.emptySubtitle}>
              Supports YouTube, Instagram, Facebook, TikTok, Twitter, Vimeo and more
            </Text>
            <View style={styles.supportedPlatforms}>
              {["YT", "IG", "FB", "TT", "TW"].map((p) => (
                <View key={p} style={styles.platformPill}>
                  <Text style={styles.platformPillText}>{p}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>

      <PremiumModal visible={showPremiumModal} onClose={() => setShowPremiumModal(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 8,
  },
  appName: {
    color: C.text,
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  tagline: {
    color: C.textMuted,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#2A1A00",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#4A3000",
  },
  premiumBadgeText: {
    color: C.gold,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  goPremiumBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#1A1200",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#3D2A00",
  },
  goPremiumText: {
    color: C.gold,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  inputSection: {
    gap: 10,
    marginBottom: 16,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: C.text,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    paddingVertical: 14,
  },
  clearBtn: {
    padding: 4,
  },
  inputActions: {
    flexDirection: "row",
    gap: 10,
  },
  pasteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.surfaceElevated,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  pasteBtnText: {
    color: C.textSecondary,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  fetchBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: C.accent,
    paddingVertical: 12,
    borderRadius: 12,
  },
  fetchBtnDisabled: {
    opacity: 0.5,
  },
  fetchBtnText: {
    color: "#000",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1A0000",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#4A0000",
  },
  errorText: {
    flex: 1,
    color: C.error,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  skeletonWrap: {
    marginBottom: 16,
  },
  resultSection: {
    gap: 16,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: C.surfaceElevated,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  actionBtnText: {
    color: C.accent,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  playerNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.surfaceElevated,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  playerNoteText: {
    flex: 1,
    color: C.textSecondary,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  aiSection: {
    gap: 10,
  },
  aiRow: {
    flexDirection: "row",
    gap: 10,
  },
  aiBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: C.surfaceElevated,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  aiBtnText: {
    color: C.text,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  sectionLabel: {
    color: C.textSecondary,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  qualitiesSection: {
    gap: 10,
  },
  qualitiesList: {
    gap: 8,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: C.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  emptyTitle: {
    color: C.text,
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  emptySubtitle: {
    color: C.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 260,
  },
  supportedPlatforms: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  platformPill: {
    backgroundColor: C.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  platformPillText: {
    color: C.textSecondary,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
});

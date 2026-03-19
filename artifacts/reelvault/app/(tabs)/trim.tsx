import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinkBLogo } from "@/components/LinkBLogo";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useApp, type VideoInfo, type VideoQuality } from "@/context/AppContext";
import { useVideoApi } from "@/hooks/useVideoApi";

const C = Colors.dark;

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

function isValidUrl(text: string): boolean {
  return text.startsWith("http://") || text.startsWith("https://");
}

function parseTimeToSeconds(time: string): number {
  const parts = time.trim().split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(parts[0]) || 0;
}

function secondsToTime(secs: number): string {
  const s = Math.floor(secs);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) {
    return `${h}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function isValidTime(t: string): boolean {
  return /^(\d{1,2}:)?\d{1,2}:\d{2}$/.test(t.trim()) || /^\d+$/.test(t.trim());
}

export default function TrimScreen() {
  const insets = useSafeAreaInsets();
  const { isPremium } = useApp();
  const router = useRouter();
  const { url: paramUrl } = useLocalSearchParams<{ url?: string }>();
  const { fetchVideoInfo, isLoadingInfo, isSlowRequest } = useVideoApi();

  const [url, setUrl] = useState(paramUrl ?? "");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<VideoQuality | null>(null);
  const [startTime, setStartTime] = useState("0:00");
  const [endTime, setEndTime] = useState("");
  const [startError, setStartError] = useState("");
  const [endError, setEndError] = useState("");
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimProgress, setTrimProgress] = useState(0);
  const [trimDone, setTrimDone] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const topPad = Platform.OS === "web" ? 8 : insets.top;

  const loadVideo = useCallback(async (u: string) => {
    const info = await fetchVideoInfo(u);
    if (info) {
      setVideoInfo(info);
      setSelectedQuality(info.qualities.find((q) => !q.isAudioOnly) ?? null);
      if (info.duration) setEndTime(secondsToTime(info.duration));
    }
  }, [fetchVideoInfo]);

  useEffect(() => {
    if (paramUrl && isValidUrl(paramUrl)) {
      setUrl(paramUrl);
      loadVideo(paramUrl);
    }
  }, [paramUrl]);

  const handleUrlChange = (text: string) => {
    setUrl(text);
    setVideoInfo(null);
    setSelectedQuality(null);
    setStartTime("0:00");
    setEndTime("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = text.trim();
    if (isValidUrl(trimmed)) {
      debounceRef.current = setTimeout(() => loadVideo(trimmed), 800);
    }
  };

  const validateTimes = (): boolean => {
    let valid = true;
    const startSec = parseTimeToSeconds(startTime);
    const endSec = parseTimeToSeconds(endTime);
    const duration = videoInfo?.duration ?? Infinity;

    if (!isValidTime(startTime)) {
      setStartError("Enter a valid start time (e.g. 0:30)");
      valid = false;
    } else if (startSec < 0) {
      setStartError("Start time cannot be negative");
      valid = false;
    } else {
      setStartError("");
    }

    if (!isValidTime(endTime)) {
      setEndError("Enter a valid end time (e.g. 1:30)");
      valid = false;
    } else if (endSec <= startSec) {
      setEndError("End time must be after start time");
      valid = false;
    } else if (endSec > duration + 1) {
      setEndError("End time exceeds video duration");
      valid = false;
    } else {
      setEndError("");
    }
    return valid;
  };

  const handleTrimDownload = async () => {
    if (!videoInfo || !selectedQuality) return;
    if (!validateTimes()) return;

    const startSec = parseTimeToSeconds(startTime);
    const endSec = parseTimeToSeconds(endTime);

    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsTrimming(true);
    setTrimDone(false);
    setTrimProgress(0);

    const safeTitle = videoInfo.title.replace(/[^a-zA-Z0-9 _-]/g, "_").substring(0, 50);
    const filename = `${safeTitle}_trim_${startTime.replace(/:/g, "-")}_${endTime.replace(/:/g, "-")}.mp4`;

    const params = new URLSearchParams({
      url: videoInfo.originalUrl,
      formatId: selectedQuality.formatId,
      quality: selectedQuality.quality,
      isPremium: "true",
      title: videoInfo.title,
      startTime: String(startSec),
      endTime: String(endSec),
    });

    const trimUrl = `${BASE_URL}/api/video/trim?${params.toString()}`;

    try {
      if (Platform.OS === "web") {
        const controller = new AbortController();
        abortRef.current = controller;

        let fakeProgress = 0;
        const fakeTimer = setInterval(() => {
          fakeProgress = Math.min(fakeProgress + 0.005, 0.90);
          setTrimProgress(fakeProgress);
        }, 500);

        const response = await fetch(trimUrl, { signal: controller.signal });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error((data as any)?.message ?? `Server error ${response.status}`);
        }

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
            setTrimProgress(received / contentLength);
          }
        }
        clearInterval(fakeTimer);
        setTrimProgress(1);

        const blob = new Blob(chunks, { type: "video/mp4" });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);

        setTrimDone(true);
        Alert.alert("Done!", "Trimmed video downloaded successfully.");
      } else {
        let fakeProgress = 0;
        const fakeTimer = setInterval(() => {
          fakeProgress = Math.min(fakeProgress + 0.005, 0.90);
          setTrimProgress(fakeProgress);
        }, 500);

        const destPath = `${FileSystem.documentDirectory}${filename}`;
        const dlr = FileSystem.createDownloadResumable(trimUrl, destPath, {}, (p) => {
          if (p.totalBytesExpectedToWrite > 0) {
            clearInterval(fakeTimer);
            setTrimProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
          }
        });
        const result = await dlr.downloadAsync();
        clearInterval(fakeTimer);
        setTrimProgress(1);

        if (result?.uri) {
          setTrimDone(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert("Done!", `Trimmed video saved to your device.`);
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        Alert.alert("Trim Failed", e?.message ?? "Could not trim the video. Please try again.");
      }
    } finally {
      setIsTrimming(false);
      abortRef.current = null;
    }
  };

  if (!isPremium) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <LinearGradient
          colors={["#1A0A00", C.background]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.4 }}
        />
        <View style={styles.lockedContainer}>
          <View style={styles.lockedIconWrap}>
            <MaterialCommunityIcons name="crown" size={48} color={C.gold} />
          </View>
          <Text style={styles.lockedTitle}>Premium Feature</Text>
          <Text style={styles.lockedSubtitle}>
            Video trimming is available exclusively for Premium users. Upgrade to trim, cut, and download exactly the part you want.
          </Text>
          <View style={styles.lockedPerks}>
            {[
              "Set custom start & end time",
              "Trim any video from 2000+ sites",
              "Download only the clip you need",
              "No watermark on trimmed videos",
            ].map((perk, i) => (
              <View key={i} style={styles.lockedPerkRow}>
                <Feather name="check-circle" size={15} color={C.gold} />
                <Text style={styles.lockedPerkText}>{perk}</Text>
              </View>
            ))}
          </View>
          <Pressable
            style={({ pressed }) => [styles.upgradeBtn, { opacity: pressed ? 0.85 : 1 }]}
            onPress={() => router.push("/(tabs)/premium")}
          >
            <MaterialCommunityIcons name="crown" size={18} color="#000" />
            <Text style={styles.upgradeBtnText}>Upgrade to Premium — ₹29/month</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <LinearGradient
        colors={["#001A0A", C.background]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.4 }}
      />

      <View style={styles.header}>
        <LinkBLogo size={38} />
        <Text style={styles.headerTitle}>Video Trimmer</Text>
        <View style={styles.premiumBadge}>
          <MaterialCommunityIcons name="crown" size={12} color="#000" />
          <Text style={styles.premiumBadgeText}>Premium</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 90 },
        ]}
      >
        <View style={styles.urlSection}>
          <Text style={styles.label}>Video URL</Text>
          <View style={styles.urlInputWrap}>
            <Feather name="link-2" size={16} color={C.textMuted} />
            <TextInput
              style={styles.urlInput}
              value={url}
              onChangeText={handleUrlChange}
              placeholder="Paste any video URL here..."
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              selectionColor={C.accent}
            />
            {url.length > 0 && (
              <Pressable onPress={() => { setUrl(""); setVideoInfo(null); }}>
                <Feather name="x-circle" size={16} color={C.textMuted} />
              </Pressable>
            )}
          </View>
        </View>

        {isLoadingInfo && (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={C.accent} />
            <Text style={styles.loadingText}>
              {isSlowRequest ? "Processing… this may take up to 30s" : "Fetching video info…"}
            </Text>
          </View>
        )}

        {videoInfo && !isLoadingInfo && (
          <>
            <View style={styles.videoCard}>
              {videoInfo.thumbnail ? (
                <Image source={{ uri: videoInfo.thumbnail }} style={styles.thumbnail} resizeMode="cover" />
              ) : (
                <View style={styles.thumbnailPlaceholder}>
                  <Feather name="video" size={28} color={C.textMuted} />
                </View>
              )}
              <View style={styles.videoMeta}>
                <Text style={styles.videoTitle} numberOfLines={2}>{videoInfo.title}</Text>
                <View style={styles.videoMetaRow}>
                  <Feather name="globe" size={11} color={C.textMuted} />
                  <Text style={styles.videoMetaText}>{videoInfo.platform}</Text>
                  {videoInfo.duration != null && (
                    <>
                      <Feather name="clock" size={11} color={C.textMuted} />
                      <Text style={styles.videoMetaText}>{secondsToTime(videoInfo.duration)}</Text>
                    </>
                  )}
                </View>
              </View>
            </View>

            <View style={styles.timeSection}>
              <Text style={styles.sectionTitle}>Trim Range</Text>
              <Text style={styles.sectionHint}>Enter time in M:SS or H:MM:SS format</Text>
              <View style={styles.timeRow}>
                <View style={styles.timeInputGroup}>
                  <Text style={styles.timeLabel}>Start Time</Text>
                  <View style={[styles.timeInputWrap, !!startError && styles.timeInputError]}>
                    <Feather name="play" size={14} color={startError ? C.error : C.success} />
                    <TextInput
                      style={styles.timeInput}
                      value={startTime}
                      onChangeText={(t) => { setStartTime(t); setStartError(""); }}
                      placeholder="0:00"
                      placeholderTextColor={C.textMuted}
                      keyboardType="numbers-and-punctuation"
                      selectionColor={C.accent}
                    />
                  </View>
                  {!!startError && <Text style={styles.timeError}>{startError}</Text>}
                </View>

                <View style={styles.timeSeparator}>
                  <Feather name="arrow-right" size={18} color={C.textMuted} />
                </View>

                <View style={styles.timeInputGroup}>
                  <Text style={styles.timeLabel}>End Time</Text>
                  <View style={[styles.timeInputWrap, !!endError && styles.timeInputError]}>
                    <Feather name="square" size={14} color={endError ? C.error : C.success} />
                    <TextInput
                      style={styles.timeInput}
                      value={endTime}
                      onChangeText={(t) => { setEndTime(t); setEndError(""); }}
                      placeholder={videoInfo.duration ? secondsToTime(videoInfo.duration) : "1:30"}
                      placeholderTextColor={C.textMuted}
                      keyboardType="numbers-and-punctuation"
                      selectionColor={C.accent}
                    />
                  </View>
                  {!!endError && <Text style={styles.timeError}>{endError}</Text>}
                </View>
              </View>

              {videoInfo.duration && !startError && !endError && isValidTime(startTime) && isValidTime(endTime) && (
                <View style={styles.durationPreview}>
                  <Feather name="scissors" size={12} color={C.gold} />
                  <Text style={styles.durationPreviewText}>
                    Clip duration: {secondsToTime(Math.max(0, parseTimeToSeconds(endTime) - parseTimeToSeconds(startTime)))}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.qualitySection}>
              <Text style={styles.sectionTitle}>Quality</Text>
              <View style={styles.qualityList}>
                {videoInfo.qualities.filter((q) => !q.isAudioOnly).map((q) => (
                  <Pressable
                    key={q.formatId}
                    style={[styles.qualityOption, selectedQuality?.formatId === q.formatId && styles.qualityOptionSelected]}
                    onPress={() => setSelectedQuality(q)}
                  >
                    {q.isHD && <MaterialCommunityIcons name="crown" size={11} color={C.gold} style={{ marginRight: 4 }} />}
                    <Text style={[styles.qualityOptionText, selectedQuality?.formatId === q.formatId && styles.qualityOptionTextSelected]}>
                      {q.quality}
                    </Text>
                    {selectedQuality?.formatId === q.formatId && (
                      <Feather name="check" size={13} color={C.accent} style={{ marginLeft: "auto" }} />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>

            {isTrimming && (
              <View style={styles.progressCard}>
                <View style={styles.progressHeader}>
                  <ActivityIndicator color={C.gold} size="small" />
                  <Text style={styles.progressLabel}>Trimming & Downloading…</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${Math.round(trimProgress * 100)}%` }]} />
                </View>
                <Text style={styles.progressPct}>{Math.round(trimProgress * 100)}%</Text>
              </View>
            )}

            {trimDone && !isTrimming && (
              <View style={styles.doneCard}>
                <Feather name="check-circle" size={18} color={C.success} />
                <Text style={styles.doneText}>Trimmed video downloaded successfully!</Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.trimBtn,
                (isTrimming || !selectedQuality) && styles.trimBtnDisabled,
                { opacity: pressed && !isTrimming ? 0.85 : 1 },
              ]}
              onPress={handleTrimDownload}
              disabled={isTrimming || !selectedQuality}
            >
              <Feather name="scissors" size={20} color={isTrimming ? C.textMuted : "#000"} />
              <Text style={[styles.trimBtnText, (isTrimming || !selectedQuality) && styles.trimBtnTextDisabled]}>
                {isTrimming ? "Trimming…" : "Trim & Download"}
              </Text>
            </Pressable>

            <View style={styles.noteCard}>
              <Feather name="info" size={13} color={C.textMuted} />
              <Text style={styles.noteText}>
                Trimming uses server-side processing. Large videos or long clips may take a few minutes.
              </Text>
            </View>
          </>
        )}

        {!videoInfo && !isLoadingInfo && !url && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Feather name="scissors" size={36} color={C.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>Paste a video URL to start</Text>
            <Text style={styles.emptySubtitle}>
              Supports YouTube, Instagram, TikTok, Twitter, and 2000+ more sites.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceBorder,
  },
  headerTitle: {
    flex: 1,
    color: C.text,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.gold,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  premiumBadgeText: {
    color: "#000",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 20,
  },
  urlSection: { gap: 8 },
  label: {
    color: C.textSecondary,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  urlInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.surfaceBorder,
    paddingHorizontal: 14,
  },
  urlInput: {
    flex: 1,
    color: C.text,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    paddingVertical: 14,
  },
  loadingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.surfaceElevated,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  loadingText: {
    color: C.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  videoCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: C.surfaceElevated,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  thumbnail: {
    width: 90,
    height: 60,
    borderRadius: 8,
    backgroundColor: C.surface,
  },
  thumbnailPlaceholder: {
    width: 90,
    height: 60,
    borderRadius: 8,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  videoMeta: { flex: 1, gap: 6 },
  videoTitle: {
    color: C.text,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 18,
  },
  videoMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  videoMetaText: {
    color: C.textMuted,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  timeSection: { gap: 12 },
  sectionTitle: {
    color: C.text,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  sectionHint: {
    color: C.textMuted,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  timeInputGroup: { flex: 1, gap: 6 },
  timeLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  timeInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.surfaceBorder,
    paddingHorizontal: 12,
  },
  timeInputError: {
    borderColor: C.error,
  },
  timeInput: {
    flex: 1,
    color: C.text,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    paddingVertical: 12,
    letterSpacing: 1,
  },
  timeError: {
    color: C.error,
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  timeSeparator: {
    paddingTop: 30,
    alignItems: "center",
  },
  durationPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1A1200",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#3D2E00",
    alignSelf: "flex-start",
  },
  durationPreviewText: {
    color: C.gold,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  qualitySection: { gap: 10 },
  qualityList: { gap: 6 },
  qualityOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.surfaceElevated,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1.5,
    borderColor: C.surfaceBorder,
  },
  qualityOptionSelected: {
    borderColor: C.accent,
    backgroundColor: "#0D1A2A",
  },
  qualityOptionText: {
    color: C.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  qualityOptionTextSelected: {
    color: C.accent,
    fontFamily: "Inter_600SemiBold",
  },
  progressCard: {
    backgroundColor: C.surfaceElevated,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    gap: 10,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  progressLabel: {
    color: C.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  progressBarBg: {
    height: 6,
    backgroundColor: C.surface,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 6,
    backgroundColor: C.gold,
    borderRadius: 3,
  },
  progressPct: {
    color: C.textMuted,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textAlign: "right",
  },
  doneCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#0D2A1A",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1A4A2A",
  },
  doneText: {
    color: C.success,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  trimBtn: {
    backgroundColor: C.gold,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  trimBtnDisabled: {
    backgroundColor: C.surfaceBorder,
  },
  trimBtnText: {
    color: "#000",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  trimBtnTextDisabled: {
    color: C.textMuted,
  },
  noteCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: C.surfaceElevated,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  noteText: {
    flex: 1,
    color: C.textMuted,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
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
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    marginBottom: 8,
  },
  emptyTitle: {
    color: C.text,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  emptySubtitle: {
    color: C.textMuted,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },
  lockedContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 16,
  },
  lockedIconWrap: {
    width: 90,
    height: 90,
    borderRadius: 24,
    backgroundColor: "#2A1A00",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#4A3000",
    marginBottom: 8,
  },
  lockedTitle: {
    color: C.text,
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  lockedSubtitle: {
    color: C.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  lockedPerks: {
    width: "100%",
    gap: 10,
    marginTop: 4,
  },
  lockedPerkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  lockedPerkText: {
    color: C.text,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  upgradeBtn: {
    backgroundColor: C.gold,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    marginTop: 8,
  },
  upgradeBtnText: {
    color: "#000",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
});

import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { PlatformIcon } from "@/components/PlatformIcon";

const C = Colors.dark;

export type PreviewData = {
  title: string;
  thumbnail: string | null;
  duration: number | null;
  uploader: string | null;
  platform: string;
};

type Props = {
  preview: PreviewData | null;
  isLoading: boolean;
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function SkeletonBox({ width, height, style }: { width: number | string; height: number; style?: object }) {
  const opacity = useSharedValue(0.4);
  React.useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, []);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[{ width: width as number, height, borderRadius: 6, backgroundColor: C.surfaceBorder }, animStyle, style]}
    />
  );
}

export function LinkPreviewCard({ preview, isLoading }: Props) {
  if (isLoading && !preview) {
    return (
      <Animated.View entering={FadeIn} style={styles.card}>
        <View style={styles.skeletonThumb}>
          <ActivityIndicator color={C.accent} size="large" />
        </View>
        <View style={styles.skeletonInfo}>
          <SkeletonBox width="90%" height={14} />
          <SkeletonBox width="65%" height={14} style={{ marginTop: 6 }} />
          <View style={styles.skeletonRow}>
            <SkeletonBox width={60} height={10} />
            <SkeletonBox width={80} height={10} />
          </View>
        </View>
      </Animated.View>
    );
  }

  if (!preview) return null;

  const duration = formatDuration(preview.duration);

  return (
    <Animated.View entering={FadeIn} style={styles.card}>
      <View style={styles.thumbContainer}>
        {preview.thumbnail ? (
          <Image source={{ uri: preview.thumbnail }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Feather name="film" size={36} color={C.textMuted} />
          </View>
        )}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.6)"]}
          style={styles.thumbGradient}
        />
        {duration ? (
          <View style={styles.durationBadge}>
            <Feather name="clock" size={10} color="#fff" />
            <Text style={styles.durationText}>{duration}</Text>
          </View>
        ) : null}
        {isLoading && (
          <View style={styles.refreshOverlay}>
            <ActivityIndicator color={C.accent} size="small" />
          </View>
        )}
        <View style={styles.previewLabel}>
          <Feather name="eye" size={10} color={C.accent} />
          <Text style={styles.previewLabelText}>Preview</Text>
        </View>
      </View>

      <View style={styles.info}>
        <View style={styles.platformRow}>
          <PlatformIcon platform={preview.platform} size={12} />
          <Text style={styles.platformText}>{preview.platform}</Text>
          {preview.uploader ? (
            <>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.uploaderText} numberOfLines={1}>
                {preview.uploader}
              </Text>
            </>
          ) : null}
        </View>
        <Text style={styles.title} numberOfLines={3}>
          {preview.title}
        </Text>
        <View style={styles.readyRow}>
          <View style={styles.readyDot} />
          <Text style={styles.readyText}>Ready to download</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surfaceElevated,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.accent + "40",
  },
  thumbContainer: {
    position: "relative",
  },
  thumb: {
    width: "100%",
    height: 180,
    backgroundColor: C.surface,
  },
  thumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  thumbGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  durationBadge: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  durationText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  previewLabel: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: C.accent + "60",
  },
  previewLabelText: {
    color: C.accent,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  refreshOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    padding: 14,
    gap: 6,
  },
  platformRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
  },
  platformText: {
    color: C.textSecondary,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  dot: {
    color: C.textMuted,
    fontSize: 12,
  },
  uploaderText: {
    color: C.textMuted,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  title: {
    color: C.text,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 22,
  },
  readyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  readyDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.success,
  },
  readyText: {
    color: C.success,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  skeletonThumb: {
    height: 180,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  skeletonInfo: {
    padding: 14,
    gap: 8,
  },
  skeletonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
});

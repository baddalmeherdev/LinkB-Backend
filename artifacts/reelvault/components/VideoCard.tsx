import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";
import { PlatformIcon } from "@/components/PlatformIcon";
import type { VideoInfo } from "@/context/AppContext";

const C = Colors.dark;

type Props = {
  info: VideoInfo;
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VideoCard({ info }: Props) {
  const duration = formatDuration(info.duration);

  return (
    <View style={styles.card}>
      <View style={styles.thumbnailContainer}>
        {info.thumbnail ? (
          <Image
            source={{ uri: info.thumbnail }}
            style={styles.thumbnail}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.thumbnail, styles.placeholderThumb]}>
            <Feather name="film" size={40} color={C.textMuted} />
          </View>
        )}
        {duration ? (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{duration}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {info.title}
        </Text>
        <View style={styles.meta}>
          <PlatformIcon platform={info.platform} size={14} />
          <Text style={styles.platform}>{info.platform}</Text>
          {info.uploader ? (
            <>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.uploader} numberOfLines={1}>
                {info.uploader}
              </Text>
            </>
          ) : null}
        </View>
        <Text style={styles.qualityCount}>
          {info.qualities.length} format{info.qualities.length !== 1 ? "s" : ""} available
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surfaceElevated,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  thumbnailContainer: {
    position: "relative",
  },
  thumbnail: {
    width: "100%",
    height: 200,
    backgroundColor: C.surface,
  },
  placeholderThumb: {
    alignItems: "center",
    justifyContent: "center",
  },
  durationBadge: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.8)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  durationText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  info: {
    padding: 14,
    gap: 6,
  },
  title: {
    color: C.text,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 22,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  platform: {
    color: C.textSecondary,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  dot: {
    color: C.textMuted,
    fontSize: 13,
  },
  uploader: {
    color: C.textSecondary,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  qualityCount: {
    color: C.accent,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
});

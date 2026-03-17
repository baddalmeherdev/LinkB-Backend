import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { QualityBadge } from "@/components/QualityBadge";
import type { VideoQuality } from "@/context/AppContext";

const C = Colors.dark;

type Props = {
  quality: VideoQuality;
  isPremiumUser: boolean;
  onDownload: (quality: VideoQuality) => Promise<void>;
  onRequirePremium: () => void;
};

function formatFilesize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function QualityRow({ quality, isPremiumUser, onDownload, onRequirePremium }: Props) {
  const [loading, setLoading] = useState(false);
  const scale = useSharedValue(1);

  const isHD = ["720p", "1080p", "2160p"].includes(quality.quality);
  const locked = isHD && !isPremiumUser;

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = async () => {
    if (locked) {
      onRequirePremium();
      return;
    }
    scale.value = withSpring(0.96, {}, () => {
      scale.value = withSpring(1);
    });
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    await onDownload(quality);
    setLoading(false);
  };

  const icon = quality.isAudioOnly ? (
    <MaterialCommunityIcons name="music-note" size={18} color="#60A5FA" />
  ) : (
    <Feather name="film" size={18} color={C.textSecondary} />
  );

  return (
    <Animated.View style={animStyle}>
      <Pressable
        style={[styles.row, locked && styles.rowLocked]}
        onPress={handlePress}
        disabled={loading}
      >
        <View style={styles.iconWrap}>{icon}</View>
        <View style={styles.info}>
          <Text style={styles.qualityText}>{quality.quality}</Text>
          {quality.resolution !== "audio" ? (
            <Text style={styles.resText}>
              {quality.resolution}
              {quality.filesize ? ` · ${formatFilesize(quality.filesize)}` : ""}
            </Text>
          ) : null}
        </View>
        <QualityBadge
          quality={quality.quality}
          isPremium={isHD}
          userHasPremium={isPremiumUser}
        />
        <View style={styles.downloadBtn}>
          {loading ? (
            <ActivityIndicator size="small" color={C.accent} />
          ) : locked ? (
            <Feather name="lock" size={16} color={C.gold} />
          ) : (
            <Feather name="download" size={16} color={C.accent} />
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surfaceElevated,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  rowLocked: {
    borderColor: "#3D2A00",
    backgroundColor: "#0D0A00",
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    gap: 2,
  },
  qualityText: {
    color: C.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  resText: {
    color: C.textSecondary,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  downloadBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});

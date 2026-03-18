import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";

const C = Colors.dark;

type Props = {
  quality: string;
  isHD: boolean;
  userHasPremium: boolean;
};

function getBadgeConfig(quality: string, isHD: boolean, userHasPremium: boolean) {
  if (quality === "Audio Only") {
    return { bg: "#1E3A5F", text: "#60A5FA", label: "AUDIO" };
  }
  if (isHD && !userHasPremium) {
    return { bg: "#3D2A00", text: C.gold, label: "PRO" };
  }
  const h = parseInt(quality);
  if (h >= 2160) return { bg: "#1A1040", text: "#A78BFA", label: "4K" };
  if (h >= 1440) return { bg: "#0D2040", text: "#60A5FA", label: "2K" };
  if (h >= 1080) return { bg: "#1A2D1A", text: "#4ADE80", label: "FHD" };
  if (h >= 720) return { bg: "#1A2D1A", text: "#4ADE80", label: "HD" };
  return { bg: C.surfaceBorder, text: C.textSecondary, label: quality };
}

export function QualityBadge({ quality, isHD, userHasPremium }: Props) {
  const { bg, text, label } = getBadgeConfig(quality, isHD, userHasPremium);
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 0.5,
  },
});

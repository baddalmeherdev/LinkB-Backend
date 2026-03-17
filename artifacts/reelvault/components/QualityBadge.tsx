import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";

const C = Colors.dark;

type Props = {
  quality: string;
  isPremium: boolean;
  userHasPremium: boolean;
};

export function QualityBadge({ quality, isPremium, userHasPremium }: Props) {
  const isHD = ["720p", "1080p", "2160p"].includes(quality);
  const locked = isHD && !userHasPremium;

  if (quality === "Audio Only") {
    return (
      <View style={[styles.badge, { backgroundColor: "#1E3A5F" }]}>
        <Text style={[styles.badgeText, { color: "#60A5FA" }]}>AUDIO</Text>
      </View>
    );
  }

  if (locked) {
    return (
      <View style={[styles.badge, { backgroundColor: "#3D2A00" }]}>
        <Text style={[styles.badgeText, { color: C.gold }]}>PRO</Text>
      </View>
    );
  }

  if (isHD) {
    return (
      <View style={[styles.badge, { backgroundColor: "#1A2D1A" }]}>
        <Text style={[styles.badgeText, { color: "#4ADE80" }]}>HD</Text>
      </View>
    );
  }

  return (
    <View style={[styles.badge, { backgroundColor: C.surfaceBorder }]}>
      <Text style={[styles.badgeText, { color: C.textSecondary }]}>{quality}</Text>
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

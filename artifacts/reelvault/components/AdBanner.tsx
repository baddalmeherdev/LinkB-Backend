import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";

const C = Colors.dark;

type Props = {
  onGoPremium?: () => void;
};

export function AdBanner({ onGoPremium }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.adLabel}>
        <Text style={styles.adText}>AD</Text>
      </View>
      <View style={styles.content}>
        <Feather name="zap" size={14} color={C.gold} />
        <Text style={styles.message}>Remove ads with Premium</Text>
      </View>
      <Pressable onPress={onGoPremium} style={styles.cta}>
        <Text style={styles.ctaText}>Upgrade</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1200",
    borderRadius: 10,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: "#3D2A00",
  },
  adLabel: {
    backgroundColor: C.surfaceBorder,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adText: {
    color: C.textMuted,
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  message: {
    color: C.textSecondary,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  cta: {
    backgroundColor: C.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  ctaText: {
    color: "#000",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
});

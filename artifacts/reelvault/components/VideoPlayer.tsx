import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const C = Colors.dark;

type Props = {
  uri: string;
  onClose: () => void;
};

export function VideoPlayer({ uri, onClose }: Props) {
  return (
    <View style={styles.container}>
      <Pressable style={styles.openBtn} onPress={() => Linking.openURL(uri)}>
        <Feather name="play-circle" size={24} color="#fff" />
        <Text style={styles.openText}>Open in Player</Text>
      </Pressable>
      <Pressable style={styles.closeBtn} onPress={onClose}>
        <Feather name="x" size={14} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 100,
    backgroundColor: "#000",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  openBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  openText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  closeBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
});

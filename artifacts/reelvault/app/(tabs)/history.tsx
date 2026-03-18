import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeOutLeft } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { PlatformIcon } from "@/components/PlatformIcon";
import { useApp, type DownloadHistoryItem } from "@/context/AppContext";

const C = Colors.dark;

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function HistoryItem({
  item,
  onDelete,
  onRedownload,
}: {
  item: DownloadHistoryItem;
  onDelete: (id: string) => void;
  onRedownload: (item: DownloadHistoryItem) => void;
}) {
  return (
    <Animated.View entering={FadeInDown} exiting={FadeOutLeft} style={styles.itemCard}>
      {item.thumbnail ? (
        <Image source={{ uri: item.thumbnail }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Feather name="film" size={20} color={C.textMuted} />
        </View>
      )}
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.itemMeta}>
          <PlatformIcon platform={item.platform} size={12} />
          <Text style={styles.itemMetaText}>{item.platform}</Text>
          <View style={styles.qualityPill}>
            <Text style={styles.qualityPillText}>{item.quality}</Text>
          </View>
        </View>
        <Text style={styles.itemTime}>{formatRelativeTime(item.downloadedAt)}</Text>
        <View style={styles.itemActions}>
          <Pressable
            style={styles.redownloadBtn}
            onPress={() => onRedownload(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="refresh-cw" size={12} color={C.accent} />
            <Text style={styles.redownloadText}>Re-download</Text>
          </Pressable>
        </View>
      </View>
      <Pressable
        onPress={() => onDelete(item.id)}
        style={styles.deleteBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Feather name="trash-2" size={16} color={C.textMuted} />
      </Pressable>
    </Animated.View>
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { history, removeFromHistory, clearHistory } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleDelete = (id: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    removeFromHistory(id);
  };

  const handleRedownload = (item: DownloadHistoryItem) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/(tabs)/", params: { autoUrl: item.url } });
  };

  const handleClearAll = () => {
    Alert.alert("Clear History", "Remove all download history?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear All",
        style: "destructive",
        onPress: () => {
          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          clearHistory();
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <LinearGradient
        colors={["#0A0A1E", C.background]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.3 }}
      />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
        {history.length > 0 ? (
          <Pressable onPress={handleClearAll} style={styles.clearBtn}>
            <Feather name="trash" size={16} color={C.error} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <HistoryItem item={item} onDelete={handleDelete} onRedownload={handleRedownload} />
        )}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom:
              Platform.OS === "web" ? 34 + 84 : insets.bottom + 90,
          },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!history.length}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Feather name="clock" size={36} color={C.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No downloads yet</Text>
            <Text style={styles.emptySubtitle}>
              Videos you download will appear here
            </Text>
          </View>
        }
      />
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 8,
  },
  headerTitle: {
    color: C.text,
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  clearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1A0000",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#3A0000",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    gap: 10,
  },
  itemCard: {
    flexDirection: "row",
    backgroundColor: C.surfaceElevated,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    alignItems: "center",
  },
  thumb: {
    width: 80,
    height: 70,
    backgroundColor: C.surface,
  },
  thumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  itemInfo: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  itemTitle: {
    color: C.text,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 18,
  },
  itemMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
  },
  itemMetaText: {
    color: C.textSecondary,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  qualityPill: {
    backgroundColor: C.surfaceBorder,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  qualityPillText: {
    color: C.textSecondary,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  itemTime: {
    color: C.textMuted,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  itemActions: {
    flexDirection: "row",
    marginTop: 4,
  },
  redownloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#0D1A2A",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.accent + "50",
  },
  redownloadText: {
    color: C.accent,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  deleteBtn: {
    padding: 16,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: C.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    marginBottom: 4,
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
  },
});

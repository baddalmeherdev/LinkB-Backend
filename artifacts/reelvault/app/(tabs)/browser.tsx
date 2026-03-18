import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useRef, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";

const C = Colors.dark;

const SHORTCUTS = [
  { name: "YouTube", url: "https://m.youtube.com", color: "#FF0000", icon: "play-circle" as const },
  { name: "Instagram", url: "https://www.instagram.com", color: "#E1306C", icon: "instagram" as const },
  { name: "TikTok", url: "https://www.tiktok.com", color: "#69C9D0", icon: "video" as const },
  { name: "Facebook", url: "https://m.facebook.com", color: "#1877F2", icon: "facebook" as const },
  { name: "Twitter/X", url: "https://x.com", color: "#1DA1F2", icon: "twitter" as const },
  { name: "Reddit", url: "https://www.reddit.com", color: "#FF4500", icon: "message-square" as const },
  { name: "Vimeo", url: "https://vimeo.com", color: "#1AB7EA", icon: "film" as const },
  { name: "Dailymotion", url: "https://www.dailymotion.com", color: "#0066DC", icon: "tv" as const },
  { name: "Pinterest", url: "https://www.pinterest.com", color: "#E60023", icon: "image" as const },
  { name: "LinkedIn", url: "https://www.linkedin.com", color: "#0A66C2", icon: "briefcase" as const },
  { name: "Twitch", url: "https://m.twitch.tv", color: "#9146FF", icon: "radio" as const },
  { name: "Snapchat", url: "https://www.snapchat.com", color: "#FFFC00", icon: "camera" as const },
];

function normalizeUrl(text: string): string {
  const t = text.trim();
  if (!t) return "";
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (t.includes(".") && !t.includes(" ")) return `https://${t}`;
  return `https://www.google.com/search?q=${encodeURIComponent(t)}`;
}

export default function BrowserScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [searchText, setSearchText] = useState("");
  const [pasteUrl, setPasteUrl] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [pasteFocused, setPasteFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const openUrl = async (url: string) => {
    if (!url) return;
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        Linking.openURL(url);
      }
    } else {
      try {
        await WebBrowser.openBrowserAsync(url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
          showTitle: true,
          enableBarCollapsing: true,
          toolbarColor: C.surface,
        });
      } catch {
        Linking.openURL(url);
      }
    }
  };

  const handleSearch = () => {
    const url = normalizeUrl(searchText);
    if (!url) return;
    openUrl(url);
  };

  const handleShortcut = (url: string) => openUrl(url);

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text?.trim()) setPasteUrl(text.trim());
  };

  const handleDownload = () => {
    const url = normalizeUrl(pasteUrl);
    if (!url) {
      Alert.alert("Enter a URL", "Paste the video page URL first.");
      return;
    }
    router.push({ pathname: "/(tabs)/", params: { autoUrl: url } });
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <LinearGradient
        colors={["#0A0A1E", C.background]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.35 }}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.delay(30)} style={styles.header}>
          <View style={styles.headerIcon}>
            <Feather name="globe" size={28} color={C.accent} />
          </View>
          <Text style={styles.headerTitle}>Browser</Text>
          <Text style={styles.headerSub}>
            {Platform.OS === "web"
              ? "Open any site and copy the video URL to download"
              : "Search anything — opens in Chrome browser"}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(70)} style={styles.searchBox}>
          <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
            <Feather name="search" size={17} color={searchFocused ? C.accent : C.textMuted} />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onSubmitEditing={handleSearch}
              placeholder="Search Google or enter a website URL..."
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
          <Pressable
            style={[styles.searchGoBtn, !searchText.trim() && { opacity: 0.45 }]}
            onPress={handleSearch}
            disabled={!searchText.trim()}
          >
            <Feather name={Platform.OS === "web" ? "external-link" : "chrome"} size={18} color="#fff" />
            <Text style={styles.searchGoBtnText}>
              {Platform.OS === "web" ? "Open" : "Open in Chrome"}
            </Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(110)} style={styles.shortcutsSection}>
          <Text style={styles.sectionLabel}>Popular Video Sites</Text>
          <View style={styles.sitesGrid}>
            {SHORTCUTS.map((site) => (
              <Pressable
                key={site.name}
                style={styles.siteCard}
                onPress={() => handleShortcut(site.url)}
              >
                <View
                  style={[
                    styles.siteIcon,
                    { backgroundColor: site.color + "1A", borderColor: site.color + "44" },
                  ]}
                >
                  <Feather name={site.icon} size={22} color={site.color} />
                </View>
                <Text style={styles.siteName} numberOfLines={1}>
                  {site.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150)} style={styles.downloadCard}>
          <View style={styles.downloadCardHeader}>
            <Feather name="download-cloud" size={18} color={C.accent} />
            <Text style={styles.downloadCardTitle}>Download a video</Text>
          </View>
          <Text style={styles.downloadCardSub}>
            Browse to a video page, copy its URL, then paste it below
          </Text>
          <View style={[styles.pasteBar, pasteFocused && styles.pasteBarFocused]}>
            <Feather name="link-2" size={14} color={C.textMuted} />
            <TextInput
              style={styles.pasteInput}
              value={pasteUrl}
              onChangeText={setPasteUrl}
              onFocus={() => setPasteFocused(true)}
              onBlur={() => setPasteFocused(false)}
              onSubmitEditing={handleDownload}
              placeholder="Paste video URL here..."
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              clearButtonMode="while-editing"
            />
          </View>
          <View style={styles.downloadActions}>
            <Pressable style={styles.pasteFab} onPress={handlePaste}>
              <Feather name="clipboard" size={15} color={C.textSecondary} />
              <Text style={styles.pasteFabText}>Paste</Text>
            </Pressable>
            <Pressable
              style={[styles.downloadFab, !pasteUrl.trim() && { opacity: 0.4 }]}
              onPress={handleDownload}
              disabled={!pasteUrl.trim()}
            >
              <Feather name="download" size={15} color="#fff" />
              <Text style={styles.downloadFabText}>Download Video</Text>
            </Pressable>
          </View>
        </Animated.View>

        {Platform.OS !== "web" && (
          <Animated.View entering={FadeInDown.delay(190)} style={styles.tipCard}>
            <Feather name="info" size={14} color={C.accent} style={{ marginTop: 1 }} />
            <Text style={styles.tipText}>
              Tapping any site opens it in Chrome. Browse freely, copy the video URL, come back here and paste it above to download.
            </Text>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 120,
    gap: 22,
  },

  header: { alignItems: "center", gap: 8 },
  headerIcon: {
    width: 62,
    height: 62,
    borderRadius: 18,
    backgroundColor: "#0D1A2A",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.accent + "33",
    marginBottom: 2,
  },
  headerTitle: { color: C.text, fontSize: 22, fontFamily: "Inter_700Bold" },
  headerSub: {
    color: C.textSecondary,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 300,
  },

  searchBox: { gap: 10 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.surfaceElevated,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: C.surfaceBorder,
  },
  searchBarFocused: { borderColor: C.accent },
  searchInput: {
    flex: 1,
    color: C.text,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  searchGoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 14,
  },
  searchGoBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },

  shortcutsSection: { gap: 12 },
  sectionLabel: {
    color: C.textSecondary,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  sitesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  siteCard: {
    width: "22%",
    alignItems: "center",
    gap: 7,
    backgroundColor: C.surfaceElevated,
    borderRadius: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  siteIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  siteName: { color: C.textSecondary, fontSize: 9, fontFamily: "Inter_600SemiBold", textAlign: "center" },

  downloadCard: {
    backgroundColor: C.surfaceElevated,
    borderRadius: 18,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  downloadCardHeader: { flexDirection: "row", alignItems: "center", gap: 9 },
  downloadCardTitle: { color: C.text, fontSize: 16, fontFamily: "Inter_700Bold" },
  downloadCardSub: { color: C.textSecondary, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  pasteBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: C.surfaceBorder,
  },
  pasteBarFocused: { borderColor: C.accent },
  pasteInput: { flex: 1, color: C.text, fontSize: 13, fontFamily: "Inter_400Regular" },
  downloadActions: { flexDirection: "row", gap: 10 },
  pasteFab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  pasteFabText: { color: C.textSecondary, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  downloadFab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: C.accent,
    paddingVertical: 12,
    borderRadius: 12,
  },
  downloadFabText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },

  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#0D1A2A",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.accent + "33",
  },
  tipText: {
    flex: 1,
    color: C.textSecondary,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
});

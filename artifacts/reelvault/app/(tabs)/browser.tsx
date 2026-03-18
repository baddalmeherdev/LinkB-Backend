import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
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
} from "react-native";
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
];

function normalizeUrl(text: string): string {
  const t = text.trim();
  if (!t) return "";
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (t.includes(".") && !t.includes(" ")) return `https://${t}`;
  return `https://www.google.com/search?q=${encodeURIComponent(t)}`;
}

// ─── Native-only in-app WebView browser ─────────────────────────────────────

function NativeBrowser() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const webViewRef = useRef<any>(null);

  const [inputText, setInputText] = useState("");
  const [currentUrl, setCurrentUrl] = useState("https://www.google.com");
  const [isLoading, setIsLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  let WebView: any = null;
  try {
    WebView = require("react-native-webview").WebView;
  } catch {
    /* not available */
  }

  const navigate = (url: string) => {
    const resolved = normalizeUrl(url);
    if (!resolved) return;
    setCurrentUrl(resolved);
    setInputText("");
    setIsLoading(true);
    inputRef.current?.blur();
  };

  const handleSubmit = () => {
    navigate(inputText || currentUrl);
  };

  const handleDownloadFromPage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: "/(tabs)/", params: { autoUrl: currentUrl } });
  };

  const displayText = inputFocused ? inputText : (() => {
    try { const u = new URL(currentUrl); return u.hostname; } catch { return currentUrl; }
  })();

  if (!WebView) {
    return (
      <View style={nStyles.errorBox}>
        <Feather name="alert-circle" size={28} color={C.error} />
        <Text style={nStyles.errorText}>WebView not available on this device</Text>
      </View>
    );
  }

  return (
    <View style={nStyles.container}>
      {/* Address bar */}
      <View style={nStyles.navBar}>
        <Pressable
          style={[nStyles.navBtn, !canGoBack && nStyles.navBtnOff]}
          onPress={() => webViewRef.current?.goBack()}
          disabled={!canGoBack}
        >
          <Feather name="chevron-left" size={20} color={canGoBack ? C.text : C.textMuted} />
        </Pressable>
        <Pressable
          style={[nStyles.navBtn, !canGoForward && nStyles.navBtnOff]}
          onPress={() => webViewRef.current?.goForward()}
          disabled={!canGoForward}
        >
          <Feather name="chevron-right" size={20} color={canGoForward ? C.text : C.textMuted} />
        </Pressable>

        <View style={[nStyles.urlBar, inputFocused && nStyles.urlBarFocused]}>
          <Feather name={currentUrl.startsWith("https") ? "lock" : "globe"} size={12} color={C.textMuted} />
          <TextInput
            ref={inputRef}
            style={nStyles.urlInput}
            value={displayText}
            onChangeText={setInputText}
            onFocus={() => { setInputFocused(true); setInputText(currentUrl); }}
            onBlur={() => { setInputFocused(false); setInputText(""); }}
            onSubmitEditing={handleSubmit}
            placeholder="Search or enter URL"
            placeholderTextColor={C.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            selectTextOnFocus
          />
          {isLoading
            ? <ActivityIndicator size="small" color={C.accent} style={{ width: 18 }} />
            : <Pressable onPress={() => { setIsLoading(true); webViewRef.current?.reload(); }} hitSlop={8}>
                <Feather name="refresh-cw" size={14} color={C.textMuted} />
              </Pressable>
          }
        </View>
      </View>

      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={{ uri: currentUrl }}
        style={{ flex: 1 }}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={(e: any) => {
          setIsLoading(false);
          if (e.nativeEvent?.url) setCurrentUrl(e.nativeEvent.url);
        }}
        onNavigationStateChange={(state: any) => {
          setCanGoBack(state.canGoBack ?? false);
          setCanGoForward(state.canGoForward ?? false);
          if (state.url) setCurrentUrl(state.url);
        }}
        allowsBackForwardNavigationGestures
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        userAgent="Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
        startInLoadingState
        renderLoading={() => (
          <View style={nStyles.loadingOverlay}>
            <ActivityIndicator size="large" color={C.accent} />
          </View>
        )}
      />

      {/* Shortcuts row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={nStyles.shortcutsRow}
        contentContainerStyle={nStyles.shortcutsContent}
      >
        {SHORTCUTS.map((s) => (
          <Pressable key={s.name} style={nStyles.shortcutChip} onPress={() => navigate(s.url)}>
            <View style={[nStyles.shortcutDot, { backgroundColor: s.color }]} />
            <Text style={nStyles.shortcutName}>{s.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Download from page button */}
      <View style={[nStyles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        <Pressable style={nStyles.dlBtn} onPress={handleDownloadFromPage}>
          <Feather name="download-cloud" size={17} color="#fff" />
          <Text style={nStyles.dlBtnText}>Download from this page</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Web fallback: shortcut tiles + URL paste ────────────────────────────────

function WebBrowser() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = 67;

  const [searchText, setSearchText] = useState("");
  const [pasteUrl, setPasteUrl] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [pasteFocused, setPasteFocused] = useState(false);

  const openUrl = (url: string) => {
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handleSearch = () => {
    const url = normalizeUrl(searchText);
    if (url) openUrl(url);
  };

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
    <View style={[wStyles.container, { paddingTop: topPad }]}>
      <LinearGradient
        colors={["#0A0A1E", C.background]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.35 }}
      />
      <ScrollView
        contentContainerStyle={[wStyles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={wStyles.header}>
          <View style={wStyles.headerIcon}>
            <Feather name="globe" size={28} color={C.accent} />
          </View>
          <Text style={wStyles.headerTitle}>Browser</Text>
          <Text style={wStyles.headerSub}>
            Open any site below, copy the video URL, then paste it to download
          </Text>
        </View>

        {/* Search / open */}
        <View style={wStyles.searchBox}>
          <View style={[wStyles.searchBar, searchFocused && wStyles.focused]}>
            <Feather name="search" size={16} color={searchFocused ? C.accent : C.textMuted} />
            <TextInput
              style={wStyles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onSubmitEditing={handleSearch}
              placeholder="Search Google or enter website URL..."
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="search"
            />
          </View>
          <Pressable
            style={[wStyles.goBtn, !searchText.trim() && { opacity: 0.4 }]}
            onPress={handleSearch}
            disabled={!searchText.trim()}
          >
            <Feather name="external-link" size={16} color="#fff" />
            <Text style={wStyles.goBtnText}>Open in Browser</Text>
          </Pressable>
        </View>

        {/* Site shortcuts */}
        <View style={wStyles.section}>
          <Text style={wStyles.sectionLabel}>Popular Video Sites</Text>
          <View style={wStyles.grid}>
            {SHORTCUTS.map((s) => (
              <Pressable key={s.name} style={wStyles.siteCard} onPress={() => openUrl(s.url)}>
                <View style={[wStyles.siteIcon, { backgroundColor: s.color + "1A", borderColor: s.color + "44" }]}>
                  <Feather name={s.icon} size={22} color={s.color} />
                </View>
                <Text style={wStyles.siteName} numberOfLines={1}>{s.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Paste & Download card */}
        <View style={wStyles.downloadCard}>
          <View style={wStyles.downloadCardHeader}>
            <Feather name="download-cloud" size={18} color={C.accent} />
            <Text style={wStyles.downloadCardTitle}>Download a video</Text>
          </View>
          <Text style={wStyles.downloadCardSub}>
            Browse to a video page, copy its URL, then paste it below to download
          </Text>
          <View style={[wStyles.pasteBar, pasteFocused && wStyles.focused]}>
            <Feather name="link-2" size={14} color={C.textMuted} />
            <TextInput
              style={wStyles.pasteInput}
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
            />
          </View>
          <View style={wStyles.downloadActions}>
            <Pressable style={wStyles.pasteBtn} onPress={handlePaste}>
              <Feather name="clipboard" size={14} color={C.textSecondary} />
              <Text style={wStyles.pasteBtnText}>Paste</Text>
            </Pressable>
            <Pressable
              style={[wStyles.downloadBtn, !pasteUrl.trim() && { opacity: 0.4 }]}
              onPress={handleDownload}
              disabled={!pasteUrl.trim()}
            >
              <Feather name="download" size={14} color="#fff" />
              <Text style={wStyles.downloadBtnText}>Download Video</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Root export ─────────────────────────────────────────────────────────────

export default function BrowserScreen() {
  if (Platform.OS === "web") {
    return <WebBrowser />;
  }
  return <NativeBrowser />;
}

// ─── Native styles ────────────────────────────────────────────────────────────

const nStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 7,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceBorder,
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: C.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  navBtnOff: { opacity: 0.3 },
  urlBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: C.surfaceElevated,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: C.surfaceBorder,
  },
  urlBarFocused: { borderColor: C.accent },
  urlInput: {
    flex: 1,
    color: C.text,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  shortcutsRow: {
    maxHeight: 44,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.surfaceBorder,
  },
  shortcutsContent: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  shortcutChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  shortcutDot: { width: 8, height: 8, borderRadius: 4 },
  shortcutName: { color: C.textSecondary, fontSize: 11, fontFamily: "Inter_600SemiBold" },
  bottomBar: {
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.surfaceBorder,
  },
  dlBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.accent,
    borderRadius: 13,
    paddingVertical: 13,
  },
  dlBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  errorBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: C.background,
    padding: 30,
  },
  errorText: { color: C.textSecondary, fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});

// ─── Web styles ───────────────────────────────────────────────────────────────

const wStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: 18, paddingTop: 18, gap: 22 },

  header: { alignItems: "center", gap: 8 },
  headerIcon: {
    width: 62, height: 62, borderRadius: 18,
    backgroundColor: "#0D1A2A", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: C.accent + "33", marginBottom: 2,
  },
  headerTitle: { color: C.text, fontSize: 22, fontFamily: "Inter_700Bold" },
  headerSub: {
    color: C.textSecondary, fontSize: 13, fontFamily: "Inter_400Regular",
    textAlign: "center", lineHeight: 20, maxWidth: 300,
  },

  searchBox: { gap: 10 },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.surfaceElevated, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1.5, borderColor: C.surfaceBorder,
  },
  searchInput: { flex: 1, color: C.text, fontSize: 14, fontFamily: "Inter_400Regular" },
  goBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: C.accent, borderRadius: 13, paddingVertical: 13,
  },
  goBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  focused: { borderColor: C.accent },

  section: { gap: 12 },
  sectionLabel: {
    color: C.textSecondary, fontSize: 10, fontFamily: "Inter_600SemiBold",
    letterSpacing: 1, textTransform: "uppercase",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  siteCard: {
    width: "22%", alignItems: "center", gap: 7,
    backgroundColor: C.surfaceElevated, borderRadius: 14,
    paddingVertical: 13, borderWidth: 1, borderColor: C.surfaceBorder,
  },
  siteIcon: {
    width: 46, height: 46, borderRadius: 13,
    alignItems: "center", justifyContent: "center", borderWidth: 1,
  },
  siteName: { color: C.textSecondary, fontSize: 9, fontFamily: "Inter_600SemiBold", textAlign: "center" },

  downloadCard: {
    backgroundColor: C.surfaceElevated, borderRadius: 18,
    padding: 18, gap: 12, borderWidth: 1, borderColor: C.surfaceBorder,
  },
  downloadCardHeader: { flexDirection: "row", alignItems: "center", gap: 9 },
  downloadCardTitle: { color: C.text, fontSize: 16, fontFamily: "Inter_700Bold" },
  downloadCardSub: { color: C.textSecondary, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  pasteBar: {
    flexDirection: "row", alignItems: "center", gap: 9,
    backgroundColor: C.surface, borderRadius: 12,
    paddingHorizontal: 13, paddingVertical: 12,
    borderWidth: 1.5, borderColor: C.surfaceBorder,
  },
  pasteInput: { flex: 1, color: C.text, fontSize: 13, fontFamily: "Inter_400Regular" },
  downloadActions: { flexDirection: "row", gap: 10 },
  pasteBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.surface, paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1, borderColor: C.surfaceBorder,
  },
  pasteBtnText: { color: C.textSecondary, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  downloadBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 7, backgroundColor: C.accent, paddingVertical: 12, borderRadius: 12,
  },
  downloadBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
});

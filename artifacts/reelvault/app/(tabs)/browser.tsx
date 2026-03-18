import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";

const C = Colors.dark;

const HOME_URL = "https://m.youtube.com";

const SHORTCUTS = [
  { name: "YouTube", url: "https://m.youtube.com", color: "#FF0000", icon: "play-circle" as const },
  { name: "Instagram", url: "https://www.instagram.com", color: "#E1306C", icon: "instagram" as const },
  { name: "TikTok", url: "https://www.tiktok.com", color: "#69C9D0", icon: "video" as const },
  { name: "Facebook", url: "https://m.facebook.com", color: "#1877F2", icon: "facebook" as const },
  { name: "Twitter", url: "https://x.com", color: "#1DA1F2", icon: "twitter" as const },
  { name: "Reddit", url: "https://www.reddit.com", color: "#FF4500", icon: "message-square" as const },
  { name: "Vimeo", url: "https://vimeo.com", color: "#1AB7EA", icon: "film" as const },
  { name: "Dailymotion", url: "https://www.dailymotion.com", color: "#0066DC", icon: "tv" as const },
];

function normalizeUrl(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return HOME_URL;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.includes(".") && !trimmed.includes(" ")) return `https://${trimmed}`;
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

function WebBrowserContent() {
  const router = useRouter();
  const [inputUrl, setInputUrl] = useState("");
  const [inputFocused, setInputFocused] = useState(false);

  const handleGo = () => {
    const trimmed = inputUrl.trim();
    if (!trimmed) return;
    const url = normalizeUrl(trimmed);
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      Linking.openURL(url);
    }
  };

  const handleSiteShortcut = (url: string) => {
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      Linking.openURL(url);
    }
  };

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text?.trim()) setInputUrl(text.trim());
  };

  const handleDownload = () => {
    const trimmed = inputUrl.trim();
    if (!trimmed) {
      Alert.alert("Enter a video URL", "Paste the URL of the video you want to download.");
      return;
    }
    const url = normalizeUrl(trimmed);
    router.push({ pathname: "/(tabs)/", params: { autoUrl: url } });
  };

  return (
    <ScrollView
      contentContainerStyle={styles.webContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View entering={FadeInDown.delay(40)} style={styles.webHero}>
        <View style={styles.webHeroIcon}>
          <Feather name="globe" size={30} color={C.accent} />
        </View>
        <Text style={styles.webHeroTitle}>Browser</Text>
        <Text style={styles.webHeroSub}>
          Open any site, copy the video link, then paste and download below
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80)} style={styles.urlBox}>
        <View style={[styles.urlInput, inputFocused && styles.urlInputFocused]}>
          <Feather name="search" size={15} color={C.textMuted} />
          <TextInput
            style={styles.urlTextInput}
            value={inputUrl}
            onChangeText={setInputUrl}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder="Search or paste video URL..."
            placeholderTextColor={C.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={handleGo}
          />
          {inputUrl.length > 0 && (
            <Pressable onPress={() => setInputUrl("")} hitSlop={10}>
              <Feather name="x-circle" size={15} color={C.textMuted} />
            </Pressable>
          )}
        </View>
        <View style={styles.urlActions}>
          <Pressable style={styles.pasteBtn} onPress={handlePaste}>
            <Feather name="clipboard" size={14} color={C.textSecondary} />
            <Text style={styles.pasteBtnText}>Paste URL</Text>
          </Pressable>
          <Pressable style={styles.goBtn} onPress={handleGo} disabled={!inputUrl.trim()}>
            <Feather name="external-link" size={14} color="#fff" />
            <Text style={styles.goBtnText}>Open Site</Text>
          </Pressable>
          <Pressable
            style={[styles.dlBtn, !inputUrl.trim() && { opacity: 0.4 }]}
            onPress={handleDownload}
            disabled={!inputUrl.trim()}
          >
            <Feather name="download-cloud" size={14} color="#fff" />
            <Text style={styles.dlBtnText}>Download</Text>
          </Pressable>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120)} style={styles.shortcutsSection}>
        <Text style={styles.sectionLabel}>Quick Open</Text>
        <View style={styles.sitesGrid}>
          {SHORTCUTS.map((site) => (
            <Pressable
              key={site.name}
              style={styles.siteCard}
              onPress={() => handleSiteShortcut(site.url)}
            >
              <View style={[styles.siteIcon, { backgroundColor: site.color + "22", borderColor: site.color + "55" }]}>
                <Feather name={site.icon} size={22} color={site.color} />
              </View>
              <Text style={styles.siteName}>{site.name}</Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(160)} style={styles.stepsCard}>
        <Text style={styles.stepsTitle}>How to download a video</Text>
        {[
          { n: "1", text: "Tap a site above — it opens in your browser" },
          { n: "2", text: "Find your video and copy its URL from the address bar" },
          { n: "3", text: "Come back here, paste the URL above, and tap Download" },
        ].map((s) => (
          <View key={s.n} style={styles.step}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>{s.n}</Text></View>
            <Text style={styles.stepText}>{s.text}</Text>
          </View>
        ))}
      </Animated.View>
    </ScrollView>
  );
}

export default function BrowserScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [inputUrl, setInputUrl] = useState("");
  const [currentUrl, setCurrentUrl] = useState(HOME_URL);
  const [loading, setLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const webviewRef = useRef<any>(null);

  const handleNavigate = useCallback((target: string) => {
    const url = normalizeUrl(target);
    setCurrentUrl(url);
    setInputUrl(url);
    setShowShortcuts(false);
    setLoading(true);
  }, []);

  const handleSubmit = () => {
    if (inputUrl.trim()) handleNavigate(inputUrl);
  };

  const handleGoBack = () => webviewRef.current?.goBack?.();
  const handleGoForward = () => webviewRef.current?.goForward?.();
  const handleReload = () => webviewRef.current?.reload?.();

  const handleDownloadCurrentPage = () => {
    if (showShortcuts) {
      Alert.alert("No page open", "Open a video page first, then tap Download.");
      return;
    }
    Alert.alert(
      "Download Video",
      `Download from:\n${currentUrl}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Download",
          onPress: () => {
            router.push({ pathname: "/(tabs)/", params: { autoUrl: currentUrl } });
          },
        },
      ]
    );
  };

  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <LinearGradient colors={["#0A0A1E", C.background]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.3 }} />
        <WebBrowserContent />
      </View>
    );
  }

  let WebView: any = null;
  try { WebView = require("react-native-webview").WebView; } catch {}

  if (!WebView) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <LinearGradient colors={["#0A0A1E", C.background]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.3 }} />
        <View style={styles.toolbar}>
          <View style={[styles.urlBarFull, styles.urlBarFocusedNone]}>
            <Feather name="globe" size={14} color={C.textMuted} />
            <TextInput
              style={styles.urlTextInputNative}
              value={inputUrl}
              onChangeText={setInputUrl}
              onSubmitEditing={handleSubmit}
              placeholder="Search or enter URL..."
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              selectTextOnFocus
            />
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.nativeShortcutsContent} showsVerticalScrollIndicator={false}>
          <View style={styles.shortcutsSection}>
            <Text style={styles.sectionLabel}>Popular Sites</Text>
            <View style={styles.sitesGrid}>
              {SHORTCUTS.map((site) => (
                <Pressable key={site.name} style={styles.siteCard} onPress={() => Linking.openURL(site.url)}>
                  <View style={[styles.siteIcon, { backgroundColor: site.color + "22", borderColor: site.color + "55" }]}>
                    <Feather name={site.icon} size={22} color={site.color} />
                  </View>
                  <Text style={styles.siteName}>{site.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.stepsCard}>
            <Text style={styles.stepsTitle}>How to download a video</Text>
            {[
              { n: "1", text: "Tap a site to open it" },
              { n: "2", text: "Copy the video page URL" },
              { n: "3", text: "Go to Download tab and paste the URL" },
            ].map((s) => (
              <View key={s.n} style={styles.step}>
                <View style={styles.stepNum}><Text style={styles.stepNumText}>{s.n}</Text></View>
                <Text style={styles.stepText}>{s.text}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <LinearGradient colors={["#0A0A1E", C.background]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.3 }} />

      <View style={styles.toolbar}>
        <Pressable style={styles.navBtn} onPress={() => setShowShortcuts((v) => !v)}>
          <Feather name={showShortcuts ? "x" : "grid"} size={16} color={C.textSecondary} />
        </Pressable>
        <Pressable style={[styles.navBtn, !canGoBack && styles.navBtnOff]} onPress={handleGoBack} disabled={!canGoBack || showShortcuts}>
          <Feather name="arrow-left" size={17} color={canGoBack && !showShortcuts ? C.text : C.textMuted} />
        </Pressable>
        <Pressable style={[styles.navBtn, !canGoForward && styles.navBtnOff]} onPress={handleGoForward} disabled={!canGoForward || showShortcuts}>
          <Feather name="arrow-right" size={17} color={canGoForward && !showShortcuts ? C.text : C.textMuted} />
        </Pressable>
        <Pressable style={styles.navBtn} onPress={handleReload} disabled={showShortcuts}>
          <Feather name="refresh-cw" size={15} color={showShortcuts ? C.textMuted : C.textSecondary} />
        </Pressable>
        <View style={[styles.urlBarFull, inputFocused && styles.urlBarActive]}>
          <Feather name="globe" size={13} color={C.textMuted} />
          <TextInput
            style={styles.urlTextInputNative}
            value={inputFocused ? inputUrl : (showShortcuts ? "" : currentUrl)}
            onChangeText={setInputUrl}
            onFocus={() => { setInputFocused(true); setInputUrl(showShortcuts ? "" : currentUrl); }}
            onBlur={() => setInputFocused(false)}
            onSubmitEditing={handleSubmit}
            placeholder="Search or enter URL..."
            placeholderTextColor={C.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            selectTextOnFocus
          />
          {loading && !showShortcuts && <ActivityIndicator size="small" color={C.accent} />}
        </View>
      </View>

      {showShortcuts ? (
        <ScrollView contentContainerStyle={styles.nativeShortcutsContent} showsVerticalScrollIndicator={false}>
          <View style={styles.shortcutsSection}>
            <Text style={styles.sectionLabel}>Popular Sites</Text>
            <View style={styles.sitesGrid}>
              {SHORTCUTS.map((site) => (
                <Pressable key={site.name} style={styles.siteCard} onPress={() => handleNavigate(site.url)}>
                  <View style={[styles.siteIcon, { backgroundColor: site.color + "22", borderColor: site.color + "55" }]}>
                    <Feather name={site.icon} size={22} color={site.color} />
                  </View>
                  <Text style={styles.siteName}>{site.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      ) : (
        <WebView
          ref={webviewRef}
          source={{ uri: currentUrl }}
          style={styles.webview}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={(s: any) => {
            setCanGoBack(s.canGoBack);
            setCanGoForward(s.canGoForward);
            if (s.url && !inputFocused) {
              setCurrentUrl(s.url);
              setInputUrl(s.url);
            }
          }}
          allowsBackForwardNavigationGestures
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.webviewLoader}>
              <ActivityIndicator size="large" color={C.accent} />
            </View>
          )}
        />
      )}

      <Pressable
        style={[styles.downloadBar, { paddingBottom: Math.max(insets.bottom, 14) }]}
        onPress={handleDownloadCurrentPage}
      >
        <Feather name="download-cloud" size={16} color="#fff" />
        <Text style={styles.downloadBarText}>Download video from this page</Text>
        <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.6)" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 5,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceBorder,
    backgroundColor: C.surface,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: C.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  navBtnOff: { opacity: 0.3 },
  urlBarFull: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: C.surfaceElevated,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: C.surfaceBorder,
  },
  urlBarFocusedNone: {},
  urlBarActive: { borderColor: C.accent },
  urlTextInputNative: {
    flex: 1,
    color: C.text,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },

  webview: { flex: 1 },
  webviewLoader: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.background,
  },

  downloadBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.accent,
    paddingVertical: 13,
    paddingHorizontal: 20,
  },
  downloadBarText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    flex: 1,
    textAlign: "center",
  },

  nativeShortcutsContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
    gap: 20,
  },

  webContent: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 120,
    gap: 22,
  },

  webHero: { alignItems: "center", gap: 10 },
  webHeroIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "#0D1A2A",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.accent + "44",
    marginBottom: 4,
  },
  webHeroTitle: { color: C.text, fontSize: 22, fontFamily: "Inter_700Bold" },
  webHeroSub: {
    color: C.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 320,
  },

  urlBox: { gap: 10 },
  urlInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: C.surfaceElevated,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: C.surfaceBorder,
  },
  urlInputFocused: { borderColor: C.accent },
  urlTextInput: {
    flex: 1,
    color: C.text,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  urlActions: { flexDirection: "row", gap: 8 },
  pasteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  pasteBtnText: { color: C.textSecondary, fontSize: 12, fontFamily: "Inter_500Medium" },
  goBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#1A3050",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#2A5080",
  },
  goBtnText: { color: "#60A5FA", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  dlBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: C.accent,
    paddingVertical: 11,
    borderRadius: 11,
  },
  dlBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },

  shortcutsSection: { gap: 12 },
  sectionLabel: {
    color: C.textSecondary,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  sitesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  siteCard: {
    width: "22%",
    alignItems: "center",
    gap: 7,
    backgroundColor: C.surfaceElevated,
    borderRadius: 14,
    paddingVertical: 14,
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
  siteName: {
    color: C.textSecondary,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },

  stepsCard: {
    backgroundColor: C.surfaceElevated,
    borderRadius: 16,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  stepsTitle: { color: C.text, fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  step: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#2A1800",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumText: { color: "#F59E0B", fontSize: 11, fontFamily: "Inter_700Bold" },
  stepText: { flex: 1, color: C.textSecondary, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
});

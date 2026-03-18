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
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";

const C = Colors.dark;

const SITES = [
  { name: "YouTube", url: "https://m.youtube.com", color: "#FF0000", icon: "play-circle" as const },
  { name: "Instagram", url: "https://www.instagram.com", color: "#E1306C", icon: "instagram" as const },
  { name: "TikTok", url: "https://www.tiktok.com", color: "#69C9D0", icon: "video" as const },
  { name: "Facebook", url: "https://m.facebook.com", color: "#1877F2", icon: "facebook" as const },
  { name: "Twitter/X", url: "https://x.com", color: "#1DA1F2", icon: "twitter" as const },
  { name: "Reddit", url: "https://www.reddit.com", color: "#FF4500", icon: "message-square" as const },
  { name: "Vimeo", url: "https://vimeo.com", color: "#1AB7EA", icon: "film" as const },
  { name: "Daily­motion", url: "https://www.dailymotion.com", color: "#0066DC", icon: "tv" as const },
];

function normalizeUrl(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.includes(".") && !trimmed.includes(" ")) return `https://${trimmed}`;
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

function WebBrowserContent() {
  const router = useRouter();
  const [inputUrl, setInputUrl] = useState("");
  const [inputFocused, setInputFocused] = useState(false);

  const handleOpenSite = async (url: string) => {
    await Linking.openURL(url);
  };

  const handleGoToUrl = () => {
    const target = normalizeUrl(inputUrl);
    if (!target) return;
    Linking.openURL(target);
  };

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) setInputUrl(text);
  };

  const handleSendToDownloader = () => {
    const trimmed = inputUrl.trim();
    if (!trimmed) {
      Alert.alert("Enter a URL", "Paste or type the video page URL first.");
      return;
    }
    const target = normalizeUrl(trimmed);
    router.push({ pathname: "/(tabs)/", params: { autoUrl: target } });
  };

  return (
    <ScrollView
      contentContainerStyle={styles.webContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View entering={FadeInDown.delay(50)} style={styles.webHero}>
        <View style={styles.webHeroIcon}>
          <Feather name="globe" size={32} color={C.accent} />
        </View>
        <Text style={styles.webHeroTitle}>Video Browser</Text>
        <Text style={styles.webHeroSub}>
          Tap a site below to browse, then copy the video URL and paste it here to download
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100)} style={styles.urlSection}>
        <View style={[styles.urlBar, inputFocused && styles.urlBarFocused]}>
          <Feather name="link-2" size={14} color={C.textMuted} />
          <TextInput
            style={styles.urlInput}
            value={inputUrl}
            onChangeText={setInputUrl}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder="Paste video URL here..."
            placeholderTextColor={C.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={handleSendToDownloader}
          />
          {inputUrl.length > 0 && (
            <Pressable onPress={() => setInputUrl("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x-circle" size={16} color={C.textMuted} />
            </Pressable>
          )}
        </View>
        <View style={styles.urlActions}>
          <Pressable style={styles.pasteBtn} onPress={handlePaste}>
            <Feather name="clipboard" size={14} color={C.textSecondary} />
            <Text style={styles.pasteBtnText}>Paste URL</Text>
          </Pressable>
          <Pressable
            style={[styles.downloadBtn, !inputUrl.trim() && styles.downloadBtnDisabled]}
            onPress={handleSendToDownloader}
            disabled={!inputUrl.trim()}
          >
            <Feather name="download-cloud" size={14} color="#fff" />
            <Text style={styles.downloadBtnText}>Download Video</Text>
          </Pressable>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150)} style={styles.sitesSection}>
        <Text style={styles.sectionLabel}>Open a site to browse videos</Text>
        <View style={styles.sitesGrid}>
          {SITES.map((site) => (
            <Pressable
              key={site.name}
              style={styles.siteCard}
              onPress={() => handleOpenSite(site.url)}
            >
              <View style={[styles.siteIcon, { backgroundColor: site.color + "20", borderColor: site.color + "40" }]}>
                <Feather name={site.icon} size={20} color={site.color} />
              </View>
              <Text style={styles.siteName} numberOfLines={1}>{site.name}</Text>
              <Feather name="external-link" size={10} color={C.textMuted} />
            </Pressable>
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200)} style={styles.helpCard}>
        <View style={styles.helpRow}>
          <View style={styles.helpStep}>
            <View style={styles.helpNum}><Text style={styles.helpNumText}>1</Text></View>
            <Text style={styles.helpText}>Tap a site above to open it in your browser</Text>
          </View>
          <View style={styles.helpConnector} />
          <View style={styles.helpStep}>
            <View style={[styles.helpNum, { backgroundColor: "#1A1A3A" }]}><Text style={[styles.helpNumText, { color: C.accent }]}>2</Text></View>
            <Text style={styles.helpText}>Find your video and copy its URL</Text>
          </View>
          <View style={styles.helpConnector} />
          <View style={styles.helpStep}>
            <View style={[styles.helpNum, { backgroundColor: "#0D2A1A" }]}><Text style={[styles.helpNumText, { color: "#4ADE80" }]}>3</Text></View>
            <Text style={styles.helpText}>Paste the URL above and tap Download</Text>
          </View>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

export default function BrowserScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [inputUrl, setInputUrl] = useState("");
  const [currentUrl, setCurrentUrl] = useState("https://m.youtube.com");
  const [loading, setLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [showStartPage, setShowStartPage] = useState(true);

  const webviewRef = useRef<any>(null);

  const handleNavigate = useCallback((urlText?: string) => {
    const raw = urlText ?? inputUrl;
    if (!raw.trim()) return;
    const target = normalizeUrl(raw);
    setCurrentUrl(target);
    setInputUrl(target);
    setShowStartPage(false);
    setLoading(true);
  }, [inputUrl]);

  const handleGoBack = () => {
    if (webviewRef.current?.goBack) webviewRef.current.goBack();
  };

  const handleGoForward = () => {
    if (webviewRef.current?.goForward) webviewRef.current.goForward();
  };

  const handleReload = () => {
    if (webviewRef.current?.reload) webviewRef.current.reload();
  };

  const handleHome = () => {
    setShowStartPage(true);
    setInputUrl("");
  };

  const handleDownloadCurrentPage = () => {
    const url = showStartPage ? "" : currentUrl;
    if (!url) {
      Alert.alert("No page open", "Open a video page first, then tap Download.");
      return;
    }
    Alert.alert(
      "Download Video",
      `Send this page to the downloader?\n\n${url}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Download",
          onPress: () => {
            router.push({ pathname: "/(tabs)/", params: { autoUrl: url } });
          },
        },
      ]
    );
  };

  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <LinearGradient
          colors={["#0A0A1E", C.background]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.3 }}
        />
        <WebBrowserContent />
      </View>
    );
  }

  let WebView: any = null;
  try {
    WebView = require("react-native-webview").WebView;
  } catch {}

  if (!WebView) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <LinearGradient
          colors={["#0A0A1E", C.background]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.3 }}
        />
        <WebBrowserContent />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <LinearGradient
        colors={["#0A0A1E", C.background]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.3 }}
      />
      <View style={styles.toolbar}>
        <Pressable style={styles.navBtn} onPress={handleHome}>
          <Feather name="home" size={16} color={C.textSecondary} />
        </Pressable>
        <Pressable
          style={[styles.navBtn, (!canGoBack || showStartPage) && styles.navBtnDisabled]}
          onPress={handleGoBack}
          disabled={!canGoBack || showStartPage}
        >
          <Feather name="arrow-left" size={18} color={(!canGoBack || showStartPage) ? C.textMuted : C.text} />
        </Pressable>
        <Pressable
          style={[styles.navBtn, (!canGoForward || showStartPage) && styles.navBtnDisabled]}
          onPress={handleGoForward}
          disabled={!canGoForward || showStartPage}
        >
          <Feather name="arrow-right" size={18} color={(!canGoForward || showStartPage) ? C.textMuted : C.text} />
        </Pressable>
        <Pressable
          style={[styles.navBtn, showStartPage && styles.navBtnDisabled]}
          onPress={handleReload}
          disabled={showStartPage}
        >
          <Feather name="refresh-cw" size={16} color={showStartPage ? C.textMuted : C.textSecondary} />
        </Pressable>
        <View style={[styles.urlBar, inputFocused && styles.urlBarFocused]}>
          <Feather name="globe" size={14} color={C.textMuted} />
          <TextInput
            style={styles.urlInput}
            value={inputFocused ? inputUrl : (showStartPage ? "" : currentUrl)}
            onChangeText={setInputUrl}
            onFocus={() => { setInputFocused(true); setInputUrl(showStartPage ? "" : currentUrl); }}
            onBlur={() => setInputFocused(false)}
            onSubmitEditing={() => handleNavigate()}
            placeholder="Search or enter URL..."
            placeholderTextColor={C.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            selectTextOnFocus
          />
          {loading && !showStartPage && <ActivityIndicator size="small" color={C.accent} style={{ marginRight: 4 }} />}
        </View>
      </View>

      {showStartPage ? (
        <ScrollView contentContainerStyle={styles.nativeStartContent} showsVerticalScrollIndicator={false}>
          <View style={styles.webHero}>
            <View style={styles.webHeroIcon}>
              <Feather name="globe" size={32} color={C.accent} />
            </View>
            <Text style={styles.webHeroTitle}>Video Browser</Text>
            <Text style={styles.webHeroSub}>Browse any site and download videos with one tap</Text>
          </View>
          <Text style={styles.sectionLabel}>Popular video sites</Text>
          <View style={styles.sitesGrid}>
            {SITES.map((site) => (
              <Pressable
                key={site.name}
                style={styles.siteCard}
                onPress={() => handleNavigate(site.url)}
              >
                <View style={[styles.siteIcon, { backgroundColor: site.color + "20", borderColor: site.color + "40" }]}>
                  <Feather name={site.icon} size={20} color={site.color} />
                </View>
                <Text style={styles.siteName} numberOfLines={1}>{site.name}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : (
        <WebView
          ref={webviewRef}
          source={{ uri: currentUrl }}
          style={styles.webview}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={(navState: any) => {
            setCanGoBack(navState.canGoBack);
            setCanGoForward(navState.canGoForward);
            if (navState.url && !inputFocused) {
              setCurrentUrl(navState.url);
              setInputUrl(navState.url);
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
        style={[styles.downloadBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 14 }]}
        onPress={handleDownloadCurrentPage}
      >
        <Feather name="download-cloud" size={16} color="#fff" />
        <Text style={styles.downloadBarText}>Download video from this page</Text>
        <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.7)" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
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
  navBtnDisabled: { opacity: 0.35 },
  urlBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.surfaceElevated,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
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

  webContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 120,
    gap: 24,
  },
  nativeStartContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 120,
    gap: 20,
  },

  webHero: {
    alignItems: "center",
    gap: 10,
  },
  webHeroIcon: {
    width: 70,
    height: 70,
    borderRadius: 20,
    backgroundColor: "#0D1A2A",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.accent + "40",
    marginBottom: 4,
  },
  webHeroTitle: {
    color: C.text,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  webHeroSub: {
    color: C.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 300,
  },

  urlSection: { gap: 10 },
  urlBar2: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.surfaceElevated,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: C.surfaceBorder,
  },
  urlActions: { flexDirection: "row", gap: 10 },
  pasteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.surfaceElevated,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  pasteBtnText: { color: C.textSecondary, fontSize: 13, fontFamily: "Inter_500Medium" },
  downloadBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: C.accent,
    paddingVertical: 12,
    borderRadius: 12,
  },
  downloadBtnDisabled: { opacity: 0.4 },
  downloadBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },

  sectionLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  sitesSection: { gap: 12 },
  sitesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  siteCard: {
    width: "22%",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.surfaceElevated,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  siteIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
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

  helpCard: {
    backgroundColor: C.surfaceElevated,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  helpRow: { gap: 14 },
  helpStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  helpNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#2A1A00",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  helpNumText: { color: "#F59E0B", fontSize: 12, fontFamily: "Inter_700Bold" },
  helpText: {
    flex: 1,
    color: C.textSecondary,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  helpConnector: {
    width: 1,
    height: 12,
    backgroundColor: C.surfaceBorder,
    marginLeft: 12,
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
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  downloadBarText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    flex: 1,
    textAlign: "center",
  },
  iframeWrap: { flex: 1, backgroundColor: "#fff" },
});

import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useRouter } from "expo-router";

const C = Colors.dark;

const HOME_URL = "https://www.google.com";

function normalizeUrl(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return HOME_URL;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.includes(".") && !trimmed.includes(" ")) return `https://${trimmed}`;
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
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

  const webviewRef = useRef<any>(null);

  const handleNavigate = useCallback((urlText?: string) => {
    const target = normalizeUrl(urlText ?? inputUrl);
    setCurrentUrl(target);
    setInputUrl(target);
    setLoading(true);
    if (webviewRef.current?.injectJavaScript) {
      webviewRef.current.injectJavaScript(`window.location.href = ${JSON.stringify(target)};`);
    }
  }, [inputUrl]);

  const handleGoBack = () => {
    if (webviewRef.current?.goBack) webviewRef.current.goBack();
  };

  const handleGoForward = () => {
    if (webviewRef.current?.goForward) webviewRef.current.goForward();
  };

  const handleReload = () => {
    if (webviewRef.current?.reload) webviewRef.current.reload();
    else {
      setLoading(true);
      const tmp = currentUrl;
      setCurrentUrl("");
      setTimeout(() => setCurrentUrl(tmp), 50);
    }
  };

  const handleDownloadCurrentPage = () => {
    if (!currentUrl || currentUrl === HOME_URL) {
      Alert.alert("No video detected", "Navigate to a page with a video, then tap Download.");
      return;
    }
    Alert.alert(
      "Download Video",
      `Send this page to the downloader?\n\n${currentUrl}`,
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
        <LinearGradient
          colors={["#0A0A1E", C.background]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.3 }}
        />
        <View style={styles.toolbar}>
          <Pressable
            style={[styles.navBtn, !canGoBack && styles.navBtnDisabled]}
            onPress={handleGoBack}
            disabled={!canGoBack}
          >
            <Feather name="arrow-left" size={18} color={canGoBack ? C.text : C.textMuted} />
          </Pressable>
          <Pressable
            style={[styles.navBtn, !canGoForward && styles.navBtnDisabled]}
            onPress={handleGoForward}
            disabled={!canGoForward}
          >
            <Feather name="arrow-right" size={18} color={canGoForward ? C.text : C.textMuted} />
          </Pressable>
          <Pressable style={styles.navBtn} onPress={handleReload}>
            <Feather name="refresh-cw" size={16} color={C.textSecondary} />
          </Pressable>
          <View style={[styles.urlBar, inputFocused && styles.urlBarFocused]}>
            <Feather name="globe" size={14} color={C.textMuted} />
            <TextInput
              style={styles.urlInput}
              value={inputFocused ? inputUrl : currentUrl}
              onChangeText={setInputUrl}
              onFocus={() => { setInputFocused(true); setInputUrl(currentUrl); }}
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
            {loading && <ActivityIndicator size="small" color={C.accent} style={{ marginRight: 4 }} />}
          </View>
        </View>

        <View style={styles.iframeWrap}>
          {/* @ts-ignore */}
          <iframe
            src={currentUrl}
            style={{ width: "100%", height: "100%", border: "none", backgroundColor: "#fff" }}
            onLoad={() => setLoading(false)}
            title="in-app-browser"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
          />
        </View>

        <Pressable style={styles.downloadBar} onPress={handleDownloadCurrentPage}>
          <Feather name="download-cloud" size={16} color="#fff" />
          <Text style={styles.downloadBarText}>Download video from this page</Text>
          <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.7)" />
        </Pressable>
      </View>
    );
  }

  let WebView: any = null;
  try {
    WebView = require("react-native-webview").WebView;
  } catch {}

  if (!WebView) {
    return (
      <View style={[styles.container, styles.centeredFallback, { paddingTop: topPad }]}>
        <LinearGradient
          colors={["#0A0A1E", C.background]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.3 }}
        />
        <Feather name="globe" size={48} color={C.textMuted} />
        <Text style={styles.fallbackTitle}>Browser Unavailable</Text>
        <Text style={styles.fallbackText}>
          The in-app browser requires a development build.{"\n"}
          Paste any video URL in the Download tab.
        </Text>
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
        <Pressable
          style={[styles.navBtn, !canGoBack && styles.navBtnDisabled]}
          onPress={handleGoBack}
          disabled={!canGoBack}
        >
          <Feather name="arrow-left" size={18} color={canGoBack ? C.text : C.textMuted} />
        </Pressable>
        <Pressable
          style={[styles.navBtn, !canGoForward && styles.navBtnDisabled]}
          onPress={handleGoForward}
          disabled={!canGoForward}
        >
          <Feather name="arrow-right" size={18} color={canGoForward ? C.text : C.textMuted} />
        </Pressable>
        <Pressable style={styles.navBtn} onPress={handleReload}>
          <Feather name="refresh-cw" size={16} color={C.textSecondary} />
        </Pressable>
        <View style={[styles.urlBar, inputFocused && styles.urlBarFocused]}>
          <Feather name="globe" size={14} color={C.textMuted} />
          <TextInput
            style={styles.urlInput}
            value={inputFocused ? inputUrl : currentUrl}
            onChangeText={setInputUrl}
            onFocus={() => { setInputFocused(true); setInputUrl(currentUrl); }}
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
          {loading && <ActivityIndicator size="small" color={C.accent} style={{ marginRight: 4 }} />}
        </View>
      </View>

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

      <Pressable
        style={[styles.downloadBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}
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
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceBorder,
    backgroundColor: C.surface,
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: C.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  navBtnDisabled: {
    opacity: 0.35,
  },
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
  urlBarFocused: {
    borderColor: C.accent,
  },
  urlInput: {
    flex: 1,
    color: C.text,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  iframeWrap: {
    flex: 1,
    backgroundColor: "#fff",
  },
  webview: {
    flex: 1,
  },
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
    paddingBottom: 14,
  },
  downloadBarText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    flex: 1,
    textAlign: "center",
  },
  centeredFallback: {
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 40,
  },
  fallbackTitle: {
    color: C.text,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  fallbackText: {
    color: C.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
});

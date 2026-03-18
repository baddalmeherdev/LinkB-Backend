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
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";

const C = Colors.dark;

const HOME_URL = "https://www.google.com";

function normalizeUrl(text: string): string {
  const t = text.trim();
  if (!t) return HOME_URL;
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (t.includes(".") && !t.includes(" ")) return `https://${t}`;
  return `https://www.google.com/search?q=${encodeURIComponent(t)}`;
}

function displayUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname !== "/" ? u.pathname : "");
  } catch {
    return url;
  }
}

export default function BrowserScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [inputText, setInputText] = useState("");
  const [currentUrl, setCurrentUrl] = useState(HOME_URL);
  const [isLoading, setIsLoading] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  const webViewRef = useRef<any>(null);
  const inputRef = useRef<TextInput>(null);
  const iframeRef = useRef<any>(null);

  const navigate = (url: string) => {
    const resolved = normalizeUrl(url);
    setCurrentUrl(resolved);
    setInputText("");
    setIsLoading(true);
    if (Platform.OS !== "web" && webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.location.href = ${JSON.stringify(resolved)}`);
    }
  };

  const handleSubmit = () => {
    const resolved = normalizeUrl(inputText || currentUrl);
    navigate(resolved);
    inputRef.current?.blur();
  };

  const handleBack = () => {
    if (Platform.OS !== "web" && webViewRef.current) {
      webViewRef.current.goBack();
    }
  };

  const handleForward = () => {
    if (Platform.OS !== "web" && webViewRef.current) {
      webViewRef.current.goForward();
    }
  };

  const handleReload = () => {
    setIsLoading(true);
    if (Platform.OS !== "web" && webViewRef.current) {
      webViewRef.current.reload();
    } else {
      setCurrentUrl((u) => u + (u.includes("?") ? "&_r=" : "?_r=") + Date.now());
    }
  };

  const handleDownloadFromPage = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!currentUrl || currentUrl === HOME_URL) {
      Alert.alert("No page loaded", "Navigate to a video page first.");
      return;
    }
    router.push({ pathname: "/(tabs)/", params: { autoUrl: currentUrl } });
  };

  const handlePasteAndGo = async () => {
    const text = await Clipboard.getStringAsync();
    if (text?.trim()) {
      setInputText(text.trim());
      navigate(text.trim());
    }
  };

  const navBarHeight = 52;
  const bottomBarHeight = 56;
  const browserHeight =
    Platform.OS === "web"
      ? "100%"
      : undefined;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <LinearGradient
        colors={["#0A0A1E", C.background]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.15 }}
      />

      {/* ---- Address / Nav bar ---- */}
      <View style={styles.navBar}>
        <Pressable
          style={[styles.navBtn, !canGoBack && styles.navBtnDisabled]}
          onPress={handleBack}
          disabled={!canGoBack}
        >
          <Feather name="chevron-left" size={20} color={canGoBack ? C.text : C.textMuted} />
        </Pressable>

        <Pressable
          style={[styles.navBtn, !canGoForward && styles.navBtnDisabled]}
          onPress={handleForward}
          disabled={!canGoForward}
        >
          <Feather name="chevron-right" size={20} color={canGoForward ? C.text : C.textMuted} />
        </Pressable>

        <View style={[styles.urlBar, inputFocused && styles.urlBarFocused]}>
          <Feather
            name={currentUrl.startsWith("https") ? "lock" : "globe"}
            size={13}
            color={C.textMuted}
          />
          <TextInput
            ref={inputRef}
            style={styles.urlInput}
            value={inputFocused ? inputText : displayUrl(currentUrl)}
            onChangeText={setInputText}
            onFocus={() => {
              setInputFocused(true);
              setInputText(currentUrl);
            }}
            onBlur={() => {
              setInputFocused(false);
              setInputText("");
            }}
            onSubmitEditing={handleSubmit}
            placeholder="Search or enter URL..."
            placeholderTextColor={C.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            selectTextOnFocus
          />
          {isLoading ? (
            <ActivityIndicator size="small" color={C.accent} />
          ) : (
            <Pressable onPress={handleReload} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Feather name="refresh-cw" size={14} color={C.textMuted} />
            </Pressable>
          )}
        </View>

        <Pressable style={styles.navBtn} onPress={handlePasteAndGo}>
          <Feather name="clipboard" size={17} color={C.textSecondary} />
        </Pressable>
      </View>

      {/* ---- Web Content ---- */}
      <View style={styles.webArea}>
        {Platform.OS !== "web" ? (
          // Native: full WebView
          <NativeWebView
            webViewRef={webViewRef}
            url={currentUrl}
            onLoadStart={() => setIsLoading(true)}
            onLoadEnd={(url) => {
              setIsLoading(false);
              if (url) setCurrentUrl(url);
            }}
            onNavigationStateChange={(state: any) => {
              setCanGoBack(state.canGoBack);
              setCanGoForward(state.canGoForward);
              if (state.url) setCurrentUrl(state.url);
            }}
          />
        ) : (
          // Web: iframe with overlay
          <WebIframe
            iframeRef={iframeRef}
            url={currentUrl}
            onLoad={() => setIsLoading(false)}
          />
        )}
      </View>

      {/* ---- Bottom action bar ---- */}
      <View style={[styles.bottomBar, { paddingBottom: Platform.OS === "web" ? 16 : insets.bottom + 8 }]}>
        <Pressable
          style={styles.downloadFromPageBtn}
          onPress={handleDownloadFromPage}
        >
          <Feather name="download-cloud" size={17} color="#fff" />
          <Text style={styles.downloadFromPageText}>Download from this page</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---- Native WebView component ----
function NativeWebView({
  webViewRef,
  url,
  onLoadStart,
  onLoadEnd,
  onNavigationStateChange,
}: {
  webViewRef: React.RefObject<any>;
  url: string;
  onLoadStart: () => void;
  onLoadEnd: (url?: string) => void;
  onNavigationStateChange: (state: any) => void;
}) {
  try {
    const { WebView } = require("react-native-webview");
    return (
      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        style={styles.webView}
        onLoadStart={onLoadStart}
        onLoadEnd={(e: any) => onLoadEnd(e.nativeEvent?.url)}
        onNavigationStateChange={onNavigationStateChange}
        allowsBackForwardNavigationGestures
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        userAgent="Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
        renderError={() => (
          <View style={styles.errorState}>
            <Feather name="alert-circle" size={32} color={C.error} />
            <Text style={styles.errorText}>Could not load page</Text>
            <Text style={styles.errorSub}>Check the URL or your connection</Text>
          </View>
        )}
        renderLoading={() => (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={C.accent} />
          </View>
        )}
        startInLoadingState
      />
    );
  } catch {
    return (
      <View style={styles.errorState}>
        <Feather name="alert-circle" size={32} color={C.error} />
        <Text style={styles.errorText}>WebView not available</Text>
      </View>
    );
  }
}

// ---- Web iframe component ----
function WebIframe({
  iframeRef,
  url,
  onLoad,
}: {
  iframeRef: React.RefObject<any>;
  url: string;
  onLoad: () => void;
}) {
  const [blocked, setBlocked] = useState(false);

  return (
    <View style={styles.iframeWrap}>
      {/* @ts-ignore - web only */}
      <iframe
        ref={iframeRef}
        src={url}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          backgroundColor: "#000",
          display: blocked ? "none" : "block",
        }}
        onLoad={() => {
          setBlocked(false);
          onLoad();
        }}
        onError={() => {
          setBlocked(true);
          onLoad();
        }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        allow="autoplay; fullscreen"
        title="in-app browser"
      />
      {blocked && (
        <View style={styles.blockedState}>
          <Feather name="shield" size={32} color={C.textMuted} />
          <Text style={styles.blockedTitle}>Page blocked embedding</Text>
          <Text style={styles.blockedSub}>
            This site doesn't allow embedding.{"\n"}
            Copy the URL from a video and paste it on the Download tab.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  navBar: {
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
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: C.surfaceElevated,
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
    paddingHorizontal: 10,
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
  webArea: {
    flex: 1,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  webView: {
    flex: 1,
    backgroundColor: "#fff",
  },
  iframeWrap: {
    flex: 1,
    position: "relative",
  },
  loadingState: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.background,
  },
  errorState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: C.background,
    padding: 30,
  },
  errorText: {
    color: C.text,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  errorSub: {
    color: C.textMuted,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  blockedState: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: C.background,
    padding: 30,
  },
  blockedTitle: {
    color: C.text,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  blockedSub: {
    color: C.textSecondary,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  bottomBar: {
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.surfaceBorder,
  },
  downloadFromPageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 14,
  },
  downloadFromPageText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
});

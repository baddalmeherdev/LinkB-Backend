import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import { Dimensions, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

const START_IO_APP_ID = "202335300";
const SCREEN_WIDTH = Dimensions.get("window").width;
const BANNER_WIDTH = Math.min(SCREEN_WIDTH - 32, 320);
const BANNER_HEIGHT = 50;

const MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

const bannerHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: ${BANNER_WIDTH}px;
      height: ${BANNER_HEIGHT}px;
      background: transparent;
      overflow: hidden;
    }
    #banner-container {
      width: ${BANNER_WIDTH}px;
      height: ${BANNER_HEIGHT}px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    ins { display: block; }
  </style>
</head>
<body>
  <div id="banner-container">
    <ins class="startapp-ad"
      data-app-id="${START_IO_APP_ID}"
      data-ad-width="${BANNER_WIDTH}"
      data-ad-height="${BANNER_HEIGHT}"
      data-ad-type="banner">
    </ins>
  </div>
  <script>
    (function() {
      var loaded = false;
      var adFilled = false;

      function notifyLoaded() {
        if (!adFilled) {
          adFilled = true;
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage('ad_loaded');
        }
      }

      function tryLoadScript(src, retries) {
        if (loaded) return;
        retries = retries || 0;
        try {
          var s = document.createElement('script');
          s.async = true;
          s.src = src;
          s.setAttribute('data-app-id', '${START_IO_APP_ID}');
          s.setAttribute('data-ad-width', '${BANNER_WIDTH}');
          s.setAttribute('data-ad-height', '${BANNER_HEIGHT}');
          s.setAttribute('data-ad-type', 'banner');
          s.onload = function() { loaded = true; setTimeout(notifyLoaded, 1000); };
          s.onerror = function() {
            if (retries < 2) setTimeout(function() { tryLoadScript(src, retries + 1); }, 2000);
          };
          document.head.appendChild(s);
        } catch(e) {}
      }

      tryLoadScript('https://cdn.startapp.com/startio.js', 0);
      setTimeout(function() {
        if (!loaded) tryLoadScript('https://cdn.startappws.com/loader.js', 0);
      }, 2000);
      setTimeout(function() {
        if (!loaded) tryLoadScript('https://d2ywez57ub2gfd.cloudfront.net/sdk/startio.js', 0);
      }, 4000);
      setTimeout(function() {
        if (!adFilled) {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage('ad_failed');
        }
      }, 6000);
    })();
  </script>
</body>
</html>`;

type Props = {
  onPremiumPress?: () => void;
};

export function AdBanner({ onPremiumPress }: Props) {
  const [adLoaded, setAdLoaded] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fallbackTimerRef.current = setTimeout(() => {
      if (!adLoaded) setShowFallback(true);
    }, 5000);
    return () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    };
  }, []);

  if (Platform.OS === "web") return null;

  return (
    <View style={styles.container}>
      <View style={[styles.bannerWrap, { width: BANNER_WIDTH }]}>
        {/* Real ad via WebView */}
        <WebView
          source={{ html: bannerHtml }}
          style={[styles.webview, { width: BANNER_WIDTH, opacity: adLoaded ? 1 : 0, position: "absolute", top: 0, left: 0 }]}
          userAgent={MOBILE_UA}
          scrollEnabled={false}
          originWhitelist={["*"]}
          mixedContentMode="always"
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo={false}
          startInLoadingState={false}
          onShouldStartLoadWithRequest={() => true}
          allowsLinkPreview={false}
          geolocationEnabled={false}
          onMessage={(e) => {
            if (e.nativeEvent.data === "ad_loaded") {
              setAdLoaded(true);
              setShowFallback(false);
              if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
            } else if (e.nativeEvent.data === "ad_failed") {
              setShowFallback(true);
            }
          }}
          onError={() => setShowFallback(true)}
        />

        {/* Fallback house ad banner */}
        {(showFallback || !adLoaded) && (
          <Pressable
            style={styles.houseBanner}
            onPress={onPremiumPress}
            android_ripple={{ color: "rgba(255,255,255,0.1)" }}
          >
            <LinearGradient
              colors={["#1A0F00", "#2A1800", "#1A1000"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.houseBannerGrad}
            >
              <MaterialCommunityIcons name="crown" size={16} color="#F59E0B" />
              <View style={{ flex: 1 }}>
                <Text style={styles.houseTitle} numberOfLines={1}>
                  Upgrade to Premium — No Ads, 4K Downloads!
                </Text>
              </View>
              <View style={styles.houseBtn}>
                <Text style={styles.houseBtnText}>₹29</Text>
              </View>
            </LinearGradient>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    paddingVertical: 4,
    minHeight: BANNER_HEIGHT + 8,
  },
  bannerWrap: {
    height: BANNER_HEIGHT,
    overflow: "hidden",
    borderRadius: 8,
    position: "relative",
  },
  webview: {
    height: BANNER_HEIGHT,
    backgroundColor: "transparent",
  },
  houseBanner: {
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#3D2A00",
  },
  houseBannerGrad: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  houseTitle: {
    color: "#F59E0B",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  houseBtn: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  houseBtnText: {
    color: "#000",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
});

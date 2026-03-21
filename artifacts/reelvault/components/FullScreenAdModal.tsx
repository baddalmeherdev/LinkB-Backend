import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Dimensions,
} from "react-native";
import { WebView } from "react-native-webview";

const START_IO_APP_ID = "202335300";
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

const INTERSTITIAL_DURATION = 5;
const REWARDED_DURATION = 15;
const AD_FALLBACK_TIMEOUT = 3500;

function buildAdHtml(adType: "rewarded" | "interstitial") {
  const adW = Math.min(SCREEN_W - 20, 320);
  const adH = adType === "rewarded" ? 480 : 250;
  const sdkAdType = adType === "rewarded" ? "rewarded-video" : "interstitial";
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: transparent; display: flex; align-items: center; justify-content: center; }
    #ad-wrap { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
    ins { display: block; }
  </style>
</head>
<body>
  <div id="ad-wrap">
    <ins class="startapp-ad"
      data-app-id="${START_IO_APP_ID}"
      data-ad-width="${adW}"
      data-ad-height="${adH}"
      data-ad-type="${sdkAdType}">
    </ins>
  </div>
  <script>
    (function() {
      var loaded = false;
      function tryLoad(src, retries) {
        if (loaded) return; retries = retries || 0;
        try {
          var s = document.createElement('script'); s.async = true; s.src = src;
          s.setAttribute('data-app-id','${START_IO_APP_ID}');
          s.setAttribute('data-ad-width','${adW}');
          s.setAttribute('data-ad-height','${adH}');
          s.setAttribute('data-ad-type','${sdkAdType}');
          s.onload = function() { loaded = true; window.ReactNativeWebView && window.ReactNativeWebView.postMessage('ad_loaded'); };
          s.onerror = function() { if (retries < 2) setTimeout(function() { tryLoad(src, retries+1); }, 2000); };
          document.head.appendChild(s);
        } catch(e) {}
      }
      tryLoad('https://cdn.startapp.com/startio.js', 0);
      setTimeout(function() { if (!loaded) tryLoad('https://cdn.startappws.com/loader.js', 0); }, 2000);
    })();
  </script>
</body>
</html>`;
}

type Props = {
  visible: boolean;
  mode: "rewarded" | "interstitial";
  onComplete: (earned: boolean) => void;
};

export function FullScreenAdModal({ visible, mode, onComplete }: Props) {
  const [countdown, setCountdown] = useState(0);
  const [canClose, setCanClose] = useState(false);
  const [webviewKey, setWebviewKey] = useState(0);
  const [adLoaded, setAdLoaded] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; });

  const handleComplete = useCallback((earned: boolean) => {
    onCompleteRef.current(earned);
  }, []);

  useEffect(() => {
    if (!visible) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      setCanClose(false);
      setAdLoaded(false);
      setShowFallback(false);
      return;
    }

    const duration = mode === "rewarded" ? REWARDED_DURATION : INTERSTITIAL_DURATION;
    setCountdown(duration);
    setCanClose(false);
    setAdLoaded(false);
    setShowFallback(false);
    setWebviewKey((k) => k + 1);

    // If real ad doesn't load in 3.5s, show the house ad fallback
    fallbackTimerRef.current = setTimeout(() => {
      setShowFallback(true);
    }, AD_FALLBACK_TIMEOUT);

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setCanClose(true);
          if (mode === "interstitial") {
            setTimeout(() => onCompleteRef.current(true), 500);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    };
  }, [visible, mode]);

  if (Platform.OS === "web") return null;
  if (!visible) return null;

  const isRewarded = mode === "rewarded";

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => {
        if (canClose) handleComplete(isRewarded);
      }}
    >
      <View style={styles.root}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={styles.adBadge}>
            <Text style={styles.adBadgeText}>AD</Text>
          </View>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {isRewarded
              ? canClose
                ? "🎉 Reward earned! Tap Close"
                : `Watch ${countdown}s to unlock access`
              : countdown > 0
              ? `Ad — closes in ${countdown}s`
              : "Done!"}
          </Text>
          {canClose ? (
            <Pressable
              style={styles.closeBtn}
              onPress={() => handleComplete(isRewarded)}
              android_ripple={{ color: "#ffffff22", radius: 24 }}
            >
              <Text style={styles.closeBtnText}>
                {isRewarded ? "Get Reward" : "Close"}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.countdownBadge}>
              <Text style={styles.countdownText}>{countdown}</Text>
            </View>
          )}
        </View>

        {/* Ad area — real WebView ad with house-ad fallback */}
        <View style={styles.adArea}>
          {/* WebView for real Start.io ad */}
          <WebView
            key={webviewKey}
            source={{ html: buildAdHtml(mode) }}
            style={[styles.webview, { opacity: adLoaded ? 1 : 0 }]}
            userAgent={MOBILE_UA}
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled
            mixedContentMode="always"
            originWhitelist={["*"]}
            scrollEnabled={false}
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            onShouldStartLoadWithRequest={() => true}
            onMessage={(e) => {
              if (e.nativeEvent.data === "ad_loaded") {
                setAdLoaded(true);
                if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
                setShowFallback(false);
              }
            }}
            onError={() => { setShowFallback(true); }}
            onHttpError={() => { setShowFallback(true); }}
          />

          {/* House ad fallback — shows when real ad doesn't load */}
          {(showFallback || (!adLoaded)) && (
            <View style={[StyleSheet.absoluteFill, styles.houseAd]}>
              <LinearGradient
                colors={["#0D0D2E", "#1A0A3E", "#0D1A3E"]}
                style={styles.houseAdGradient}
              >
                <View style={styles.houseAdIcon}>
                  <MaterialCommunityIcons name="crown" size={48} color="#F59E0B" />
                </View>
                <Text style={styles.houseAdTitle}>LinkB Premium</Text>
                <Text style={styles.houseAdSubtitle}>Upgrade & unlock everything</Text>

                <View style={styles.houseAdFeatures}>
                  {[
                    "HD & 4K downloads",
                    "No watermark",
                    "No ads, ever",
                    "Unlimited downloads",
                    "Video trimming",
                  ].map((f) => (
                    <View key={f} style={styles.houseAdFeatureRow}>
                      <Feather name="check-circle" size={14} color="#22C55E" />
                      <Text style={styles.houseAdFeatureText}>{f}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.houseAdPrice}>
                  <Text style={styles.houseAdPriceText}>₹29</Text>
                  <Text style={styles.houseAdPriceSub}>/month via UPI</Text>
                </View>

                <Text style={styles.houseAdCta}>Go to Premium tab to upgrade</Text>
              </LinearGradient>
            </View>
          )}
        </View>

        {/* Bottom bar */}
        <View style={styles.bottomBar}>
          {isRewarded ? (
            canClose ? (
              <Text style={styles.bottomSuccess}>You've earned free Premium access!</Text>
            ) : (
              <>
                <Text style={styles.bottomTitle}>Watch the full ad to unlock free access</Text>
                <Text style={styles.bottomSub}>Closing early will not grant the reward</Text>
              </>
            )
          ) : (
            <Text style={styles.bottomTitle}>Your download is ready — ad finishes soon</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0A14" },
  topBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12,
    backgroundColor: "#101020", borderBottomWidth: 1,
    borderBottomColor: "#1E1E3A", gap: 10,
  },
  adBadge: {
    borderWidth: 1, borderColor: "#555",
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  adBadgeText: { color: "#888", fontSize: 10, fontFamily: "Inter_500Medium", letterSpacing: 0.5 },
  topBarTitle: { flex: 1, color: "#CBD5E1", fontSize: 13, fontFamily: "Inter_500Medium" },
  closeBtn: {
    backgroundColor: "#2563EB", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  closeBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  countdownBadge: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#1E293B", alignItems: "center", justifyContent: "center",
  },
  countdownText: { color: "#60A5FA", fontSize: 15, fontFamily: "Inter_700Bold" },
  adArea: { flex: 1, backgroundColor: "#0A0A14" },
  webview: { flex: 1, backgroundColor: "#0A0A14" },
  houseAd: { backgroundColor: "#0A0A14" },
  houseAdGradient: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 32, gap: 12,
  },
  houseAdIcon: {
    width: 88, height: 88, borderRadius: 22,
    backgroundColor: "#1A1000", borderWidth: 1,
    borderColor: "#F59E0B40", alignItems: "center", justifyContent: "center",
    marginBottom: 8,
  },
  houseAdTitle: {
    color: "#FFFFFF", fontSize: 28, fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  houseAdSubtitle: { color: "#94A3B8", fontSize: 15, fontFamily: "Inter_400Regular" },
  houseAdFeatures: { gap: 10, marginTop: 8, alignSelf: "stretch" },
  houseAdFeatureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  houseAdFeatureText: { color: "#E2E8F0", fontSize: 15, fontFamily: "Inter_500Medium" },
  houseAdPrice: {
    flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 16,
  },
  houseAdPriceText: {
    color: "#F59E0B", fontSize: 40, fontFamily: "Inter_700Bold",
  },
  houseAdPriceSub: { color: "#94A3B8", fontSize: 15, fontFamily: "Inter_400Regular" },
  houseAdCta: {
    color: "#60A5FA", fontSize: 13, fontFamily: "Inter_500Medium",
    marginTop: 4, textAlign: "center",
  },
  bottomBar: {
    paddingHorizontal: 20, paddingVertical: 20, paddingBottom: 40,
    backgroundColor: "#101020", borderTopWidth: 1,
    borderTopColor: "#1E1E3A", gap: 4, alignItems: "center",
  },
  bottomTitle: { color: "#E2E8F0", fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  bottomSub: { color: "#64748B", fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  bottomSuccess: { color: "#22C55E", fontSize: 14, fontFamily: "Inter_600SemiBold", textAlign: "center" },
});

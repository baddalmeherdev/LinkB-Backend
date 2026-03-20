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
const { width: SCREEN_W } = Dimensions.get("window");

const MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

function buildAdHtml(adType: "rewarded" | "interstitial") {
  const bgColor = "#0a0a14";
  const adW = Math.min(SCREEN_W - 20, 320);
  const adH = adType === "rewarded" ? 480 : 250;
  const sdkAdType = adType === "rewarded" ? "rewarded-video" : "interstitial";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      background: ${bgColor};
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #ad-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    }
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
      var scriptLoaded = false;

      function tryLoadScript(src, retries) {
        if (scriptLoaded) return;
        retries = retries || 0;
        try {
          var s = document.createElement('script');
          s.async = true;
          s.src = src;
          s.setAttribute('data-app-id', '${START_IO_APP_ID}');
          s.setAttribute('data-ad-width', '${adW}');
          s.setAttribute('data-ad-height', '${adH}');
          s.setAttribute('data-ad-type', '${sdkAdType}');
          s.onload = function() { scriptLoaded = true; };
          s.onerror = function() {
            if (retries < 2) setTimeout(function() { tryLoadScript(src, retries + 1); }, 1500);
          };
          document.head.appendChild(s);
        } catch(e) {}
      }

      tryLoadScript('https://cdn.startapp.com/startio.js', 0);

      setTimeout(function() {
        if (!scriptLoaded) {
          tryLoadScript('https://cdn.startappws.com/loader.js', 0);
        }
      }, 2000);
    })();
  </script>
</body>
</html>`;
}

const INTERSTITIAL_DURATION = 5;
const REWARDED_DURATION = 15;

type Props = {
  visible: boolean;
  mode: "rewarded" | "interstitial";
  onComplete: (earned: boolean) => void;
};

export function FullScreenAdModal({ visible, mode, onComplete }: Props) {
  const [countdown, setCountdown] = useState(0);
  const [canClose, setCanClose] = useState(false);
  const [webviewKey, setWebviewKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Always keep a ref to the latest onComplete so the timer closure is never stale
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; });

  // Stable wrapper so JSX callbacks don't recreate on every render
  const handleComplete = useCallback((earned: boolean) => {
    onCompleteRef.current(earned);
  }, []);

  useEffect(() => {
    if (!visible) {
      if (timerRef.current) clearInterval(timerRef.current);
      setCanClose(false);
      return;
    }

    const duration = mode === "rewarded" ? REWARDED_DURATION : INTERSTITIAL_DURATION;
    setCountdown(duration);
    setCanClose(false);
    setWebviewKey((k) => k + 1);

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setCanClose(true);
          if (mode === "interstitial") {
            // Use ref so interstitial auto-close always calls the current callback
            setTimeout(() => onCompleteRef.current(true), 500);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
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
              ? `Ad finishes in ${countdown}s…`
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

        <View style={styles.adArea}>
          <WebView
            key={webviewKey}
            source={{ html: buildAdHtml(mode) }}
            style={styles.webview}
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
            onError={() => {}}
            onHttpError={() => {}}
          />
        </View>

        <View style={styles.bottomBar}>
          {isRewarded ? (
            canClose ? (
              <Text style={styles.bottomSuccess}>
                You've earned free Premium access!
              </Text>
            ) : (
              <>
                <Text style={styles.bottomTitle}>
                  Watch the full ad to unlock free access
                </Text>
                <Text style={styles.bottomSub}>
                  Closing early will not grant the reward
                </Text>
              </>
            )
          ) : (
            <Text style={styles.bottomTitle}>
              Your download will start shortly…
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0A0A14",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
    backgroundColor: "#101020",
    borderBottomWidth: 1,
    borderBottomColor: "#1E1E3A",
    gap: 10,
  },
  adBadge: {
    borderWidth: 1,
    borderColor: "#555",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adBadgeText: {
    color: "#888",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.5,
  },
  topBarTitle: {
    flex: 1,
    color: "#CBD5E1",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  closeBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  closeBtnText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  countdownBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  countdownText: {
    color: "#60A5FA",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  adArea: {
    flex: 1,
    backgroundColor: "#0A0A14",
  },
  webview: {
    flex: 1,
    backgroundColor: "#0A0A14",
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 40,
    backgroundColor: "#101020",
    borderTopWidth: 1,
    borderTopColor: "#1E1E3A",
    gap: 4,
    alignItems: "center",
  },
  bottomTitle: {
    color: "#E2E8F0",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  bottomSub: {
    color: "#64748B",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  bottomSuccess: {
    color: "#22C55E",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
});

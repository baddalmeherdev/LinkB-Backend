import React, { useState } from "react";
import { Dimensions, Platform, StyleSheet, View } from "react-native";
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

      function tryLoadScript(src, attrs, retries) {
        if (loaded) return;
        retries = retries || 0;
        try {
          var s = document.createElement('script');
          s.async = true;
          s.src = src;
          for (var k in attrs) { s.setAttribute(k, attrs[k]); }
          s.onload = function() { loaded = true; };
          s.onerror = function() {
            if (retries < 2) setTimeout(function() { tryLoadScript(src, attrs, retries + 1); }, 1500);
          };
          document.head.appendChild(s);
        } catch(e) {}
      }

      var attrs = {
        'data-app-id': '${START_IO_APP_ID}',
        'data-ad-width': '${BANNER_WIDTH}',
        'data-ad-height': '${BANNER_HEIGHT}',
        'data-ad-type': 'banner'
      };

      tryLoadScript('https://cdn.startapp.com/startio.js', attrs, 0);

      setTimeout(function() {
        if (!loaded) {
          tryLoadScript('https://cdn.startappws.com/loader.js', attrs, 0);
        }
      }, 2000);
    })();
  </script>
</body>
</html>`;

export function AdBanner() {
  const [loaded, setLoaded] = useState(false);

  if (Platform.OS === "web") return null;

  return (
    <View style={styles.container}>
      <View style={[styles.bannerWrap, { width: BANNER_WIDTH }]}>
        <WebView
          source={{ html: bannerHtml }}
          style={[styles.webview, { width: BANNER_WIDTH, opacity: loaded ? 1 : 0 }]}
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
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          onHttpError={() => setLoaded(true)}
          onShouldStartLoadWithRequest={() => true}
          allowsLinkPreview={false}
          geolocationEnabled={false}
        />
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
    borderRadius: 6,
  },
  webview: {
    height: BANNER_HEIGHT,
    backgroundColor: "transparent",
  },
});

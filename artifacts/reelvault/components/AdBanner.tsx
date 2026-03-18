import React from "react";
import { Dimensions, Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

const START_IO_APP_ID = "202335300";
const SCREEN_WIDTH = Dimensions.get("window").width;
const BANNER_WIDTH = Math.min(SCREEN_WIDTH - 32, 320);
const BANNER_HEIGHT = 50;

const bannerHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: ${BANNER_WIDTH}px;
      height: ${BANNER_HEIGHT}px;
      background: #111;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .ad-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div class="ad-wrap">
    <script
      src="https://cdn.startappws.com/loader.js"
      data-app-id="${START_IO_APP_ID}"
      data-ad-width="${BANNER_WIDTH}"
      data-ad-height="${BANNER_HEIGHT}"
    ></script>
  </div>
</body>
</html>
`;

export function AdBanner() {
  if (Platform.OS === "web") {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.bannerWrap, { width: BANNER_WIDTH }]}>
        <WebView
          source={{ html: bannerHtml }}
          style={[styles.webview, { width: BANNER_WIDTH }]}
          scrollEnabled={false}
          originWhitelist={["*"]}
          mixedContentMode="always"
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          onError={() => {}}
          onHttpError={() => {}}
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

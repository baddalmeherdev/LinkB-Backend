import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

const START_IO_APP_ID = "202335300";

const bannerHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .ad-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 320px;
      min-height: 50px;
    }
  </style>
</head>
<body>
  <div class="ad-wrap">
    <script
      src="//cdn.startappws.com/loader.js"
      data-app-id="${START_IO_APP_ID}"
      async
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
      <View style={styles.bannerWrap}>
        <WebView
          source={{ html: bannerHtml }}
          style={styles.webview}
          scrollEnabled={false}
          originWhitelist={["*"]}
          mixedContentMode="always"
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          onError={() => {}}
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
    width: 320,
    height: 50,
    overflow: "hidden",
    borderRadius: 6,
  },
  webview: {
    width: 320,
    height: 50,
    backgroundColor: "transparent",
  },
});

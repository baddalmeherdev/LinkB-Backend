import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider } from "@/context/AppContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { initUnityAds } from "@/utils/unityAds";
import Colors from "@/constants/colors";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();
const C = Colors.dark;

// ── Web font registration ──────────────────────────────────────────────────
// Called SYNCHRONOUSLY at module init (before any React rendering) so that
// React Native Web's fontfaceobserver finds the fonts already registered in
// document.fonts and resolves immediately instead of timing out after 6 s.
// On most Android/iOS phones Inter is not installed as a system font, so
// using only local() fallbacks causes fontfaceobserver to always timeout.
// We fix this by:
//   1. Loading Inter from Google Fonts CDN (loads fast, globally cached)
//   2. Pre-registering each RN font name via the CSS Font Loading API
//      (document.fonts.add before .load, so the font face exists immediately)

function registerWebFonts() {
  if (typeof document === "undefined" || typeof FontFace === "undefined") return;
  if (document.getElementById("linkb-fonts-registered")) return;

  // Mark as done synchronously so repeated calls are no-ops
  const marker = document.createElement("meta");
  marker.id = "linkb-fonts-registered";
  document.head.appendChild(marker);

  // 1. Google Fonts CDN link for actual Inter glyphs (improves visual quality)
  if (!document.getElementById("gfonts-inter")) {
    const pre1 = document.createElement("link");
    pre1.rel = "preconnect";
    pre1.href = "https://fonts.googleapis.com";
    document.head.appendChild(pre1);

    const pre2 = document.createElement("link");
    pre2.rel = "preconnect";
    pre2.href = "https://fonts.gstatic.com";
    pre2.crossOrigin = "anonymous";
    document.head.appendChild(pre2);

    const gf = document.createElement("link");
    gf.id = "gfonts-inter";
    gf.rel = "stylesheet";
    gf.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(gf);
  }

  // 2. Base CSS: body/background defaults
  const style = document.createElement("style");
  style.id = "linkb-base-style";
  style.textContent = `
    * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; box-sizing: border-box; }
    body { margin: 0; background-color: #0A0A0F; font-family: Inter, Roboto, 'Helvetica Neue', Arial, sans-serif; }
  `;
  document.head.appendChild(style);

  // 3. CSS Font Loading API: register each RN font name.
  //    We add() to document.fonts FIRST (before load), so the font is
  //    discoverable immediately. Then .load() resolves it — local('Arial')
  //    is guaranteed available on every device, so it resolves in < 50 ms.
  //    fontfaceobserver calls document.fonts.load() which resolves as soon
  //    as the FontFace status changes to 'loaded'.
  const defs: Array<[string, string, FontFaceDescriptors]> = [
    ["Inter_400Regular", "local('Inter Regular'), local('Inter'), local('Roboto'), local('Arial')", { weight: "400", style: "normal" }],
    ["Inter_500Medium", "local('Inter Medium'), local('Inter'), local('Roboto Medium'), local('Roboto'), local('Arial')", { weight: "500", style: "normal" }],
    ["Inter_600SemiBold", "local('Inter SemiBold'), local('Inter'), local('Roboto Medium'), local('Roboto'), local('Arial')", { weight: "600", style: "normal" }],
    ["Inter_700Bold", "local('Inter Bold'), local('Inter'), local('Roboto Bold'), local('Roboto Bold'), local('Arial')", { weight: "700", style: "normal" }],
  ];

  for (const [family, src, desc] of defs) {
    try {
      const ff = new FontFace(family, src, desc);
      // Add BEFORE load so fontfaceobserver sees the font in document.fonts
      (document.fonts as any).add(ff);
      ff.load().catch(() => {
        // If all local() sources fail, fall back to guaranteed Arial
        try {
          const fallback = new FontFace(family, "local('Arial')", desc);
          (document.fonts as any).add(fallback);
          fallback.load().catch(() => {});
        } catch { /* ignore */ }
      });
    } catch { /* ignore */ }
  }
}

// Run synchronously so fonts are registered before first React render
if (Platform.OS === "web") {
  registerWebFonts();
}

// ── PWA setup ─────────────────────────────────────────────────────────────

function setupPWA() {
  if (typeof document === "undefined" || typeof window === "undefined") return;

  if (!document.getElementById("pwa-manifest")) {
    const link = document.createElement("link");
    link.id = "pwa-manifest";
    link.rel = "manifest";
    link.href = "/manifest.json";
    document.head.appendChild(link);
  }

  if (!document.getElementById("pwa-theme")) {
    const meta = document.createElement("meta");
    meta.id = "pwa-theme";
    meta.name = "theme-color";
    meta.content = "#0A0A0F";
    document.head.appendChild(meta);

    const metaApple = document.createElement("meta");
    metaApple.name = "apple-mobile-web-app-capable";
    metaApple.content = "yes";
    document.head.appendChild(metaApple);

    const metaAppleStatus = document.createElement("meta");
    metaAppleStatus.name = "apple-mobile-web-app-status-bar-style";
    metaAppleStatus.content = "black-translucent";
    document.head.appendChild(metaAppleStatus);
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => console.log("[SW] registered:", reg.scope))
      .catch((e) => console.warn("[SW] registration failed:", e));
  }
}

// ── Navigator ─────────────────────────────────────────────────────────────

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: C.background },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

// ── Platform layouts ───────────────────────────────────────────────────────

function NativeLayout() {
  useEffect(() => {
    initUnityAds();
    // Wake up Render server so it's ready before user pastes a URL
    fetch("https://linkb-backend-api.onrender.com/api/health", { method: "GET" }).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadFonts() {
      try {
        const ExpoFont = await import("expo-font");
        const {
          Inter_400Regular,
          Inter_500Medium,
          Inter_600SemiBold,
          Inter_700Bold,
        } = await import("@expo-google-fonts/inter");

        await Promise.race([
          ExpoFont.loadAsync({
            Inter_400Regular,
            Inter_500Medium,
            Inter_600SemiBold,
            Inter_700Bold,
          }),
          new Promise<void>((resolve) => setTimeout(resolve, 4000)),
        ]);
      } catch (e) {
        console.warn("[fonts] Load failed, using system font:", e);
      } finally {
        if (!cancelled) {
          SplashScreen.hideAsync().catch(() => {});
        }
      }
    }

    loadFonts();
    return () => { cancelled = true; };
  }, []);

  return <RootLayoutNav />;
}

function WebLayout() {
  useEffect(() => {
    // registerWebFonts() was already called synchronously at module init.
    // Just run the PWA setup and hide the splash here.
    setupPWA();
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return <RootLayoutNav />;
}

// ── Root ──────────────────────────────────────────────────────────────────

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AppProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              {Platform.OS === "web" ? <WebLayout /> : <NativeLayout />}
            </GestureHandlerRootView>
          </AppProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

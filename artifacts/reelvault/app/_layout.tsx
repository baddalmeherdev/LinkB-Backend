import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider } from "@/context/AppContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Colors from "@/constants/colors";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();
const C = Colors.dark;

function setupPWA() {
  if (typeof document === "undefined" || typeof window === "undefined") return;

  // Inject manifest link
  if (!document.getElementById("pwa-manifest")) {
    const link = document.createElement("link");
    link.id = "pwa-manifest";
    link.rel = "manifest";
    link.href = "/manifest.json";
    document.head.appendChild(link);
  }

  // Inject theme-color
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

  // Register service worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => console.log("[SW] registered:", reg.scope))
      .catch((e) => console.warn("[SW] registration failed:", e));
  }
}

function injectWebFonts() {
  if (typeof document === "undefined") return;
  if (document.getElementById("linkdrop-fonts")) return;

  const style = document.createElement("style");
  style.id = "linkdrop-fonts";
  style.textContent = `
    @font-face {
      font-family: 'Inter_400Regular';
      src: local('Inter'), local('Roboto'), local('Helvetica Neue'), local('Arial');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Inter_500Medium';
      src: local('Inter Medium'), local('Inter'), local('Roboto Medium'), local('Roboto'), local('Arial');
      font-weight: 500;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Inter_600SemiBold';
      src: local('Inter SemiBold'), local('Inter'), local('Roboto Medium'), local('Roboto'), local('Arial');
      font-weight: 600;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Inter_700Bold';
      src: local('Inter Bold'), local('Inter'), local('Roboto Bold'), local('Roboto'), local('Arial');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
    * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
    body { background-color: #0A0A0F; font-family: Inter, Roboto, 'Helvetica Neue', Arial, sans-serif; }
  `;
  document.head.appendChild(style);
}

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

function NativeLayout() {
  const [ready, setReady] = useState(false);

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

        await ExpoFont.loadAsync({
          Inter_400Regular,
          Inter_500Medium,
          Inter_600SemiBold,
          Inter_700Bold,
        });
      } catch (e) {
        console.warn("[fonts] Load failed, using system font:", e);
      } finally {
        if (!cancelled) {
          setReady(true);
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
    injectWebFonts();
    setupPWA();
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return <RootLayoutNav />;
}

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

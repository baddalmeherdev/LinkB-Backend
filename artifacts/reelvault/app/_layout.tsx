import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider } from "@/context/AppContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Colors from "@/constants/colors";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();
const C = Colors.dark;

// Font loading timeout — if fonts haven't loaded after this many ms, show the
// app anyway to avoid the Expo Router "6000ms timeout exceeded" error.
const FONT_TIMEOUT_MS = 4000;

function injectWebFonts() {
  if (typeof document === "undefined") return;
  if (document.getElementById("linkdrop-fonts")) return;

  const link = document.createElement("link");
  link.id = "linkdrop-fonts-cdn";
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
  document.head.appendChild(link);

  const style = document.createElement("style");
  style.id = "linkdrop-fonts";
  style.textContent = `
    @font-face {
      font-family: 'Inter_400Regular';
      src: local('Inter Regular'), local('Inter'), local('Inter-Regular');
      font-weight: 400;
      font-style: normal;
    }
    @font-face {
      font-family: 'Inter_500Medium';
      src: local('Inter Medium'), local('Inter'), local('Inter-Medium');
      font-weight: 500;
      font-style: normal;
    }
    @font-face {
      font-family: 'Inter_600SemiBold';
      src: local('Inter SemiBold'), local('Inter'), local('Inter-SemiBold');
      font-weight: 600;
      font-style: normal;
    }
    @font-face {
      font-family: 'Inter_700Bold';
      src: local('Inter Bold'), local('Inter'), local('Inter-Bold');
      font-weight: 700;
      font-style: normal;
    }
    * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
    body { background-color: #0A0A0F; }
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
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Safety timeout — never block navigation for more than FONT_TIMEOUT_MS
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  const ready = fontsLoaded || !!fontError || timedOut;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  // Show a blank dark screen instead of null so Expo Router never hits its
  // 6000ms navigation timeout.
  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: C.background }} />;
  }

  return <RootLayoutNav />;
}

function WebLayout() {
  useEffect(() => {
    injectWebFonts();
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // On web there is no font-loading gate — render immediately.
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

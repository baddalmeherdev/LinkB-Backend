import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type VideoQuality = {
  formatId: string;
  quality: string;
  label: string;
  resolution: string;
  ext: string;
  filesize: number | null;
  isAudioOnly: boolean;
  isHD: boolean;
};

export type VideoInfo = {
  title: string;
  thumbnail: string | null;
  duration: number | null;
  uploader: string | null;
  platform: string;
  qualities: VideoQuality[];
  originalUrl: string;
};

export type DownloadHistoryItem = {
  id: string;
  title: string;
  thumbnail: string | null;
  platform: string;
  quality: string;
  downloadedAt: number;
  url: string;
  filename: string;
  localUri?: string;
  isAudio?: boolean;
};

type AppContextType = {
  isPremium: boolean;
  unlockPremium: () => void;
  history: DownloadHistoryItem[];
  addToHistory: (item: Omit<DownloadHistoryItem, "id" | "downloadedAt">) => void;
  clearHistory: () => void;
  removeFromHistory: (id: string) => void;
};

const AppContext = createContext<AppContextType | null>(null);

const PREMIUM_KEY = "@reelvault:premium";
const HISTORY_KEY = "@reelvault:history";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isPremium, setIsPremium] = useState(false);
  const [history, setHistory] = useState<DownloadHistoryItem[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [premiumRaw, historyRaw] = await Promise.all([
          AsyncStorage.getItem(PREMIUM_KEY),
          AsyncStorage.getItem(HISTORY_KEY),
        ]);
        if (premiumRaw === "true") setIsPremium(true);
        if (historyRaw) setHistory(JSON.parse(historyRaw) as DownloadHistoryItem[]);
      } catch {
      }
    };
    load();
  }, []);

  const unlockPremium = useCallback(async () => {
    setIsPremium(true);
    await AsyncStorage.setItem(PREMIUM_KEY, "true");
  }, []);

  const addToHistory = useCallback(
    async (item: Omit<DownloadHistoryItem, "id" | "downloadedAt">) => {
      const newItem: DownloadHistoryItem = {
        ...item,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        downloadedAt: Date.now(),
      };
      setHistory((prev) => {
        const updated = [newItem, ...prev].slice(0, 100);
        AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    []
  );

  const removeFromHistory = useCallback(async (id: string) => {
    setHistory((prev) => {
      const updated = prev.filter((h) => h.id !== id);
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearHistory = useCallback(async () => {
    setHistory([]);
    await AsyncStorage.removeItem(HISTORY_KEY);
  }, []);

  return (
    <AppContext.Provider
      value={{ isPremium, unlockPremium, history, addToHistory, clearHistory, removeFromHistory }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

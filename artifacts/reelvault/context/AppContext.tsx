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
  premiumExpiry: number | null;
  unlockPremium: () => void;
  history: DownloadHistoryItem[];
  addToHistory: (item: Omit<DownloadHistoryItem, "id" | "downloadedAt">) => void;
  clearHistory: () => void;
  removeFromHistory: (id: string) => void;
};

const AppContext = createContext<AppContextType | null>(null);

const PREMIUM_EXPIRY_KEY = "@reelvault:premium_expiry";
const HISTORY_KEY = "@reelvault:history";

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isPremium, setIsPremium] = useState(false);
  const [premiumExpiry, setPremiumExpiry] = useState<number | null>(null);
  const [history, setHistory] = useState<DownloadHistoryItem[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [expiryRaw, historyRaw] = await Promise.all([
          AsyncStorage.getItem(PREMIUM_EXPIRY_KEY),
          AsyncStorage.getItem(HISTORY_KEY),
        ]);

        if (expiryRaw) {
          const expiry = parseInt(expiryRaw, 10);
          if (!isNaN(expiry)) {
            if (Date.now() < expiry) {
              setIsPremium(true);
              setPremiumExpiry(expiry);
            } else {
              await AsyncStorage.removeItem(PREMIUM_EXPIRY_KEY);
              setIsPremium(false);
              setPremiumExpiry(null);
            }
          }
        }

        if (historyRaw) setHistory(JSON.parse(historyRaw) as DownloadHistoryItem[]);
      } catch {
      }
    };
    load();
  }, []);

  const unlockPremium = useCallback(async () => {
    const expiry = Date.now() + ONE_MONTH_MS;
    setIsPremium(true);
    setPremiumExpiry(expiry);
    await AsyncStorage.setItem(PREMIUM_EXPIRY_KEY, expiry.toString());
  }, []);

  // Grants 24 hours of Premium — triggered by watching a rewarded ad.
  const unlockPremiumOnce = useCallback(async () => {
    const expiry = Date.now() + ONE_DAY_MS;
    setIsPremium(true);
    setPremiumExpiry(expiry);
    await AsyncStorage.setItem(PREMIUM_EXPIRY_KEY, expiry.toString());
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
      value={{ isPremium, premiumExpiry, unlockPremium, unlockPremiumOnce, history, addToHistory, clearHistory, removeFromHistory }}
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

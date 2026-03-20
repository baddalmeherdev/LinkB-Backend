import { NativeModules, NativeEventEmitter, Platform } from "react-native";

export const UNITY_GAME_ID = "6069290";
export const REWARDED_PLACEMENT = "Rewarded_Android";
export const INTERSTITIAL_PLACEMENT = "Interstitial_Android";

const RNUnityAds = NativeModules.RNUnityAds as {
  initialize: (gameId: string, testMode: boolean) => void;
  load: (placementId: string) => void;
  show: (placementId: string) => void;
  addListener: (event: string) => void;
  removeListeners: (count: number) => void;
} | null;

let emitter: NativeEventEmitter | null = null;
let unityInitialized = false;

if (RNUnityAds && Platform.OS === "android") {
  emitter = new NativeEventEmitter(NativeModules.RNUnityAds);
}

export function initUnityAds(): void {
  if (!RNUnityAds || Platform.OS !== "android") return;
  try {
    RNUnityAds.initialize(UNITY_GAME_ID, false);
    unityInitialized = true;
    preloadAds();
  } catch (e) {
    console.warn("[UnityAds] Init failed:", e);
  }
}

function preloadAds(): void {
  if (!RNUnityAds) return;
  try {
    setTimeout(() => {
      RNUnityAds!.load(REWARDED_PLACEMENT);
      RNUnityAds!.load(INTERSTITIAL_PLACEMENT);
    }, 3000);
  } catch (_) {}
}

export function showRewardedAd(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!RNUnityAds || !emitter || Platform.OS !== "android") {
      resolve(false);
      return;
    }

    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        subscription.remove();
        resolve(false);
      }
    }, 30_000);

    const subscription = emitter.addListener("unityAdsFinished", (data: { placementId: string; state: string }) => {
      if (data.placementId === REWARDED_PLACEMENT && !settled) {
        settled = true;
        clearTimeout(timeout);
        subscription.remove();
        const earned = data.state === "COMPLETED";
        RNUnityAds!.load(REWARDED_PLACEMENT);
        resolve(earned);
      }
    });

    try {
      RNUnityAds.show(REWARDED_PLACEMENT);
    } catch (e) {
      settled = true;
      clearTimeout(timeout);
      subscription.remove();
      resolve(false);
    }
  });
}

export function showInterstitialAd(): void {
  if (!RNUnityAds || !emitter || Platform.OS !== "android") return;

  const subscription = emitter.addListener("unityAdsFinished", (data: { placementId: string }) => {
    if (data.placementId === INTERSTITIAL_PLACEMENT) {
      subscription.remove();
      RNUnityAds!.load(INTERSTITIAL_PLACEMENT);
    }
  });

  try {
    RNUnityAds.show(INTERSTITIAL_PLACEMENT);
  } catch (_) {
    subscription.remove();
  }
}

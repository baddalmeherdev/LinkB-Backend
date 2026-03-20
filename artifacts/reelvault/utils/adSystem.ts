import { Platform } from "react-native";
import { showRewardedAd as unityRewarded, showInterstitialAd as unityInterstitial } from "@/utils/unityAds";

export function showRewardedAd(): Promise<boolean> {
  if (Platform.OS === "android") {
    return unityRewarded();
  }
  return Promise.resolve(false);
}

export function showInterstitialAd(): void {
  if (Platform.OS === "android") {
    unityInterstitial();
  }
}

export function registerAdModal(_fn: unknown): void {}

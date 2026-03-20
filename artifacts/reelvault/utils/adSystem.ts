import { NativeModules, Platform } from "react-native";
import {
  showRewardedAd as unityRewarded,
  showInterstitialAd as unityInterstitial,
} from "@/utils/unityAds";

function hasUnityAds(): boolean {
  return !!NativeModules.RNUnityAds && Platform.OS === "android";
}

/**
 * Show a rewarded ad.
 * – Built APK: uses Unity Ads native rewarded ad (real money ad).
 * – Expo Go / web: uses the WebView modal fallback.
 * Returns true if the user completed the ad and earned the reward.
 */
export async function showRewardedAd(
  fallback: () => Promise<boolean>
): Promise<boolean> {
  if (hasUnityAds()) {
    return unityRewarded();
  }
  return fallback();
}

/**
 * Show an interstitial ad.
 * – Built APK: uses Unity Ads native interstitial ad.
 * – Expo Go / web: uses the WebView modal fallback.
 */
export function showInterstitialAd(fallback: () => void): void {
  if (hasUnityAds()) {
    unityInterstitial();
  } else {
    fallback();
  }
}

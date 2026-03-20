import { Platform } from "react-native";

/**
 * Show a rewarded ad using the Start.io WebView modal (primary for all users).
 * Returns true if the user completed the ad and earned the reward.
 */
export async function showRewardedAd(
  fallback: () => Promise<boolean>
): Promise<boolean> {
  if (Platform.OS === "web") return false;
  return fallback();
}

/**
 * Show an interstitial ad using the Start.io WebView modal.
 */
export function showInterstitialAd(fallback: () => void): void {
  if (Platform.OS === "web") return;
  fallback();
}

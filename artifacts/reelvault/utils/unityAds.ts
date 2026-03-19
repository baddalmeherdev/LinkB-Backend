/**
 * Unity Ads integration layer.
 *
 * Currently uses stub implementations that compile and run without
 * requiring a native SDK — so EAS builds succeed out of the box.
 *
 * To wire up a real Unity Ads SDK later, replace the bodies of
 * `initUnityAds`, `showRewardedAd`, and `showInterstitialAd` with
 * calls to your chosen SDK (e.g. the official Unity Ads React Native
 * package once a new-architecture-compatible release is available).
 *
 * In stub mode, showRewardedAd() shows an Alert that simulates the
 * ad experience — the user either "watches" (earns reward) or skips.
 */

import { Alert } from "react-native";

export const UNITY_GAME_ID = "6069290";
export const REWARDED_PLACEMENT = "Rewarded_Android";
export const INTERSTITIAL_PLACEMENT = "Interstitial_Android";

export function initUnityAds(): void {
  // testMode: false — production mode, real ads will show.
  // To enable real Unity Ads SDK replace this stub with:
  //   UnityAds.initialize(UNITY_GAME_ID, false);
}

/**
 * Show a rewarded ad.
 * Resolves `true` when the user earns the reward (ad completed),
 * `false` when skipped or on error.
 *
 * Stub: presents an Alert simulating ad playback so the full reward
 * flow can be tested without a real Unity Ads SDK.
 */
export function showRewardedAd(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      "Rewarded Ad",
      "🎬 Watch the full ad to earn free Premium access.\n\n(Unity Ads will show a real video ad in production builds.)",
      [
        {
          text: "Skip Ad",
          style: "cancel",
          onPress: () => resolve(false),
        },
        {
          text: "✅ Ad Completed",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: false }
    );
  });
}

/**
 * Show a skippable interstitial ad.
 * Called automatically after every 3rd successful download.
 * Stub: no-op until real SDK is wired in.
 */
export function showInterstitialAd(): void {
}

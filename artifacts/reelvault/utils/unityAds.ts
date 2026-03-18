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
 */

export const UNITY_GAME_ID = "6069290";
export const REWARDED_PLACEMENT = "Rewarded_Android";
export const INTERSTITIAL_PLACEMENT = "Interstitial_Android";

export function initUnityAds(): void {
}

/**
 * Show a rewarded ad.
 * Resolves `true` when the user earns the reward (ad completed),
 * `false` when skipped or on error.
 */
export function showRewardedAd(): Promise<boolean> {
  return Promise.resolve(false);
}

/**
 * Show a skippable interstitial ad.
 */
export function showInterstitialAd(): void {
}

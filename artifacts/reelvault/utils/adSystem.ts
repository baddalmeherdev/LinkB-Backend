import { Alert } from "react-native";

type ShowAdFn = (mode: "rewarded" | "interstitial", resolve: (earned: boolean) => void) => void;

let _showAd: ShowAdFn | null = null;

export function registerAdModal(fn: ShowAdFn | null) {
  _showAd = fn;
}

export function showRewardedAd(): Promise<boolean> {
  return new Promise((resolve) => {
    if (_showAd) {
      _showAd("rewarded", resolve);
    } else {
      Alert.alert(
        "Watch Ad to Unlock",
        "Watch the full ad to earn your reward.",
        [
          { text: "Skip", style: "cancel", onPress: () => resolve(false) },
          { text: "Watch Ad", onPress: () => resolve(true) },
        ],
        { cancelable: false }
      );
    }
  });
}

export function showInterstitialAd(): void {
  if (_showAd) {
    _showAd("interstitial", () => {});
  }
}

import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { showRewardedAd } from "@/utils/unityAds";

const C = Colors.dark;
const UPI_ID = "winuptournament@fam";

type Props = {
  visible: boolean;
  onClose: () => void;
};

const PERKS = [
  { icon: "hd" as const, lib: "material", label: "HD & 1080p downloads" },
  { icon: "zap" as const, lib: "feather", label: "No ads, ever" },
  { icon: "infinity" as const, lib: "feather", label: "Unlimited downloads" },
  { icon: "scissors" as const, lib: "feather", label: "Video trimming" },
  { icon: "music" as const, lib: "feather", label: "Audio extraction" },
  { icon: "star" as const, lib: "feather", label: "Priority support" },
];

function isValidUTR(utr: string): boolean {
  const cleaned = utr.trim();
  return cleaned.length >= 12 && cleaned.length <= 22 && /^[a-zA-Z0-9]+$/.test(cleaned);
}

export function PremiumModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { unlockPremium, unlockPremiumOnce } = useApp();
  const [step, setStep] = useState<"info" | "payment">("info");
  const [adLoading, setAdLoading] = useState(false);
  const [utr, setUtr] = useState("");
  const [utrError, setUtrError] = useState("");
  const [utrFocused, setUtrFocused] = useState(false);

  const handlePayViaUPI = async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const upiUrl = `upi://pay?pa=${UPI_ID}&pn=LinkB+Downloader&am=29&cu=INR&tn=LinkB+Downloader+Premium`;
    try {
      const canOpen = await Linking.canOpenURL(upiUrl);
      if (canOpen) {
        await Linking.openURL(upiUrl);
      } else {
        Alert.alert(
          "UPI App Not Found",
          `Manually pay ₹29 to:\n\nUPI ID: ${UPI_ID}\n\nEnter the UTR number below after payment.`
        );
      }
    } catch {}
    setStep("payment");
  };

  const handleSubmitUTR = async () => {
    const cleaned = utr.trim();
    if (!cleaned) {
      setUtrError("Please enter your UTR number");
      return;
    }
    if (!isValidUTR(cleaned)) {
      setUtrError("Enter a valid UTR (12-22 characters, letters and numbers only)");
      return;
    }
    setUtrError("");
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await unlockPremium();
    setStep("info");
    setUtr("");
    onClose();
    Alert.alert(
      "Premium Activated!",
      `UTR: ${cleaned}\n\nThank you! Your Premium is now active for 1 month. Renewal required after expiry.`
    );
  };

  const handleClose = () => {
    setStep("info");
    setUtr("");
    setUtrError("");
    onClose();
  };

  const handleWatchAd = async () => {
    if (adLoading) return;
    setAdLoading(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const earned = await showRewardedAd();
      if (earned) {
        await unlockPremiumOnce();
        handleClose();
        Alert.alert(
          "🎉 Premium Unlocked!",
          "You've earned 24 hours of free Premium access. Enjoy HD downloads, trimming, and more!"
        );
      } else {
        Alert.alert("Ad Skipped", "Watch the full ad to earn free Premium access.");
      }
    } catch {
      Alert.alert("Error", "Could not load the ad. Please try again.");
    } finally {
      setAdLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />

          {step === "info" ? (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.headerRow}>
                <View style={styles.crownWrap}>
                  <MaterialCommunityIcons name="crown" size={28} color={C.gold} />
                </View>
                <Pressable onPress={handleClose} style={styles.closeBtn}>
                  <Feather name="x" size={20} color={C.textSecondary} />
                </Pressable>
              </View>

              <Text style={styles.title}>LinkB Downloader Premium</Text>
              <Text style={styles.subtitle}>Unlock the full experience</Text>

              <View style={styles.priceRow}>
                <Text style={styles.price}>₹29</Text>
                <Text style={styles.pricePeriod}> / month</Text>
              </View>

              <View style={styles.perks}>
                {PERKS.map((perk, i) => (
                  <View key={i} style={styles.perkRow}>
                    <View style={styles.perkIconWrap}>
                      {perk.lib === "feather" ? (
                        <Feather name={perk.icon as any} size={16} color={C.gold} />
                      ) : (
                        <MaterialCommunityIcons name={perk.icon as any} size={16} color={C.gold} />
                      )}
                    </View>
                    <Text style={styles.perkText}>{perk.label}</Text>
                    <Feather name="check" size={16} color={C.success} />
                  </View>
                ))}
              </View>

              <Pressable
                style={({ pressed }) => [styles.payBtn, { opacity: pressed ? 0.85 : 1 }]}
                onPress={handlePayViaUPI}
              >
                <MaterialCommunityIcons name="contactless-payment" size={20} color="#000" />
                <Text style={styles.payBtnText}>Pay ₹29/month via UPI</Text>
              </Pressable>

              <Text style={styles.orDivider}>— OR —</Text>

              <Pressable
                style={({ pressed }) => [styles.watchAdBtn, { opacity: (pressed || adLoading) ? 0.7 : 1 }]}
                onPress={handleWatchAd}
                disabled={adLoading}
              >
                {adLoading ? (
                  <ActivityIndicator size="small" color={C.accent} />
                ) : (
                  <Feather name="play-circle" size={18} color={C.accent} />
                )}
                <Text style={styles.watchAdBtnText}>
                  {adLoading ? "Loading Ad…" : "Watch Ad — Free 24h Access"}
                </Text>
              </Pressable>

              <Text style={styles.upiNote}>UPI ID: {UPI_ID}</Text>
            </ScrollView>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.paymentStep}
            >
              <View style={styles.stepIconRow}>
                <View style={styles.stepDone}>
                  <Feather name="check" size={16} color={C.success} />
                </View>
                <View style={styles.stepLine} />
                <View style={[styles.stepDone, styles.stepActive]}>
                  <Text style={styles.stepNum}>2</Text>
                </View>
              </View>
              <Text style={styles.stepHint}>Step 1: Pay · Step 2: Enter UTR</Text>

              <Text style={styles.paymentTitle}>UTR Number Daalo</Text>
              <Text style={styles.paymentSubtitle}>
                Payment karne ke baad UPI app mein{"\n"}
                transaction ki details mein{" "}
                <Text style={{ color: C.gold, fontFamily: "Inter_600SemiBold" }}>UTR / Ref. No.</Text>
                {" "}milega.{"\n"}Woh yahan daalo.
              </Text>

              <View style={styles.upiReminderBox}>
                <MaterialCommunityIcons name="contactless-payment" size={18} color={C.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.upiReminderLabel}>Payment UPI ID</Text>
                  <Text style={styles.upiReminderValue}>{UPI_ID} · ₹29/month</Text>
                </View>
                <Pressable onPress={handlePayViaUPI}>
                  <Text style={styles.payAgainLink}>Pay Again</Text>
                </Pressable>
              </View>

              <View style={[styles.utrInputWrap, utrFocused && styles.utrInputFocused, !!utrError && styles.utrInputError]}>
                <Feather name="hash" size={18} color={utrError ? C.error : utrFocused ? C.accent : C.textMuted} />
                <TextInput
                  style={styles.utrInput}
                  value={utr}
                  onChangeText={(t) => {
                    setUtr(t);
                    if (utrError) setUtrError("");
                  }}
                  placeholder="UTR / Reference Number"
                  placeholderTextColor={C.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmitUTR}
                  onFocus={() => setUtrFocused(true)}
                  onBlur={() => setUtrFocused(false)}
                  selectionColor={C.accent}
                  maxLength={22}
                />
                {utr.length > 0 ? (
                  <Pressable onPress={() => { setUtr(""); setUtrError(""); }}>
                    <Feather name="x-circle" size={16} color={C.textMuted} />
                  </Pressable>
                ) : null}
              </View>

              {utrError ? (
                <View style={styles.errorRow}>
                  <Feather name="alert-circle" size={13} color={C.error} />
                  <Text style={styles.errorText}>{utrError}</Text>
                </View>
              ) : (
                <Text style={styles.utrHint}>
                  UTR/Ref No. UPI app ke transaction history mein hota hai
                </Text>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.activateBtn,
                  !utr.trim() && styles.activateBtnDisabled,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
                onPress={handleSubmitUTR}
                disabled={!utr.trim()}
              >
                <Feather name="unlock" size={18} color={utr.trim() ? "#000" : C.textMuted} />
                <Text style={[styles.activateBtnText, !utr.trim() && styles.activateBtnTextDisabled]}>
                  Premium Activate Karo
                </Text>
              </Pressable>

              <Pressable onPress={() => { setStep("info"); setUtr(""); setUtrError(""); }} style={{ marginTop: 14 }}>
                <Text style={styles.backLink}>Wapas jao</Text>
              </Pressable>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 520,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: C.surfaceBorder,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  crownWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#2A1A00",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#4A3000",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: C.text,
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  subtitle: {
    color: C.textSecondary,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginBottom: 20,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 24,
  },
  price: {
    color: C.gold,
    fontSize: 36,
    fontFamily: "Inter_700Bold",
  },
  pricePeriod: {
    color: C.textSecondary,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  perks: {
    gap: 12,
    marginBottom: 28,
  },
  perkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  perkIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#2A1A00",
    alignItems: "center",
    justifyContent: "center",
  },
  perkText: {
    flex: 1,
    color: C.text,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  payBtn: {
    backgroundColor: C.gold,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  payBtnText: {
    color: "#000",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  upiNote: {
    color: C.textMuted,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 12,
  },
  paymentStep: {
    alignItems: "center",
    paddingTop: 4,
    gap: 14,
    paddingBottom: 8,
  },
  stepIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
  },
  stepDone: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#0D2A1A",
    borderWidth: 2,
    borderColor: C.success,
    alignItems: "center",
    justifyContent: "center",
  },
  stepActive: {
    backgroundColor: "#1A1A3A",
    borderColor: C.accent,
  },
  stepLine: {
    width: 48,
    height: 2,
    backgroundColor: C.surfaceBorder,
  },
  stepNum: {
    color: C.accent,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  stepHint: {
    color: C.textMuted,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.3,
  },
  paymentTitle: {
    color: C.text,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  paymentSubtitle: {
    color: C.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  upiReminderBox: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.surfaceElevated,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  upiReminderLabel: {
    color: C.textMuted,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  upiReminderValue: {
    color: C.text,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  payAgainLink: {
    color: C.accent,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  utrInputWrap: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.surfaceBorder,
    paddingHorizontal: 14,
    gap: 10,
  },
  utrInputFocused: {
    borderColor: C.accent,
  },
  utrInputError: {
    borderColor: C.error,
    backgroundColor: "#1A0000",
  },
  utrInput: {
    flex: 1,
    color: C.text,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    paddingVertical: 15,
    letterSpacing: 0.5,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: "100%",
  },
  errorText: {
    color: C.error,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  utrHint: {
    color: C.textMuted,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    width: "100%",
  },
  activateBtn: {
    width: "100%",
    backgroundColor: C.gold,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  activateBtnDisabled: {
    backgroundColor: C.surfaceBorder,
  },
  activateBtnText: {
    color: "#000",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  activateBtnTextDisabled: {
    color: C.textMuted,
  },
  backLink: {
    color: C.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  orDivider: {
    color: C.textMuted,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 12,
    marginBottom: 4,
    letterSpacing: 1,
  },
  watchAdBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: C.accent,
    backgroundColor: "rgba(59,130,246,0.08)",
  },
  watchAdBtnText: {
    color: C.accent,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});

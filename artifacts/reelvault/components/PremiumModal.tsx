import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

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

export function PremiumModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { unlockPremium } = useApp();
  const [step, setStep] = useState<"info" | "payment">("info");

  const handlePayViaUPI = async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const upiUrl = `upi://pay?pa=${UPI_ID}&pn=ReelVault&am=99&cu=INR&tn=ReelVault+Premium`;
    try {
      const canOpen = await Linking.canOpenURL(upiUrl);
      if (canOpen) {
        await Linking.openURL(upiUrl);
        setStep("payment");
      } else {
        Alert.alert(
          "UPI App Not Found",
          `Copy UPI ID: ${UPI_ID}\n\nPay ₹99 and come back to tap "I have paid"`,
          [
            { text: "OK", onPress: () => setStep("payment") },
          ]
        );
      }
    } catch {
      setStep("payment");
    }
  };

  const handleIHavePaid = async () => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await unlockPremium();
    setStep("info");
    onClose();
    Alert.alert("Welcome to Premium!", "You now have access to all premium features.");
  };

  const handleClose = () => {
    setStep("info");
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />

          {step === "info" ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.headerRow}>
                <View style={styles.crownWrap}>
                  <MaterialCommunityIcons name="crown" size={28} color={C.gold} />
                </View>
                <Pressable onPress={handleClose} style={styles.closeBtn}>
                  <Feather name="x" size={20} color={C.textSecondary} />
                </Pressable>
              </View>

              <Text style={styles.title}>ReelVault Premium</Text>
              <Text style={styles.subtitle}>Unlock the full experience</Text>

              <View style={styles.priceRow}>
                <Text style={styles.price}>₹99</Text>
                <Text style={styles.pricePeriod}> / lifetime</Text>
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
                <Text style={styles.payBtnText}>Pay via UPI</Text>
              </Pressable>

              <Text style={styles.upiNote}>UPI ID: {UPI_ID}</Text>
            </ScrollView>
          ) : (
            <View style={styles.paymentStep}>
              <MaterialCommunityIcons name="check-circle" size={56} color={C.success} />
              <Text style={styles.paymentTitle}>Payment Sent?</Text>
              <Text style={styles.paymentSubtitle}>
                After paying ₹99 to{"\n"}
                <Text style={{ color: C.gold }}>{UPI_ID}</Text>
                {"\n"}tap below to activate Premium.
              </Text>
              <Pressable
                style={({ pressed }) => [styles.payBtn, { opacity: pressed ? 0.85 : 1, marginTop: 24 }]}
                onPress={handleIHavePaid}
              >
                <Feather name="unlock" size={18} color="#000" />
                <Text style={styles.payBtnText}>I have paid — Activate Premium</Text>
              </Pressable>
              <Pressable onPress={() => setStep("info")} style={{ marginTop: 16 }}>
                <Text style={styles.backLink}>Go back</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 500,
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
    flex: 1,
    alignItems: "center",
    paddingTop: 20,
  },
  paymentTitle: {
    color: C.text,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginTop: 16,
    marginBottom: 8,
  },
  paymentSubtitle: {
    color: C.textSecondary,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 24,
  },
  backLink: {
    color: C.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});

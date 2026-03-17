import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  Alert,
  Linking,
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

const FEATURES = [
  {
    icon: "hd-box" as const,
    lib: "material" as const,
    title: "HD & 4K Downloads",
    desc: "Download in 720p, 1080p, and beyond",
    free: false,
  },
  {
    icon: "ban" as const,
    lib: "feather" as const,
    title: "No Ads",
    desc: "Completely ad-free experience",
    free: false,
  },
  {
    icon: "download-cloud" as const,
    lib: "feather" as const,
    title: "Unlimited Downloads",
    desc: "No daily limits or restrictions",
    free: false,
  },
  {
    icon: "scissors" as const,
    lib: "feather" as const,
    title: "Video Trimming",
    desc: "Cut clips to exact start/end times",
    free: false,
  },
  {
    icon: "music" as const,
    lib: "feather" as const,
    title: "Audio Extraction",
    desc: "Extract audio from any video",
    free: true,
  },
  {
    icon: "message-square" as const,
    lib: "feather" as const,
    title: "Auto Captions",
    desc: "AI-generated video captions",
    free: true,
  },
];

export default function PremiumScreen() {
  const insets = useSafeAreaInsets();
  const { isPremium, unlockPremium } = useApp();
  const [paymentStep, setPaymentStep] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handlePayViaUPI = async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const upiUrl = `upi://pay?pa=${UPI_ID}&pn=ReelVault&am=99&cu=INR&tn=ReelVault+Premium`;
    try {
      const canOpen = await Linking.canOpenURL(upiUrl);
      if (canOpen) {
        await Linking.openURL(upiUrl);
        setPaymentStep(true);
      } else {
        Alert.alert(
          "UPI App Not Found",
          `Manually pay ₹99 to:\n\nUPI ID: ${UPI_ID}\n\nThen tap "I have paid" to unlock Premium.`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "I've paid", onPress: handleIHavePaid },
          ]
        );
      }
    } catch {
      setPaymentStep(true);
    }
  };

  const handleIHavePaid = async () => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await unlockPremium();
    setPaymentStep(false);
    Alert.alert("Welcome to Premium!", "All features are now unlocked. Enjoy!");
  };

  if (isPremium) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <LinearGradient
          colors={["#1A0F00", C.background]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.4 }}
        />
        <View style={styles.activeContainer}>
          <View style={styles.crownCircle}>
            <MaterialCommunityIcons name="crown" size={48} color={C.gold} />
          </View>
          <Text style={styles.activeTitle}>You're Premium</Text>
          <Text style={styles.activeSubtitle}>All features are unlocked. Thank you for supporting ReelVault!</Text>
          <View style={styles.activePerks}>
            {FEATURES.map((f, i) => (
              <View key={i} style={styles.activePerkRow}>
                <Feather name="check-circle" size={16} color={C.success} />
                <Text style={styles.activePerkText}>{f.title}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  if (paymentStep) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <LinearGradient
          colors={["#001A0A", C.background]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.4 }}
        />
        <ScrollView contentContainerStyle={[styles.paymentStepContent, { paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 90 }]}>
          <View style={styles.paymentStepIcon}>
            <MaterialCommunityIcons name="check-circle" size={64} color={C.success} />
          </View>
          <Text style={styles.paymentStepTitle}>Almost there!</Text>
          <Text style={styles.paymentStepSubtitle}>
            After paying ₹99 to the UPI ID below, tap the button to activate your Premium.
          </Text>
          <View style={styles.upiBox}>
            <Text style={styles.upiLabel}>UPI ID</Text>
            <Text style={styles.upiId}>{UPI_ID}</Text>
            <Text style={styles.upiAmount}>Amount: ₹99</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.activateBtn, { opacity: pressed ? 0.85 : 1 }]}
            onPress={handleIHavePaid}
          >
            <Feather name="unlock" size={18} color="#000" />
            <Text style={styles.activateBtnText}>I have paid — Activate Premium</Text>
          </Pressable>
          <Pressable onPress={() => setPaymentStep(false)} style={{ marginTop: 16 }}>
            <Text style={styles.backLink}>Go back</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <LinearGradient
        colors={["#1A0F00", C.background]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.4 }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 90 },
        ]}
      >
        <View style={styles.heroSection}>
          <View style={styles.crownCircle}>
            <MaterialCommunityIcons name="crown" size={48} color={C.gold} />
          </View>
          <Text style={styles.heroTitle}>ReelVault Premium</Text>
          <Text style={styles.heroSubtitle}>Unlock the full experience</Text>
          <View style={styles.priceTag}>
            <Text style={styles.priceAmount}>₹99</Text>
            <Text style={styles.pricePeriod}>lifetime access</Text>
          </View>
        </View>

        <View style={styles.featuresSection}>
          <Text style={styles.sectionLabel}>What you get</Text>
          {FEATURES.map((f, i) => (
            <View key={i} style={[styles.featureRow, !f.free && styles.premiumFeatureRow]}>
              <View style={[styles.featureIcon, !f.free && styles.premiumFeatureIcon]}>
                {f.lib === "material" ? (
                  <MaterialCommunityIcons name={f.icon as any} size={18} color={f.free ? C.accent : C.gold} />
                ) : (
                  <Feather name={f.icon as any} size={18} color={f.free ? C.accent : C.gold} />
                )}
              </View>
              <View style={styles.featureInfo}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
              {f.free ? (
                <View style={styles.freeBadge}>
                  <Text style={styles.freeBadgeText}>FREE</Text>
                </View>
              ) : (
                <Feather name="star" size={14} color={C.gold} />
              )}
            </View>
          ))}
        </View>

        <View style={styles.paySection}>
          <Text style={styles.sectionLabel}>Payment</Text>
          <View style={styles.upiInfoBox}>
            <MaterialCommunityIcons name="contactless-payment" size={24} color={C.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.upiInfoTitle}>Pay via UPI</Text>
              <Text style={styles.upiInfoId}>{UPI_ID}</Text>
            </View>
            <Text style={styles.upiInfoAmount}>₹99</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.payBtn, { opacity: pressed ? 0.85 : 1 }]}
            onPress={handlePayViaUPI}
          >
            <MaterialCommunityIcons name="contactless-payment" size={20} color="#000" />
            <Text style={styles.payBtnText}>Pay via UPI App</Text>
          </Pressable>
          <Text style={styles.disclaimer}>
            After payment, tap "I have paid" to unlock all features instantly.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 28,
  },
  heroSection: {
    alignItems: "center",
    paddingTop: 20,
    gap: 8,
  },
  crownCircle: {
    width: 90,
    height: 90,
    borderRadius: 24,
    backgroundColor: "#2A1A00",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#4A3000",
    marginBottom: 8,
  },
  heroTitle: {
    color: C.text,
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    color: C.textSecondary,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  priceTag: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 8,
    backgroundColor: "#2A1A00",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "#4A3000",
  },
  priceAmount: {
    color: C.gold,
    fontSize: 32,
    fontFamily: "Inter_700Bold",
  },
  pricePeriod: {
    color: C.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  featuresSection: {
    gap: 10,
  },
  sectionLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surfaceElevated,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  premiumFeatureRow: {
    borderColor: "#3D2A00",
    backgroundColor: "#0D0800",
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  premiumFeatureIcon: {
    backgroundColor: "#2A1A00",
  },
  featureInfo: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    color: C.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  featureDesc: {
    color: C.textSecondary,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  freeBadge: {
    backgroundColor: "#0D2A1A",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#1A4A2A",
  },
  freeBadgeText: {
    color: C.success,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  paySection: {
    gap: 12,
  },
  upiInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.surfaceElevated,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  upiInfoTitle: {
    color: C.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  upiInfoId: {
    color: C.textSecondary,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  upiInfoAmount: {
    color: C.gold,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
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
  disclaimer: {
    color: C.textMuted,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
  activeContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 40,
    gap: 12,
  },
  activeTitle: {
    color: C.gold,
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    marginTop: 8,
  },
  activeSubtitle: {
    color: C.textSecondary,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 8,
  },
  activePerks: {
    width: "100%",
    gap: 12,
  },
  activePerkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.surfaceElevated,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  activePerkText: {
    color: C.text,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  paymentStepContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: "center",
    gap: 16,
  },
  paymentStepIcon: {
    marginBottom: 8,
  },
  paymentStepTitle: {
    color: C.text,
    fontSize: 26,
    fontFamily: "Inter_700Bold",
  },
  paymentStepSubtitle: {
    color: C.textSecondary,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 24,
  },
  upiBox: {
    width: "100%",
    backgroundColor: C.surfaceElevated,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  upiLabel: {
    color: C.textMuted,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  upiId: {
    color: C.gold,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  upiAmount: {
    color: C.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  activateBtn: {
    width: "100%",
    backgroundColor: C.success,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  activateBtnText: {
    color: "#000",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  backLink: {
    color: C.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});

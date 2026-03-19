import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinkBLogo } from "@/components/LinkBLogo";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState, useMemo } from "react";
import {
  Alert,
  Linking,
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

const C = Colors.dark;
const UPI_ID = "winuptournament@fam";

const FEATURES = [
  {
    icon: "download-cloud" as const,
    lib: "feather" as const,
    title: "Video Download",
    desc: "Download videos from 2000+ sites",
    free: true,
    freeDetail: "Up to 720p",
    premiumDetail: "Up to 4K Ultra HD",
  },
  {
    icon: "hd-box" as const,
    lib: "material" as const,
    title: "HD & 4K Quality",
    desc: "Full 1080p, 1440p and 4K downloads",
    free: false,
    freeDetail: "Locked",
    premiumDetail: "Fully unlocked",
  },
  {
    icon: "music" as const,
    lib: "feather" as const,
    title: "Audio Extraction",
    desc: "Save any video as MP3 audio",
    free: true,
    freeDetail: "Available",
    premiumDetail: "Available",
  },
  {
    icon: "message-square" as const,
    lib: "feather" as const,
    title: "Auto Captions",
    desc: "One-click caption generation",
    free: true,
    freeDetail: "Available",
    premiumDetail: "Available",
  },
  {
    icon: "hash" as const,
    lib: "feather" as const,
    title: "Hashtag Generator",
    desc: "Smart hashtags for your videos",
    free: true,
    freeDetail: "Available",
    premiumDetail: "Available",
  },
  {
    icon: "clock" as const,
    lib: "feather" as const,
    title: "Download History",
    desc: "Re-download any previous video",
    free: true,
    freeDetail: "Last 100",
    premiumDetail: "Unlimited",
  },
  {
    icon: "scissors" as const,
    lib: "feather" as const,
    title: "Video Trimmer",
    desc: "Cut & trim videos to exact length",
    free: false,
    freeDetail: "Locked",
    premiumDetail: "Fully unlocked",
  },
  {
    icon: "shield-off" as const,
    lib: "feather" as const,
    title: "No Watermark",
    desc: "Clean downloads, no branding",
    free: false,
    freeDetail: "Watermark added",
    premiumDetail: "Clean & watermark-free",
  },
];

function isValidUTR(utr: string): boolean {
  const cleaned = utr.trim();
  return cleaned.length >= 12 && cleaned.length <= 22 && /^[a-zA-Z0-9]+$/.test(cleaned);
}

export default function PremiumScreen() {
  const insets = useSafeAreaInsets();
  const { isPremium, premiumExpiry, unlockPremium } = useApp();
  const expiryDateStr = useMemo(() => {
    if (!premiumExpiry) return null;
    return new Date(premiumExpiry).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  }, [premiumExpiry]);
  const [paymentStep, setPaymentStep] = useState(false);
  const [utr, setUtr] = useState("");
  const [utrError, setUtrError] = useState("");
  const [utrFocused, setUtrFocused] = useState(false);
  const topPad = Platform.OS === "web" ? 8 : insets.top;

  const handlePayViaUPI = async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const upiUrl = `upi://pay?pa=${UPI_ID}&pn=LinkB+Downloader&am=29&cu=INR&tn=LinkB+Downloader+Premium`;
    try {
      const canOpen = await Linking.canOpenURL(upiUrl);
      if (canOpen) {
        await Linking.openURL(upiUrl);
      } else {
        Alert.alert(
          "No UPI App Found",
          `Please send ₹29 manually:\n\nUPI ID: ${UPI_ID}\n\nEnter the UTR number after payment.`
        );
      }
    } catch {}
    setPaymentStep(true);
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
    setPaymentStep(false);
    setUtr("");
    Alert.alert(
      "Premium Active!",
      `UTR: ${cleaned}\n\nThank you! Your Premium is now active for 1 month. Renewal required after expiry.`
    );
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
        <ScrollView
          contentContainerStyle={[
            styles.activeContainer,
            { paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 90 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.crownCircle}>
            <MaterialCommunityIcons name="crown" size={48} color={C.gold} />
          </View>
          <Text style={styles.activeTitle}>Premium Active!</Text>
          <Text style={styles.activeSubtitle}>
            Thank you! Your Premium is active. All features are now unlocked.
          </Text>
          {expiryDateStr && (
            <View style={styles.expiryBadge}>
              <Feather name="calendar" size={13} color="#F59E0B" />
              <Text style={styles.expiryText}>Expires on {expiryDateStr}</Text>
            </View>
          )}
          <View style={styles.activePerks}>
            {FEATURES.map((f, i) => (
              <View key={i} style={styles.activePerkRow}>
                <Feather name="check-circle" size={16} color={C.success} />
                <Text style={styles.activePerkText}>{f.title}</Text>
                {!f.free && (
                  <MaterialCommunityIcons name="crown" size={14} color={C.gold} />
                )}
              </View>
            ))}
          </View>
        </ScrollView>
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
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.utrStepContent,
            { paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 90 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.stepIndicator}>
            <View style={styles.stepDone}>
              <Feather name="check" size={14} color={C.success} />
            </View>
            <View style={styles.stepConnector} />
            <View style={styles.stepCurrent}>
              <Feather name="hash" size={14} color={C.accent} />
            </View>
          </View>
          <Text style={styles.stepLabel}>Step 1: Pay done  ·  Step 2: Enter UTR</Text>

          <Text style={styles.utrStepTitle}>Enter UTR Number</Text>
          <Text style={styles.utrStepSubtitle}>
            After payment in your UPI app,{"\n"}
            find the{" "}
            <Text style={{ color: C.gold, fontFamily: "Inter_700Bold" }}>
              UTR / Ref. No.
            </Text>{" "}
            in your transaction history.{"\n"}Enter it below to unlock Premium.
          </Text>

          <View style={styles.upiReminderCard}>
            <View style={styles.upiReminderLeft}>
              <MaterialCommunityIcons name="contactless-payment" size={20} color={C.accent} />
              <View>
                <Text style={styles.upiReminderTitle}>Payment ID</Text>
                <Text style={styles.upiReminderValue}>{UPI_ID}</Text>
                <Text style={styles.upiReminderAmount}>₹29 · Per month</Text>
              </View>
            </View>
            <Pressable
              onPress={handlePayViaUPI}
              style={({ pressed }) => [styles.payAgainBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={styles.payAgainText}>Pay Again</Text>
            </Pressable>
          </View>

          <View style={styles.utrLabel}>
            <Feather name="hash" size={13} color={C.textSecondary} />
            <Text style={styles.utrLabelText}>UTR / Reference Number</Text>
          </View>

          <View
            style={[
              styles.utrBox,
              utrFocused && styles.utrBoxFocused,
              !!utrError && styles.utrBoxError,
            ]}
          >
            <TextInput
              style={styles.utrInput}
              value={utr}
              onChangeText={(t) => {
                setUtr(t.toUpperCase());
                if (utrError) setUtrError("");
              }}
              placeholder="e.g. 423412341234"
              placeholderTextColor={C.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              keyboardType="default"
              returnKeyType="done"
              onSubmitEditing={handleSubmitUTR}
              onFocus={() => setUtrFocused(true)}
              onBlur={() => setUtrFocused(false)}
              selectionColor={C.accent}
              maxLength={22}
            />
            {utr.length > 0 && (
              <Pressable
                onPress={() => {
                  setUtr("");
                  setUtrError("");
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x-circle" size={18} color={C.textMuted} />
              </Pressable>
            )}
          </View>

          {utrError ? (
            <View style={styles.errorRow}>
              <Feather name="alert-circle" size={13} color={C.error} />
              <Text style={styles.errorMsg}>{utrError}</Text>
            </View>
          ) : (
            <Text style={styles.utrHint}>
              UPI app → Transactions → Find this payment → Copy UTR/Ref number
            </Text>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.activateBtn,
              !utr.trim() && styles.activateBtnDisabled,
              { opacity: pressed && !!utr.trim() ? 0.85 : 1 },
            ]}
            onPress={handleSubmitUTR}
            disabled={!utr.trim()}
          >
            <Feather
              name="unlock"
              size={18}
              color={utr.trim() ? "#000" : C.textMuted}
            />
            <Text
              style={[
                styles.activateBtnText,
                !utr.trim() && styles.activateBtnTextDisabled,
              ]}
            >
              Activate Premium
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setPaymentStep(false);
              setUtr("");
              setUtrError("");
            }}
            style={{ marginTop: 4 }}
          >
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
          <View style={{ alignItems: "center", marginBottom: 10 }}>
            <LinkBLogo size={64} />
          </View>
          <View style={styles.crownCircle}>
            <MaterialCommunityIcons name="crown" size={48} color={C.gold} />
          </View>
          <Text style={styles.heroTitle}>LinkB Downloader Premium</Text>
          <Text style={styles.heroSubtitle}>Unlock the full experience</Text>
          <View style={styles.priceTag}>
            <Text style={styles.priceAmount}>₹29</Text>
            <Text style={styles.pricePeriod}>  /month</Text>
          </View>
        </View>

        <View style={styles.stepsRow}>
          <View style={styles.stepCard}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>1</Text>
            </View>
            <Text style={styles.stepCardTitle}>Pay via UPI</Text>
            <Text style={styles.stepCardDesc}>Send ₹29 to the UPI ID</Text>
          </View>
          <Feather name="arrow-right" size={18} color={C.textMuted} />
          <View style={styles.stepCard}>
            <View style={[styles.stepBadge, { backgroundColor: "#1A1A3A", borderColor: C.accent }]}>
              <Text style={[styles.stepBadgeText, { color: C.accent }]}>2</Text>
            </View>
            <Text style={styles.stepCardTitle}>Enter UTR</Text>
            <Text style={styles.stepCardDesc}>Transaction reference no.</Text>
          </View>
        </View>

        <View style={styles.featuresSection}>
          <Text style={styles.sectionLabel}>Free vs Premium</Text>
          <View style={styles.compareHeader}>
            <View style={{ flex: 2 }} />
            <View style={styles.compareCol}>
              <Text style={styles.compareColLabel}>FREE</Text>
            </View>
            <View style={[styles.compareCol, styles.compareColPremium]}>
              <MaterialCommunityIcons name="crown" size={10} color="#000" />
              <Text style={[styles.compareColLabel, { color: "#000" }]}>PREMIUM</Text>
            </View>
          </View>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.compareRow}>
              <View style={styles.compareFeatureInfo}>
                <View style={[styles.featureIconSm, !f.free && styles.premiumFeatureIcon]}>
                  {f.lib === "material" ? (
                    <MaterialCommunityIcons name={f.icon as any} size={14} color={!f.free ? C.gold : C.accent} />
                  ) : (
                    <Feather name={f.icon as any} size={14} color={!f.free ? C.gold : C.accent} />
                  )}
                </View>
                <Text style={styles.compareFeatureTitle} numberOfLines={1}>{f.title}</Text>
              </View>
              <View style={styles.compareCol}>
                {f.freeDetail === "Locked" ? (
                  <Feather name="lock" size={14} color={C.textMuted} />
                ) : f.freeDetail === "Available" ? (
                  <Feather name="check" size={14} color={C.accent} />
                ) : (
                  <Text style={styles.compareDetail}>{f.freeDetail}</Text>
                )}
              </View>
              <View style={[styles.compareCol, styles.compareColPremium]}>
                <Feather name="check" size={14} color="#000" />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.paySection}>
          <Text style={styles.sectionLabel}>Payment</Text>
          <View style={styles.upiInfoBox}>
            <MaterialCommunityIcons name="contactless-payment" size={24} color={C.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.upiInfoTitle}>UPI ID</Text>
              <Text style={styles.upiInfoId}>{UPI_ID}</Text>
            </View>
            <View style={styles.amountBadge}>
              <Text style={styles.upiInfoAmount}>₹29</Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.payBtn, { opacity: pressed ? 0.85 : 1 }]}
            onPress={handlePayViaUPI}
          >
            <MaterialCommunityIcons name="contactless-payment" size={20} color="#000" />
            <Text style={styles.payBtnText}>Pay ₹29/month via UPI</Text>
          </Pressable>
          <Text style={styles.disclaimer}>
            Enter UTR number after payment → Premium unlocks instantly
          </Text>
        </View>

        <View style={styles.warningCard}>
          <Feather name="alert-triangle" size={16} color="#F59E0B" />
          <Text style={styles.warningText}>
            <Text style={styles.warningBold}>Important: </Text>
            Premium access is stored locally on your device. If you delete or reinstall the app, your premium status cannot be recovered. We do not guarantee restoration of premium after app deletion.
          </Text>
        </View>

        <View style={styles.aboutSection}>
          <View style={styles.aboutDivider} />
          <Text style={styles.aboutAppName}>LinkB Downloader</Text>
          <Text style={styles.aboutDev}>Developed by Badal Meher</Text>
          <Text style={styles.aboutVersion}>Version 1.0.0</Text>
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
  stepsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepCard: {
    flex: 1,
    backgroundColor: C.surfaceElevated,
    borderRadius: 14,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#2A1A00",
    borderWidth: 1.5,
    borderColor: C.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeText: {
    color: C.gold,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  stepCardTitle: {
    color: C.text,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  stepCardDesc: {
    color: C.textMuted,
    fontSize: 11,
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
  compareHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    gap: 4,
  },
  compareRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surfaceElevated,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  compareFeatureInfo: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureIconSm: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  compareFeatureTitle: {
    flex: 1,
    color: C.text,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  compareCol: {
    width: 66,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  compareColPremium: {
    backgroundColor: C.gold,
    borderRadius: 8,
    paddingVertical: 4,
    flexDirection: "row",
    gap: 3,
  },
  compareColLabel: {
    color: C.textSecondary,
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  compareDetail: {
    color: C.textSecondary,
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
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
    color: C.textMuted,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.5,
  },
  upiInfoId: {
    color: C.text,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  amountBadge: {
    backgroundColor: "#2A1A00",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4A3000",
  },
  upiInfoAmount: {
    color: C.gold,
    fontSize: 16,
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
  orDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.surfaceBorder,
  },
  orText: {
    color: C.textMuted,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    letterSpacing: 1,
  },
  watchAdBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.surfaceElevated,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: C.accent + "50",
  },
  watchAdText: {
    color: C.accent,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  disclaimer: {
    color: C.textMuted,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
  activeContainer: {
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: "center",
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
  expiryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2A1A00",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#4A3000",
  },
  expiryText: {
    color: "#F59E0B",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  activePerks: {
    width: "100%",
    gap: 10,
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
    flex: 1,
    color: C.text,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  utrStepContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    alignItems: "center",
    gap: 16,
  },
  stepIndicator: {
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
  stepConnector: {
    width: 48,
    height: 2,
    backgroundColor: C.accent,
    opacity: 0.4,
  },
  stepCurrent: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#0D0D2A",
    borderWidth: 2,
    borderColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLabel: {
    color: C.textMuted,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.3,
  },
  utrStepTitle: {
    color: C.text,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  utrStepSubtitle: {
    color: C.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  upiReminderCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.surfaceElevated,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  upiReminderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  upiReminderTitle: {
    color: C.textMuted,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  upiReminderValue: {
    color: C.text,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  upiReminderAmount: {
    color: C.textSecondary,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  payAgainBtn: {
    backgroundColor: "#1A1A3A",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.accent,
  },
  payAgainText: {
    color: C.accent,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  utrLabel: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  utrLabelText: {
    color: C.textSecondary,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  utrBox: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.surfaceBorder,
    paddingHorizontal: 16,
    gap: 10,
  },
  utrBoxFocused: {
    borderColor: C.accent,
    backgroundColor: "#0A0A1E",
  },
  utrBoxError: {
    borderColor: C.error,
    backgroundColor: "#1A0000",
  },
  utrInput: {
    flex: 1,
    color: C.text,
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    paddingVertical: 16,
    letterSpacing: 1.5,
  },
  errorRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  errorMsg: {
    flex: 1,
    color: C.error,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  utrHint: {
    color: C.textMuted,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    width: "100%",
    lineHeight: 18,
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
  warningCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#1A1200",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#3D2E00",
  },
  warningText: {
    flex: 1,
    color: "#C9A93C",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  warningBold: {
    fontFamily: "Inter_700Bold",
    color: "#F59E0B",
  },
  aboutSection: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 8,
    gap: 4,
  },
  aboutDivider: {
    width: 40,
    height: 1,
    backgroundColor: C.surfaceBorder,
    marginBottom: 16,
  },
  aboutAppName: {
    color: C.textMuted,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  aboutDev: {
    color: C.textSecondary,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  aboutVersion: {
    color: C.textMuted,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
});

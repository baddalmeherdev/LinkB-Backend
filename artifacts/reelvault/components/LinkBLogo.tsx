import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Path, Circle, Ellipse } from "react-native-svg";

type Props = {
  size?: number;
};

export function LinkBLogo({ size = 40 }: Props) {
  const r = size * 0.22;
  return (
    <View style={[styles.wrapper, { width: size, height: size, borderRadius: r }]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#0A1628" />
            <Stop offset="0.45" stopColor="#0F2766" />
            <Stop offset="1" stopColor="#2563EB" />
          </LinearGradient>
          <LinearGradient id="shaftGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
            <Stop offset="1" stopColor="#93C5FD" stopOpacity="0.85" />
          </LinearGradient>
          <LinearGradient id="glowTop" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#60A5FA" stopOpacity="0.35" />
            <Stop offset="1" stopColor="#3B82F6" stopOpacity="0" />
          </LinearGradient>
          <RadialGradient id="centerGlow" cx="50%" cy="55%" r="40%">
            <Stop offset="0" stopColor="#60A5FA" stopOpacity="0.2" />
            <Stop offset="1" stopColor="#3B82F6" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Dark deep-blue background */}
        <Rect x="0" y="0" width="100" height="100" rx="22" fill="url(#bgGrad)" />

        {/* Top highlight shine */}
        <Rect x="0" y="0" width="100" height="46" rx="22" fill="url(#glowTop)" />

        {/* Center radial glow */}
        <Rect x="0" y="0" width="100" height="100" rx="22" fill="url(#centerGlow)" />

        {/* Arrow shaft */}
        <Rect x="43" y="16" width="14" height="36" rx="7" fill="url(#shaftGrad)" />

        {/* Arrow head — wide chevron */}
        <Path
          d="M25 46 L50 71 L75 46"
          stroke="url(#shaftGrad)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Base tray */}
        <Rect x="22" y="77" width="56" height="9" rx="4.5" fill="url(#shaftGrad)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: "hidden",
  },
});

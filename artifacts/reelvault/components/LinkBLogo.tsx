import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect, Path, Circle } from "react-native-svg";

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
            <Stop offset="0" stopColor="#0F2356" />
            <Stop offset="0.5" stopColor="#1A4FB5" />
            <Stop offset="1" stopColor="#3B82F6" />
          </LinearGradient>
          <LinearGradient id="iconGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="1" stopColor="#93C5FD" />
          </LinearGradient>
          <LinearGradient id="glowGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#60A5FA" stopOpacity="0.4" />
            <Stop offset="1" stopColor="#3B82F6" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Background */}
        <Rect x="0" y="0" width="100" height="100" rx="22" fill="url(#bgGrad)" />

        {/* Top glow highlight */}
        <Rect x="0" y="0" width="100" height="50" rx="22" fill="url(#glowGrad)" />

        {/* Download arrow — shaft */}
        <Rect x="44" y="18" width="12" height="34" rx="6" fill="url(#iconGrad)" />

        {/* Download arrow — chevron head */}
        <Path
          d="M28 47 L50 68 L72 47"
          stroke="url(#iconGrad)"
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Download arrow — base tray */}
        <Rect x="24" y="76" width="52" height="8" rx="4" fill="url(#iconGrad)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: "hidden",
  },
});

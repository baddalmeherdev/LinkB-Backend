import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect, Path, Circle, G } from "react-native-svg";

type Props = {
  size?: number;
};

export function LinkBLogo({ size = 40 }: Props) {
  return (
    <View style={[styles.wrapper, { width: size, height: size, borderRadius: size * 0.24 }]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#1E3A6E" />
            <Stop offset="1" stopColor="#3B82F6" />
          </LinearGradient>
          <LinearGradient id="arrowGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="1" stopColor="#B8D4FF" />
          </LinearGradient>
        </Defs>

        {/* Background */}
        <Rect x="0" y="0" width="100" height="100" rx="24" fill="url(#bgGrad)" />

        {/* Chain links (two overlapping rounded rects — link icon) */}
        {/* Left link */}
        <Rect x="14" y="38" width="24" height="14" rx="7" fill="none" stroke="#7BB8FF" strokeWidth="5" />
        {/* Right link */}
        <Rect x="34" y="48" width="24" height="14" rx="7" fill="none" stroke="#7BB8FF" strokeWidth="5" />

        {/* Download arrow - shaft */}
        <Rect x="47" y="20" width="6" height="28" rx="3" fill="url(#arrowGrad)" />
        {/* Download arrow - head (chevron down) */}
        <Path
          d="M38 44 L50 58 L62 44"
          stroke="url(#arrowGrad)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Download arrow - base line */}
        <Rect x="36" y="72" width="28" height="5" rx="2.5" fill="url(#arrowGrad)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: "hidden",
  },
});

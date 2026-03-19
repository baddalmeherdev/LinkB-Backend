import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Path,
  Circle,
  Text as SvgText,
} from "react-native-svg";

type Props = {
  size?: number;
};

export function LinkBLogo({ size = 40 }: Props) {
  const rx = size * 0.26;

  return (
    <View style={[styles.wrapper, { width: size, height: size, borderRadius: rx }]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          {/* Background — deep dark with rich blue-indigo tone */}
          <LinearGradient id="rv_bg" x1="0.2" y1="0" x2="0.8" y2="1">
            <Stop offset="0"   stopColor="#060C22" />
            <Stop offset="0.45" stopColor="#0D1A4A" />
            <Stop offset="1"   stopColor="#060C22" />
          </LinearGradient>

          {/* Blue for ring and arrow — electric, eye-catching */}
          <LinearGradient id="rv_blue_h" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0"   stopColor="#1D4FD8" />
            <Stop offset="0.5" stopColor="#3B82F6" />
            <Stop offset="1"   stopColor="#60A5FA" />
          </LinearGradient>

          {/* Blue for shaft — top to bottom */}
          <LinearGradient id="rv_blue_v" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor="#93C5FD" />
            <Stop offset="1"   stopColor="#1D4FD8" />
          </LinearGradient>

          {/* Gold badge */}
          <LinearGradient id="rv_gold" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FBBF24" />
            <Stop offset="1" stopColor="#D97706" />
          </LinearGradient>

          {/* "LB" letter fill — bright white fading to ice blue */}
          <LinearGradient id="rv_text" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor="#FFFFFF" />
            <Stop offset="0.7" stopColor="#DBEAFE" />
            <Stop offset="1"   stopColor="#93C5FD" />
          </LinearGradient>

          {/* Top glass gloss */}
          <LinearGradient id="rv_shine" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.09" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>

          {/* Central radial glow */}
          <RadialGradient id="rv_glow" cx="50%" cy="42%" r="48%">
            <Stop offset="0" stopColor="#3B82F6" stopOpacity="0.28" />
            <Stop offset="1" stopColor="#1E3A8A" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* ── Background ── */}
        <Rect x="0" y="0" width="100" height="100" rx="26" fill="url(#rv_bg)" />

        {/* ── Central glow ── */}
        <Rect x="0" y="0" width="100" height="100" rx="26" fill="url(#rv_glow)" />

        {/* ── Top glass shine ── */}
        <Rect x="0" y="0" width="100" height="50" rx="26" fill="url(#rv_shine)" />

        {/* ── Outer border glow ── */}
        <Rect
          x="1.5" y="1.5" width="97" height="97" rx="24.5"
          fill="none"
          stroke="url(#rv_blue_h)"
          strokeWidth="1.5"
          strokeOpacity="0.3"
        />

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
             DOWNLOAD RING ICON  (center: 50, 38)
             Partial circle arc — 300° open at bottom
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {/*
          Circle center (50, 38), radius 21.
          Gap at bottom (6 o'clock).
          Arc from 120° to 60° going clockwise (the long way = 300°).
          At 120°: x=50+21*cos(120°)=50-10.5=39.5,  y=38+21*sin(120°)=38+18.2=56.2
          At  60°: x=50+21*cos(60°) =50+10.5=60.5,  y=56.2
          SVG arc: M 39.5 56.2 A 21 21 0 1 1 60.5 56.2
          (large-arc=1, sweep=1 = clockwise)
        */}
        <Path
          d="M 39.5 56.2 A 21 21 0 1 1 60.5 56.2"
          fill="none"
          stroke="url(#rv_blue_h)"
          strokeWidth="4.5"
          strokeLinecap="round"
        />

        {/* ── Arrow shaft — runs top-to-bottom through the ring ── */}
        <Rect
          x="47.5" y="17" width="5" height="47" rx="2.5"
          fill="url(#rv_blue_v)"
        />

        {/* ── Arrowhead — bold, clean downward chevron ── */}
        <Path
          d="M 39 58 L 50 71 L 61 58"
          fill="url(#rv_blue_h)"
        />

        {/* ── Tray bar ── */}
        <Rect
          x="34" y="74" width="32" height="5" rx="2.5"
          fill="url(#rv_blue_h)"
        />

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━
             "LB" label at bottom
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <SvgText
          x="50"
          y="96"
          fontSize="15"
          fontWeight="800"
          fill="url(#rv_text)"
          textAnchor="middle"
          fontFamily="Arial Black, Arial, Helvetica, sans-serif"
          letterSpacing="4"
        >
          LB
        </SvgText>

        {/* ── Gold premium badge (top-right) ── */}
        {/* Diamond shape: 4-point rotated square */}
        <Path
          d="M 85 7 L 91 13 L 85 19 L 79 13 Z"
          fill="url(#rv_gold)"
        />
        {/* Tiny star/sparkle inside the diamond */}
        <Path
          d="M 85 10 L 86 13 L 85 16 L 84 13 Z"
          fill="#FFF8E7"
          opacity="0.7"
        />

        {/* ── Top-left accent dot ── */}
        <Circle cx="12" cy="12" r="2.5" fill="url(#rv_blue_h)" opacity="0.6" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: "hidden",
  },
});

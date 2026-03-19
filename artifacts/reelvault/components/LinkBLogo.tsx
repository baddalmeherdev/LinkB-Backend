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
  const rx = size * 0.22;

  return (
    <View style={[styles.wrapper, { width: size, height: size, borderRadius: rx }]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          {/* Deep dark background */}
          <LinearGradient id="lb_bg" x1="0" y1="0" x2="0.7" y2="1">
            <Stop offset="0" stopColor="#04091C" />
            <Stop offset="0.55" stopColor="#091840" />
            <Stop offset="1" stopColor="#122464" />
          </LinearGradient>

          {/* Electric blue accent lines */}
          <LinearGradient id="lb_blue" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#1D4ED8" />
            <Stop offset="0.5" stopColor="#3B82F6" />
            <Stop offset="1" stopColor="#60A5FA" />
          </LinearGradient>

          {/* Letter gradient — bright white to soft blue */}
          <LinearGradient id="lb_letter" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="0.55" stopColor="#F0F6FF" />
            <Stop offset="1" stopColor="#BFDBFE" />
          </LinearGradient>

          {/* Radial glow behind letters */}
          <RadialGradient id="lb_glow" cx="50%" cy="52%" r="44%">
            <Stop offset="0" stopColor="#3B82F6" stopOpacity="0.22" />
            <Stop offset="1" stopColor="#1E3A8A" stopOpacity="0" />
          </RadialGradient>

          {/* Top glass shine */}
          <LinearGradient id="lb_shine" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.13" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>

          {/* Gold / amber accent */}
          <LinearGradient id="lb_gold" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#F59E0B" />
            <Stop offset="1" stopColor="#FDE68A" />
          </LinearGradient>
        </Defs>

        {/* ── Background ──────────────────────────────── */}
        <Rect x="0" y="0" width="100" height="100" rx="22" fill="url(#lb_bg)" />

        {/* ── Center glow ─────────────────────────────── */}
        <Rect x="0" y="0" width="100" height="100" rx="22" fill="url(#lb_glow)" />

        {/* ── Glass shine top half ─────────────────────── */}
        <Rect x="0" y="0" width="100" height="54" rx="22" fill="url(#lb_shine)" />

        {/* ── Top accent bar ───────────────────────────── */}
        <Rect x="14" y="12" width="60" height="3" rx="1.5" fill="url(#lb_blue)" opacity="0.95" />

        {/* ── Gold dot (premium dot top-right) ─────────── */}
        <Circle cx="86" cy="13.5" r="4.5" fill="url(#lb_gold)" />

        {/* ── "LB" monogram text ───────────────────────── */}
        <SvgText
          x="50"
          y="70"
          fontSize="53"
          fontWeight="900"
          fill="url(#lb_letter)"
          textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif"
          letterSpacing="-2"
        >
          LB
        </SvgText>

        {/* ── Bottom double accent lines ────────────────── */}
        <Rect x="14" y="83" width="60" height="2.5" rx="1.25" fill="url(#lb_blue)" opacity="0.55" />
        <Rect x="24" y="87.5" width="40" height="1.5" rx="0.75" fill="url(#lb_blue)" opacity="0.3" />

        {/* ── Subtle inner-border glow ──────────────────── */}
        <Rect
          x="1.5" y="1.5" width="97" height="97" rx="21"
          fill="none"
          stroke="url(#lb_blue)"
          strokeWidth="1.5"
          strokeOpacity="0.2"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: "hidden",
  },
});

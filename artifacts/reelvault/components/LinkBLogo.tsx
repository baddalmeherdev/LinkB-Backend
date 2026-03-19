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
  Polygon,
  Text as SvgText,
  G,
} from "react-native-svg";

type Props = {
  size?: number;
};

export function LinkBLogo({ size = 40 }: Props) {
  const rx = size * 0.24;

  return (
    <View style={[styles.wrapper, { width: size, height: size, borderRadius: rx }]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          {/* Deep dark background */}
          <LinearGradient id="bg" x1="0" y1="0" x2="0.6" y2="1">
            <Stop offset="0" stopColor="#050B1F" />
            <Stop offset="0.5" stopColor="#0B1845" />
            <Stop offset="1" stopColor="#0F2060" />
          </LinearGradient>

          {/* Electric blue gradient for accents */}
          <LinearGradient id="blue_h" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#1A56DB" />
            <Stop offset="0.5" stopColor="#3B82F6" />
            <Stop offset="1" stopColor="#60A5FA" />
          </LinearGradient>

          {/* Blue vertical for arrow */}
          <LinearGradient id="blue_v" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#60A5FA" />
            <Stop offset="1" stopColor="#1A56DB" />
          </LinearGradient>

          {/* White-to-blue for LB letters */}
          <LinearGradient id="letter_grad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="0.6" stopColor="#E0EDFF" />
            <Stop offset="1" stopColor="#93C5FD" />
          </LinearGradient>

          {/* Gold gradient */}
          <LinearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FDE68A" />
            <Stop offset="1" stopColor="#F59E0B" />
          </LinearGradient>

          {/* Glass shine top */}
          <LinearGradient id="shine" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.10" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>

          {/* Center radial glow */}
          <RadialGradient id="glow" cx="50%" cy="48%" r="50%">
            <Stop offset="0" stopColor="#2563EB" stopOpacity="0.25" />
            <Stop offset="1" stopColor="#1E3A8A" stopOpacity="0" />
          </RadialGradient>

          {/* Download arrow glow */}
          <RadialGradient id="arrowglow" cx="50%" cy="65%" r="35%">
            <Stop offset="0" stopColor="#3B82F6" stopOpacity="0.4" />
            <Stop offset="1" stopColor="#1E3A8A" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* ── Background ── */}
        <Rect x="0" y="0" width="100" height="100" rx="24" fill="url(#bg)" />

        {/* ── Glow layers ── */}
        <Rect x="0" y="0" width="100" height="100" rx="24" fill="url(#glow)" />
        <Rect x="0" y="0" width="100" height="100" rx="24" fill="url(#arrowglow)" />

        {/* ── Glass shine on top half ── */}
        <Rect x="0" y="0" width="100" height="52" rx="24" fill="url(#shine)" />

        {/* ── Inner border glow ── */}
        <Rect
          x="1.5" y="1.5" width="97" height="97" rx="22.5"
          fill="none"
          stroke="url(#blue_h)"
          strokeWidth="1.2"
          strokeOpacity="0.25"
        />

        {/* ── Top accent bar ── */}
        <Rect x="16" y="10" width="55" height="2.5" rx="1.25" fill="url(#blue_h)" opacity="0.9" />

        {/* ── Gold premium dot ── */}
        <Circle cx="85" cy="11" r="4.5" fill="url(#gold)" />

        {/* ══ "LB" Monogram ══ */}
        <SvgText
          x="50"
          y="53"
          fontSize="46"
          fontWeight="900"
          fill="url(#letter_grad)"
          textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif"
          letterSpacing="-2.5"
        >
          LB
        </SvgText>

        {/* ══ Download Arrow beneath LB ══ */}
        {/* Arrow stem (vertical line) */}
        <Rect x="47.5" y="58" width="5" height="14" rx="2.5" fill="url(#blue_v)" />
        {/* Arrow head (downward pointing triangle) */}
        <Polygon
          points="37,70 50,83 63,70"
          fill="url(#blue_h)"
        />
        {/* Download tray / base bar */}
        <Rect x="32" y="86" width="36" height="4.5" rx="2.25" fill="url(#blue_h)" opacity="0.95" />

        {/* ── Bottom subtle line ── */}
        <Rect x="16" y="93" width="28" height="1.5" rx="0.75" fill="url(#blue_h)" opacity="0.25" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: "hidden",
  },
});

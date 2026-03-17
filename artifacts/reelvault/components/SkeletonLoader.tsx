import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Colors from "@/constants/colors";

const C = Colors.dark;

type Props = {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
};

export function SkeletonLoader({ width = "100%", height = 16, borderRadius = 8, style }: Props) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800 }),
        withTiming(0.3, { duration: 800 })
      ),
      -1,
      false
    );
  }, [opacity]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        { width: width as number, height, borderRadius, backgroundColor: C.surfaceBorder },
        animStyle,
        style,
      ]}
    />
  );
}

export function VideoInfoSkeleton() {
  return (
    <View style={styles.container}>
      <SkeletonLoader width="100%" height={200} borderRadius={16} />
      <View style={{ marginTop: 16, gap: 8 }}>
        <SkeletonLoader width="80%" height={20} />
        <SkeletonLoader width="50%" height={14} />
        <SkeletonLoader width="40%" height={14} />
      </View>
      <View style={{ marginTop: 20, gap: 10 }}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonLoader key={i} width="100%" height={56} borderRadius={12} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

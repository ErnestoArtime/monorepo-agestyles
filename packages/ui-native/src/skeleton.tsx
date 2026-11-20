import { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useUiTheme } from "./theme";

/**
 * Loading placeholders that keep the shape of the content still to come (AG-48).
 * They pulse softly; the container is announced once as «Cargando» and then stays silent.
 */

/** A grey block that pulses between two tones of the current theme. */
export function SkeletonBlock({
  width,
  height = 14,
  radius = 8,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { color } = useUiTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: color.quietSurface },
        { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
        style,
      ]}
    />
  );
}

/** Placeholder for a list of rows: avatar, two lines of text and a trailing value. */
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  const { color } = useUiTheme();
  return (
    <View
      accessibilityLabel="Cargando"
      accessibilityLiveRegion="polite"
      style={[styles.list, { borderColor: color.border, backgroundColor: color.surface }]}
    >
      {Array.from({ length: rows }, (_, index) => (
        <View
          key={index}
          style={[
            styles.row,
            index < rows - 1 && {
              borderBottomColor: color.border,
              borderBottomWidth: StyleSheet.hairlineWidth,
            },
          ]}
        >
          <SkeletonBlock width={36} height={36} radius={18} />
          <View style={styles.text}>
            <SkeletonBlock width={`${55 + ((index * 17) % 35)}%`} height={14} />
            <SkeletonBlock width={`${30 + ((index * 23) % 30)}%`} height={11} />
          </View>
          <SkeletonBlock width={56} height={12} />
        </View>
      ))}
    </View>
  );
}

/** Placeholder for cards in a grid: a title, a value and a line of detail. */
export function SkeletonCards({ count = 4 }: { count?: number }) {
  const { color } = useUiTheme();
  return (
    <View accessibilityLabel="Cargando" accessibilityLiveRegion="polite" style={styles.cards}>
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          style={[styles.card, { borderColor: color.border, backgroundColor: color.surface }]}
        >
          <SkeletonBlock width="60%" height={14} />
          <SkeletonBlock width="40%" height={24} />
          <SkeletonBlock width="85%" height={11} />
        </View>
      ))}
    </View>
  );
}

/** Placeholder for a row of indicator tiles (dashboards, analytics). */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  const { color } = useUiTheme();
  return (
    <View accessibilityLabel="Cargando" accessibilityLiveRegion="polite" style={styles.cards}>
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          style={[styles.stat, { borderColor: color.border, backgroundColor: color.surface }]}
        >
          <SkeletonBlock width="50%" height={11} />
          <SkeletonBlock width="70%" height={22} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  row: {
    minHeight: 68,
    paddingHorizontal: 15,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  text: { flex: 1, gap: 8 },
  cards: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    flexGrow: 1,
    flexBasis: 240,
    minHeight: 110,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  stat: {
    flexGrow: 1,
    flexBasis: 150,
    minHeight: 84,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
});

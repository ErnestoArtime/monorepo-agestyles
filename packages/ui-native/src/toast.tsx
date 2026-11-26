import { Icon } from "@agestyles/icons";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useUiTheme } from "./theme";

export type ToastTone = "success" | "error" | "info";
type ToastValue = { show: (message: string, tone?: ToastTone) => void };

const noop: ToastValue = { show: () => undefined };
const ToastContext = createContext<ToastValue>(noop);

/** Feedback for any action: `const toast = useToast(); toast.show("Añadido a favoritos")`. */
export const useToast = () => useContext(ToastContext);

type Entry = { id: number; message: string; tone: ToastTone };

/**
 * Short message at the bottom of the screen, above the tab bar, that disappears by itself. A new
 * message replaces the current one. Mount once near the root of each app.
 */
export function ToastProvider({
  children,
  bottomOffset = 84,
}: {
  children: React.ReactNode;
  /** Distance from the bottom edge; keeps the message clear of the tab bar. */
  bottomOffset?: number;
}) {
  const [entry, setEntry] = useState<Entry | null>(null);
  const counter = useRef(0);
  const show = useCallback((message: string, tone: ToastTone = "success") => {
    counter.current += 1;
    setEntry({ id: counter.current, message, tone });
  }, []);
  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastView entry={entry} bottomOffset={bottomOffset} onDone={() => setEntry(null)} />
    </ToastContext.Provider>
  );
}

function ToastView({
  entry,
  bottomOffset,
  onDone,
}: {
  entry: Entry | null;
  bottomOffset: number;
  onDone: () => void;
}) {
  const { color } = useUiTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    if (!entry) return;
    opacity.setValue(0);
    lift.setValue(12);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.timing(lift, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    const timer = setTimeout(
      () => {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(
          ({ finished }) => finished && onDone(),
        );
      },
      entry.tone === "error" ? 4200 : 2600,
    );
    return () => clearTimeout(timer);
    // The effect restarts for each new message only.
  }, [entry?.id]);

  if (!entry) return null;
  const accent =
    entry.tone === "error" ? color.error : entry.tone === "success" ? color.success : color.action;
  return (
    <View pointerEvents="none" style={[styles.layer, { bottom: bottomOffset }]}>
      <Animated.View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[
          styles.toast,
          {
            backgroundColor: color.surface,
            borderColor: color.border,
            opacity,
            transform: [{ translateY: lift }],
          },
        ]}
      >
        <Icon
          name={entry.tone === "error" ? "alert" : entry.tone === "success" ? "check" : "bell"}
          size={18}
          color={accent}
        />
        <Text style={[styles.text, { color: color.text }]}>{entry.message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: "absolute", left: 16, right: 16, alignItems: "center", zIndex: 100 },
  toast: {
    maxWidth: 520,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  text: { flexShrink: 1, fontSize: 14, fontWeight: "600" },
});

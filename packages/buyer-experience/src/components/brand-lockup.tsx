import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors } from "../constants/theme";
import { useColorScheme } from "../hooks/use-color-scheme";

export function BrandLockup() {
  const colorScheme = useColorScheme();
  const color = Colors[colorScheme ?? "light"].text;

  return (
    <View accessible accessibilityLabel="AgeStyles" style={styles.lockup}>
      <View style={styles.mark}>
        <View style={[styles.leftHalf, { borderLeftColor: color }]} />
        <View style={[styles.rightHalf, { borderRightColor: color }]} />
      </View>
      <Text style={[styles.wordmark, { color }]}>AgeStyles</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mark: {
    width: 28,
    height: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  leftHalf: {
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftWidth: 14,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },
  rightHalf: {
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderRightWidth: 14,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },
  wordmark: {
    fontSize: 18,
    fontWeight: "300",
    letterSpacing: -0.7,
  },
});

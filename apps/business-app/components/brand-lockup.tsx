import { StyleSheet, Text, View } from "react-native";

export function BrandLockup() {
  return <View accessible accessibilityLabel="AgeStyles" style={styles.lockup}>
    <View style={styles.mark}><View style={styles.leftHalf} /><View style={styles.rightHalf} /></View>
    <Text style={styles.wordmark}>AgeStyles</Text>
  </View>;
}

const markColor = "#111B2D";
const styles = StyleSheet.create({
  lockup: { flexDirection: "row", alignItems: "center", gap: 8 },
  mark: { width: 28, height: 16, flexDirection: "row", alignItems: "center" },
  leftHalf: { width: 0, height: 0, borderTopWidth: 8, borderBottomWidth: 8, borderLeftWidth: 14, borderTopColor: "transparent", borderBottomColor: "transparent", borderLeftColor: markColor },
  rightHalf: { width: 0, height: 0, borderTopWidth: 8, borderBottomWidth: 8, borderRightWidth: 14, borderTopColor: "transparent", borderBottomColor: "transparent", borderRightColor: markColor },
  wordmark: { color: markColor, fontSize: 18, fontWeight: "300", letterSpacing: -0.7 },
});

import { Colors } from "@/constants/theme";
import { Icon } from "@agestyles/icons";
import React from "react";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";

const apkUrl = process.env.EXPO_PUBLIC_ANDROID_APK_URL?.trim();

export function AndroidAppLink() {
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme];

  if (Platform.OS !== "web" || !apkUrl) return null;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.cardBackground, borderColor: theme.border },
      ]}
    >
      <View style={styles.message}>
        <Icon name="phone" size={20} color={theme.text} />
        <View style={styles.messageText}>
          <Text style={[styles.label, { color: theme.text }]}>Lleva AgeStyles contigo</Text>
          <Text style={[styles.caption, { color: theme.icon }]}>
            Versión 1.1.0 · Android 7.0 o superior
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Descargar la aplicación AgeStyles para Android"
        onPress={() => void Linking.openURL(apkUrl)}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.tint },
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={[styles.buttonText, { color: theme.onTint }]}>Descargar app Android</Text>
        <Icon name="arrowDown" size={20} color={theme.onTint} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 68,
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 8,
    padding: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  message: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
  },
  messageText: {
    flexShrink: 1,
    gap: 2,
  },
  caption: {
    fontSize: 11,
  },
  button: {
    minHeight: 42,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonPressed: {
    opacity: 0.78,
  },
  buttonText: {
    fontSize: 12,
    fontWeight: "600",
  },
});

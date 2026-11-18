import { Icon } from "@agestyles/icons";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "./ui/button";
import { Colors } from "../constants/theme";
import { useColorScheme } from "../hooks/use-color-scheme";
import { buyerHref } from "../config";

/** Empty state for screens that need a customer session. */
export function SignedOutNotice({ title, description }: { title: string; description: string }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Icon name="bell" size={28} color={colors.icon} />
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {title}
      </Text>
      <Text style={[styles.description, { color: colors.icon }]}>{description}</Text>
      <Button
        title="Iniciar sesión"
        onPress={() => router.push(buyerHref("/(drawer)/(tabs)/account/login"))}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  title: { fontSize: 18, fontWeight: "600", textAlign: "center" },
  description: { fontSize: 14, lineHeight: 21, textAlign: "center" },
  button: { alignSelf: "stretch", marginTop: 8 },
});

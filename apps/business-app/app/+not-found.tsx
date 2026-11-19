import { Icon } from "@agestyles/icons";
import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useBusinessTheme } from "../hooks/use-business-theme";

/** Unknown address in Negocio: Spanish page with the way back, never Expo's default. */
export default function NotFoundScreen() {
  const theme = useBusinessTheme();
  return (
    <>
      <Stack.Screen options={{ title: "Página no encontrada" }} />
      <View style={[styles.page, { backgroundColor: theme.background }]}>
        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Icon name="search" size={30} color={theme.action} />
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
            Esta página no existe
          </Text>
          <Text style={[styles.body, { color: theme.muted }]}>
            Revisa el enlace o vuelve al inicio de tu negocio.
          </Text>
          <Link
            href="/"
            style={[styles.primary, { backgroundColor: theme.action, color: theme.onAction }]}
          >
            Ir al inicio
          </Link>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  panel: {
    width: "100%",
    maxWidth: 440,
    padding: 28,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    gap: 12,
  },
  title: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  body: { fontSize: 15, lineHeight: 21, textAlign: "center" },
  primary: {
    marginTop: 6,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 11,
    fontSize: 15,
    fontWeight: "600",
    overflow: "hidden",
  },
});

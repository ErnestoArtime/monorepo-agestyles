import { Button } from "@/components/ui/button";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useCustomer } from "@/context/customer-context";
import { unreadLabel } from "@agestyles/api-client/notifications";
import { useOptionalNotifications } from "@agestyles/features-notifications";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function AccountScreen() {
  const { customer, loading, logout } = useCustomer();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const [signingOut, setSigningOut] = useState(false);
  const unread = useOptionalNotifications()?.unreadCount ?? 0;

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
    } catch {
      Alert.alert("No se pudo cerrar sesión", "Verifica tu conexión e inténtalo de nuevo");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { backgroundColor: colors.background }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.intro}>
        <Text style={[styles.title, { color: colors.text }]}>Tu cuenta</Text>
        <Text style={[styles.description, { color: colors.icon }]}>
          Administra tus detalles y compras.
        </Text>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.tint} />
          <Text style={{ color: colors.icon }}>Verificando tu cuenta…</Text>
        </View>
      ) : customer ? (
        <View style={styles.section}>
          <View style={[styles.profile, { borderColor: colors.border }]}>
            <Text style={[styles.name, { color: colors.text }]}>
              {[customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
                "Bienvenido de nuevo"}
            </Text>
            <Text style={{ color: colors.icon }}>{customer.email}</Text>
          </View>
          <Button
            title="Ver mis compras"
            onPress={() => router.push("/(drawer)/(tabs)/account/orders")}
          />
          <View style={[styles.rows, { borderColor: colors.border }]}>
            <Pressable
              onPress={() => router.push("/notifications")}
              accessibilityRole="button"
              accessibilityLabel={unreadLabel(unread)}
              style={({ pressed }) => [
                styles.row,
                {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>Notificaciones</Text>
                <Text style={{ color: colors.icon }}>
                  {unread > 0
                    ? `${unread} ${unread === 1 ? "aviso sin leer" : "avisos sin leer"}`
                    : "Novedades de tus pedidos"}
                </Text>
              </View>
              {unread > 0 ? (
                <View style={[styles.badge, { backgroundColor: colors.error }]}>
                  <Text style={[styles.badgeText, { color: colors.onError }]}>
                    {unread > 99 ? "99+" : unread}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              onPress={() => router.push("/notification-preferences")}
              accessibilityRole="button"
              accessibilityLabel="Avisos: elige cómo quieres recibirlos"
              style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>Avisos</Text>
                <Text style={{ color: colors.icon }}>Elige cómo quieres recibirlos</Text>
              </View>
            </Pressable>
          </View>
          <Button
            title="Cerrar sesión"
            variant="secondary"
            loading={signingOut}
            onPress={handleSignOut}
          />
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={[styles.body, { color: colors.text }]}>
            Iniciar sesión para mantener tus compras juntas y consultar su estado.
          </Text>
          <Button
            title="Iniciar sesión"
            onPress={() => router.push("/(drawer)/(tabs)/account/login")}
          />
          <Button
            title="Crear una cuenta"
            variant="secondary"
            onPress={() => router.push("/(drawer)/(tabs)/account/register")}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 24, gap: 28 },
  intro: { gap: 8, paddingTop: 8 },
  title: { fontSize: 28, fontWeight: "700" },
  description: { fontSize: 15, lineHeight: 22 },
  section: { gap: 16 },
  body: { fontSize: 16, lineHeight: 23 },
  profile: { gap: 6, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { fontSize: 18, fontWeight: "600" },
  loading: { minHeight: 100, justifyContent: "center", alignItems: "center", gap: 12 },
  rows: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, overflow: "hidden" },
  row: {
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  badge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 12, fontWeight: "700" },
});

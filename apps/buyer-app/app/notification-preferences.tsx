import { NotificationPreferences } from "@agestyles/features-notifications";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SignedOutNotice } from "@/components/signed-out-notice";
import { Colors } from "@/constants/theme";
import { useCustomer } from "@/context/customer-context";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function NotificationPreferencesScreen() {
  const { customer, loading } = useCustomer();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.tint} />
        <Text style={{ color: colors.icon }}>Verificando tu cuenta…</Text>
      </View>
    );
  }
  if (!customer) {
    return (
      <SignedOutNotice
        title="Inicia sesión para elegir tus avisos"
        description="Podrás decidir cómo quieres enterarte de las novedades de tus pedidos."
      />
    );
  }
  return (
    <SafeAreaView edges={["bottom"]} style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <NotificationPreferences app="buyer" />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
});

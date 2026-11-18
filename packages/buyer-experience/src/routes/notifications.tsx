import { NotificationInbox } from "@agestyles/features-notifications";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SignedOutNotice } from "../components/signed-out-notice";
import { Colors } from "../constants/theme";
import { useCustomer } from "../context/customer-context";
import { useColorScheme } from "../hooks/use-color-scheme";
import { openNotificationTarget } from "../lib/notification-target";

export default function NotificationsScreen() {
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
        title="Inicia sesión para ver tus avisos"
        description="Te avisaremos de cada novedad de tus pedidos cuando tengas una cuenta."
      />
    );
  }
  return (
    <SafeAreaView edges={["bottom"]} style={[styles.flex, { backgroundColor: colors.background }]}>
      <NotificationInbox onOpenTarget={(target) => openNotificationTarget(target)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
});

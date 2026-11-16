import { Button } from "@/components/ui/button";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useCustomer } from "@/context/customer-context";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";

export default function AccountScreen() {
  const { customer, loading, logout } = useCustomer();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
    } catch {
      Alert.alert("Could not sign out", "Check your connection and try again.");
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
        <Text style={[styles.title, { color: colors.text }]}>Your account</Text>
        <Text style={[styles.description, { color: colors.icon }]}>Manage your details and purchases.</Text>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.tint} />
          <Text style={{ color: colors.icon }}>Checking your account…</Text>
        </View>
      ) : customer ? (
        <View style={styles.section}>
          <View style={[styles.profile, { borderColor: colors.border }]}>
            <Text style={[styles.name, { color: colors.text }]}>
              {[customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Welcome back"}
            </Text>
            <Text style={{ color: colors.icon }}>{customer.email}</Text>
          </View>
          <Button title="View my purchases" onPress={() => router.push("/(drawer)/(tabs)/account/orders")} />
          <Button title="Sign out" variant="secondary" loading={signingOut} onPress={handleSignOut} />
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={[styles.body, { color: colors.text }]}>Sign in to keep your purchases together and see their status.</Text>
          <Button title="Sign in" onPress={() => router.push("/(drawer)/(tabs)/account/login")} />
          <Button title="Create an account" variant="secondary" onPress={() => router.push("/(drawer)/(tabs)/account/register")} />
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
});

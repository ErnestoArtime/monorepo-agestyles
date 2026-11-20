import type { ReactNode } from "react";
import { SkeletonBlock, SkeletonRows } from "@agestyles/ui-native";
import { StyleSheet, Text, View } from "react-native";
import { useAdmin } from "../context/admin-context";
import { useBusinessTheme } from "../hooks/use-business-theme";

/** Admin screens render only for a signed-in administrator; the server checks every call too. */
export function AdminGate({ children }: { children: ReactNode }) {
  const { admin, adminReady } = useAdmin();
  const theme = useBusinessTheme();
  // While the session is being checked, show the shape of the page instead of a blank screen.
  if (!adminReady)
    return (
      <View style={[styles.fill, styles.loading]}>
        <SkeletonBlock width="35%" height={30} radius={8} />
        <SkeletonBlock width="55%" height={14} />
        <View style={styles.loadingList}>
          <SkeletonRows rows={4} />
        </View>
      </View>
    );
  if (admin) return <View style={styles.fill}>{children}</View>;
  return (
    <View style={[styles.box, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>Administración del marketplace</Text>
      <Text style={[styles.text, { color: theme.muted }]}>
        Esta sección es para cuentas de administración de AgeStyles. Entra con una de ellas para
        gestionar usuarios, tiendas, pedidos y productos en revisión.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  loading: { padding: 20, gap: 12 },
  loadingList: { marginTop: 14 },
  box: { flex: 1, padding: 32, gap: 10, maxWidth: 640 },
  title: { fontSize: 24, fontWeight: "700" },
  text: { fontSize: 15, lineHeight: 22 },
});

import { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Icon } from "@agestyles/icons";
import { useBusinessTheme, type BusinessTheme } from "../hooks/use-business-theme";
export { hasPermission } from "../lib/permissions";

export function OperationList({
  title,
  subtitle,
  loading,
  error,
  empty,
  onRefresh,
  children,
}: {
  title: string;
  subtitle: string;
  loading: boolean;
  error: string;
  empty?: string;
  onRefresh?: () => void;
  children?: ReactNode;
}) {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={theme.action} />
        ) : undefined
      }
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {loading && !children ? (
        <ActivityIndicator style={{ marginTop: 28 }} color={theme.action} />
      ) : null}
      {error ? (
        <View style={styles.message}>
          <Icon name="alert" color={theme.error} />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}
      {!loading && !error && !children && empty ? (
        <View style={styles.message}>
          <Text style={styles.empty}>{empty}</Text>
        </View>
      ) : null}
      {children}
    </ScrollView>
  );
}

export function Row({
  title,
  detail,
  trailing,
  action,
  disabled,
}: {
  title: string;
  detail?: string;
  trailing?: string;
  action?: () => void;
  disabled?: boolean;
}) {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);

  const content = (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      </View>
      {trailing ? <Text style={styles.trailing}>{trailing}</Text> : null}
      {action ? <Icon name="chevronRight" color={theme.muted} size={20} /> : null}
    </View>
  );
  return action ? (
    <Pressable
      onPress={action}
      disabled={disabled}
      style={({ pressed }) => [
        styles.rowShell,
        pressed && styles.pressed,
        disabled && { opacity: 0.45 },
      ]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={styles.rowShell}>{content}</View>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const createStyles = (theme: BusinessTheme) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: theme.background },
    content: { padding: 20, paddingBottom: 42 },
    // Same weight as ui-native LargeTitle so Tienda and Negocio read as one product (AG-24).
    title: {
      color: theme.text,
      fontWeight: "700",
      fontSize: 32,
      lineHeight: 38,
      letterSpacing: -0.5,
      marginTop: 14,
    },
    subtitle: {
      color: theme.muted,
      fontSize: 15,
      lineHeight: 22,
      marginTop: 7,
      marginBottom: 22,
      maxWidth: 480,
    },
    message: {
      minHeight: 78,
      borderRadius: 14,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      marginTop: 8,
    },
    error: { color: theme.error, flex: 1, fontSize: 14, lineHeight: 20 },
    empty: { color: theme.muted, fontSize: 14, lineHeight: 20 },
    section: { marginTop: 19 },
    sectionTitle: { color: theme.text, fontWeight: "700", fontSize: 18, marginBottom: 10 },
    sectionBody: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: 14,
      overflow: "hidden",
    },
    rowShell: {
      minHeight: 68,
      paddingHorizontal: 15,
      borderBottomColor: theme.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      justifyContent: "center",
    },
    row: { flexDirection: "row", alignItems: "center", gap: 12 },
    rowText: { flex: 1, gap: 4 },
    rowTitle: { color: theme.text, fontSize: 15, fontWeight: "500" },
    rowDetail: { color: theme.muted, fontSize: 13, lineHeight: 18 },
    trailing: { color: theme.text, fontSize: 14, fontWeight: "500" },
    pressed: { opacity: 0.65 },
  });

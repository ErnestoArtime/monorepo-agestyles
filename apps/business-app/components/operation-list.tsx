import { ReactNode } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Icon } from "@agestyles/icons";
import { colors } from "@agestyles/design-tokens";

export const palette = {
  ink: colors.light.text,
  muted: colors.light.muted,
  line: colors.light.border,
  paper: colors.light.background,
  navy: colors.light.action,
  white: colors.light.surface,
  red: colors.light.error,
};

export function OperationList({ title, subtitle, loading, error, empty, onRefresh, children }: {
  title: string; subtitle: string; loading: boolean; error: string; empty?: string; onRefresh?: () => void; children?: ReactNode;
}) {
  return <ScrollView style={styles.page} contentContainerStyle={styles.content} refreshControl={onRefresh ? <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={palette.navy} /> : undefined}>
    <Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text>
    {loading && !children ? <ActivityIndicator style={{ marginTop: 28 }} color={palette.navy} /> : null}
    {error ? <View style={styles.message}><Icon name="help" color={palette.red} /><Text style={styles.error}>{error}</Text></View> : null}
    {!loading && !error && !children && empty ? <View style={styles.message}><Text style={styles.empty}>{empty}</Text></View> : null}
    {children}
  </ScrollView>;
}

export function Row({ title, detail, trailing, action, disabled }: { title: string; detail?: string; trailing?: string; action?: () => void; disabled?: boolean }) {
  const content = <View style={styles.row}><View style={styles.rowText}><Text style={styles.rowTitle}>{title}</Text>{detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}</View>{trailing ? <Text style={styles.trailing}>{trailing}</Text> : null}{action ? <Icon name="chevronRight" color={palette.muted} size={18} /> : null}</View>;
  return action ? <Pressable onPress={action} disabled={disabled} style={({ pressed }) => [styles.rowShell, pressed && styles.pressed, disabled && { opacity: 0.45 }]}>{content}</Pressable> : <View style={styles.rowShell}>{content}</View>;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><View style={styles.sectionBody}>{children}</View></View>;
}

export function hasPermission(member: { is_owner?: boolean; permissions?: Record<string, string> } | null, resource: string, minimum: "view" | "edit" = "view") {
  if (member?.is_owner) return true;
  const value = member?.permissions?.[resource];
  if (minimum === "view") return value === "view" || value === "edit" || value === "manage";
  return value === "edit" || value === "manage";
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: palette.paper }, content: { padding: 20, paddingBottom: 42 }, title: { color: palette.ink, fontWeight: "600", fontSize: 29, letterSpacing: -0.7, marginTop: 14 }, subtitle: { color: palette.muted, fontSize: 15, lineHeight: 22, marginTop: 7, marginBottom: 22, maxWidth: 480 }, message: { minHeight: 78, borderRadius: 14, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.line, padding: 16, flexDirection: "row", alignItems: "center", gap: 11, marginTop: 8 }, error: { color: palette.red, flex: 1, fontSize: 14, lineHeight: 20 }, empty: { color: palette.muted, fontSize: 14, lineHeight: 20 }, section: { marginTop: 19 }, sectionTitle: { color: palette.ink, fontWeight: "600", fontSize: 17, marginBottom: 10 }, sectionBody: { backgroundColor: palette.white, borderColor: palette.line, borderWidth: 1, borderRadius: 14, overflow: "hidden" }, rowShell: { minHeight: 68, paddingHorizontal: 15, borderBottomColor: palette.line, borderBottomWidth: StyleSheet.hairlineWidth, justifyContent: "center" }, row: { flexDirection: "row", alignItems: "center", gap: 12 }, rowText: { flex: 1, gap: 4 }, rowTitle: { color: palette.ink, fontSize: 15, fontWeight: "500" }, rowDetail: { color: palette.muted, fontSize: 13, lineHeight: 18 }, trailing: { color: palette.ink, fontSize: 14, fontWeight: "500" }, pressed: { opacity: 0.65 } });

import { Icon } from "@agestyles/icons";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { useBusinessTheme } from "../hooks/use-business-theme";
import { BrandLockup } from "./brand-lockup";

/** Public page (no session needed) for the account recovery screens. */
export function AuthScreen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.brand}>
        <BrandLockup />
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.form}>{children}</View>
    </ScrollView>
  );
}

export function AuthInput({ label, ...props }: TextInputProps & { label: string }) {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.placeholderText}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

/** Result of an action, announced to screen readers; never carries raw backend text. */
export function AuthNotice({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const error = tone === "error";
  return (
    <View
      accessibilityRole={error ? "alert" : undefined}
      accessibilityLiveRegion="polite"
      style={[styles.notice, { backgroundColor: error ? theme.errorSoft : theme.successSoft }]}
    >
      <Icon
        name={error ? "alert" : "check"}
        size={20}
        color={error ? theme.error : theme.success}
      />
      <Text style={[styles.noticeText, { color: theme.text }]}>{children}</Text>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    page: { flexGrow: 1, backgroundColor: theme.background, padding: 24, paddingTop: 56 },
    brand: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 54 },
    title: {
      fontSize: 31,
      lineHeight: 37,
      letterSpacing: -0.8,
      fontWeight: "600",
      color: theme.text,
    },
    subtitle: {
      color: theme.muted,
      fontSize: 16,
      lineHeight: 23,
      marginTop: 10,
      marginBottom: 28,
      maxWidth: 440,
    },
    form: { gap: 14, maxWidth: 440 },
    field: { gap: 8 },
    label: { color: theme.text, fontSize: 14, fontWeight: "500" },
    input: {
      height: 52,
      paddingHorizontal: 15,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: 12,
      backgroundColor: theme.surface,
      fontSize: 16,
      color: theme.text,
    },
    notice: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      padding: 14,
      borderRadius: 12,
    },
    noticeText: { flex: 1, fontSize: 14, lineHeight: 20 },
  });

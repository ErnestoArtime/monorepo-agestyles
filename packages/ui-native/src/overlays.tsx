import { Icon } from "@agestyles/icons";
import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "./components";
import { useUiTheme } from "./theme";

/**
 * Bottom sheet (product detail, order detail, date filter). Closes with the
 * backdrop, the close button or the system back gesture. On wide web screens
 * it is centred and capped in width.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Sticky actions under the scrollable content (e.g. «Añadir al carrito»). */
  footer?: React.ReactNode;
}) {
  const { color } = useUiTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdropHost}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        />
        <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: color.surface }]}>
          <View style={[styles.handle, { backgroundColor: color.border }]} />
          <View style={styles.sheetHeader}>
            {title ? (
              <Text accessibilityRole="header" style={[styles.sheetTitle, { color: color.text }]}>
                {title}
              </Text>
            ) : (
              <View />
            )}
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              hitSlop={10}
              style={styles.close}
            >
              <Icon name="close" size={22} color={color.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetContent}>{children}</ScrollView>
          {footer ? (
            <View style={[styles.sheetFooter, { borderTopColor: color.border }]}>{footer}</View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

/** Centred confirmation with a tinted message and up to two actions. */
export function ConfirmDialog({
  visible,
  title,
  message,
  tone = "success",
  primary,
  secondary,
  onClose,
}: {
  visible: boolean;
  title: string;
  message: string;
  tone?: "success" | "error" | "warning";
  primary: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
  onClose: () => void;
}) {
  const { color } = useUiTheme();
  const palette = {
    success: { fg: color.success, bg: color.successSoft, icon: "check" as const },
    error: { fg: color.error, bg: color.errorSoft, icon: "alert" as const },
    warning: { fg: color.warning, bg: color.warningSoft, icon: "alert" as const },
  }[tone];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.center, styles.backdrop]}>
        <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: color.surface }]}>
          <Text accessibilityRole="header" style={[styles.dialogTitle, { color: color.text }]}>
            {title}
          </Text>
          <View
            accessibilityRole="alert"
            style={[styles.dialogMessage, { backgroundColor: palette.bg }]}
          >
            <Text style={[styles.dialogText, { color: palette.fg }]}>{message}</Text>
            <Icon name={palette.icon} size={18} color={palette.fg} />
          </View>
          <Button title={primary.label} onPress={primary.onPress} />
          {secondary ? (
            <Button title={secondary.label} variant="secondary" onPress={secondary.onPress} />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropHost: { flex: 1, justifyContent: "flex-end" },
  backdrop: { backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    maxHeight: "92%",
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 4 },
  sheetHeader: {
    minHeight: 44,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: { fontSize: 22, fontWeight: "700", flex: 1 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  sheetContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 16 },
  sheetFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  dialog: { width: "100%", maxWidth: 420, borderRadius: 16, padding: 18, gap: 12 },
  dialogTitle: { fontSize: 18, fontWeight: "700" },
  dialogMessage: { flexDirection: "row", gap: 10, borderRadius: 12, padding: 14 },
  dialogText: { flex: 1, fontSize: 14, lineHeight: 20 },
});

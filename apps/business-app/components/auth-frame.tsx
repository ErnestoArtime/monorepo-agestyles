import { Icon } from "@agestyles/icons";
import type { ReactNode } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useBusinessTheme } from "../hooks/use-business-theme";
import { useResponsive } from "../hooks/use-responsive";
import { BrandLockup } from "./brand-lockup";

const POINTS = [
  "Pedidos, productos e inventario de tu tienda",
  "Ventas, gestores y comisiones",
  "La Tienda de AgeStyles dentro de la misma app",
];

/**
 * Frame of the sign-in and account recovery pages. A wide browser gets a website layout
 * (presentation on the left, the form in a card on the right, vertically centred); phones
 * and the app keep the full-width screen.
 */
export function AuthFrame({ children }: { children: ReactNode }) {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const { isWideWeb } = useResponsive();

  if (!isWideWeb) {
    return (
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <BrandLockup />
        </View>
        {children}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.widePage} keyboardShouldPersistTaps="handled">
      <View style={styles.wideRow}>
        <View style={styles.intro}>
          <BrandLockup />
          <Text style={styles.introTitle}>Gestiona tu negocio en AgeStyles</Text>
          <Text style={styles.introText}>
            Todo lo que necesitas para vender en el marketplace, desde el navegador o desde la app.
          </Text>
          <View style={styles.points}>
            {POINTS.map((point) => (
              <View key={point} style={styles.point}>
                <Icon name="check" size={18} color={theme.action} />
                <Text style={styles.pointText}>{point}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.card}>{children}</View>
      </View>
    </ScrollView>
  );
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    // The app keeps room for the status bar; the mobile web does not need it.
    page: {
      flexGrow: 1,
      backgroundColor: theme.background,
      padding: 24,
      paddingTop: Platform.OS === "web" ? 28 : 56,
    },
    brand: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 40 },
    widePage: {
      flexGrow: 1,
      minHeight: "100%",
      backgroundColor: theme.background,
      alignItems: "center",
      justifyContent: "center",
      padding: 40,
    },
    wideRow: {
      width: "100%",
      maxWidth: 1040,
      flexDirection: "row",
      alignItems: "center",
      gap: 64,
    },
    intro: { flex: 1, gap: 18 },
    introTitle: {
      color: theme.text,
      fontSize: 40,
      lineHeight: 46,
      fontWeight: "700",
      letterSpacing: -1,
      marginTop: 18,
    },
    introText: { color: theme.muted, fontSize: 17, lineHeight: 26, maxWidth: 460 },
    points: { gap: 12, marginTop: 6 },
    point: { flexDirection: "row", alignItems: "center", gap: 10 },
    pointText: { color: theme.text, fontSize: 15 },
    card: {
      width: 460,
      padding: 36,
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
  });

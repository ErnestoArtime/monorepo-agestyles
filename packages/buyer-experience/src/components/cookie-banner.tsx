import { useEffect, useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { getAnalyticsConsent, setAnalyticsConsent } from "../lib/analytics-consent";
import { Colors } from "../constants/theme";
import { useColorScheme } from "../hooks/use-color-scheme";

/**
 * Cookie banner for Tienda web (AG-59, Fase 4). Web only; native apps
 * render nothing. Only the statistics cookies need a choice: the cart, the
 * anonymous session id and the preferences are needed for the shop to work.
 * The full text lives in the catalog's cookie policy, which is another
 * origin, so the banner links there.
 */
export function CookieBanner() {
  const colors = Colors[useColorScheme() ?? "light"];
  const styles = createStyles(colors);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    let cancelled = false;
    void getAnalyticsConsent().then((consent) => {
      if (!cancelled) setVisible(consent === null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (Platform.OS !== "web" || !visible) return null;

  const choose = (value: "accepted" | "rejected") => {
    void setAnalyticsConsent(value).finally(() => setVisible(false));
  };

  return (
    <View style={styles.banner} role="dialog" aria-label="Cookies de estadísticas">
      <Text style={styles.text}>
        Usamos cookies de estadísticas (Google Analytics) para saber qué productos y tiendas se
        visitan. Solo se activan si aceptas.
      </Text>
      <Pressable
        accessibilityRole="link"
        onPress={() => void Linking.openURL("https://catalogo.eav-labs.com/cookies")}
      >
        <Text style={styles.link}>Política de cookies</Text>
      </Pressable>
      <View style={styles.actions}>
        <Pressable style={styles.accept} onPress={() => choose("accepted")}>
          <Text style={styles.acceptText}>Aceptar</Text>
        </Pressable>
        <Pressable style={styles.reject} onPress={() => choose("rejected")}>
          <Text style={styles.rejectText}>Rechazar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors: (typeof Colors)[keyof typeof Colors]) =>
  StyleSheet.create({
    banner: {
      position: "fixed" as "absolute",
      left: 16,
      right: 16,
      bottom: 16,
      zIndex: 60,
      // `left`/`right` already size the banner to the screen; a width of 100% on top of the
      // 16 px offsets pushed it past the right edge on phones. Auto margins centre it on desktop.
      maxWidth: 720,
      marginLeft: "auto" as unknown as number,
      marginRight: "auto" as unknown as number,
      padding: 16,
      gap: 10,
      backgroundColor: colors.cardBackground,
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 14,
      shadowColor: "#000",
      shadowOpacity: 0.18,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    text: { color: colors.text, fontSize: 14, lineHeight: 21 },
    link: { color: colors.tint, fontSize: 14, textDecorationLine: "underline" },
    actions: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
    accept: {
      backgroundColor: colors.tint,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 999,
    },
    acceptText: { color: colors.onTint, fontSize: 14, fontWeight: "700" },
    reject: {
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 999,
    },
    rejectText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  });

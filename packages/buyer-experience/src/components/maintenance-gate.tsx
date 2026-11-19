import { Icon } from "@agestyles/icons";
import React, { useEffect, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import { buyerExit, sdk } from "../config";
import { Colors } from "../constants/theme";
import { useColorScheme } from "../hooks/use-color-scheme";
import { BrandLockup } from "./brand-lockup";

type Maintenance = { enabled: boolean; title: string; message: string; back_at: string | null };

/**
 * Maintenance mode (AG-44), switched from Negocio's administration. Buyers see a page
 * instead of the shop (the buyer gateway also refuses carts and checkout meanwhile); inside
 * Negocio the team keeps the shop with a notice, to check it while they work.
 */
export function MaintenanceGate() {
  const colors = Colors[useColorScheme() ?? "light"];
  const [state, setState] = useState<Maintenance | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      sdk.client
        .fetch<{ maintenance: Maintenance }>("/store/agestyles/maintenance")
        .then(({ maintenance }) => active && setState(maintenance))
        .catch(() => undefined);
    void load();
    const timer = setInterval(load, 60_000);
    const sub = AppState.addEventListener("change", (status) => status === "active" && void load());
    return () => {
      active = false;
      clearInterval(timer);
      sub.remove();
    };
  }, []);

  if (!state?.enabled) return null;

  if (buyerExit()) {
    return (
      <View
        pointerEvents="none"
        accessibilityRole="alert"
        style={[styles.banner, { backgroundColor: colors.tint }]}
      >
        <Text style={[styles.bannerText, { color: colors.onTint }]}>
          Modo mantenimiento activo: los clientes ven la página de mantenimiento.
        </Text>
      </View>
    );
  }

  return (
    <View
      accessibilityViewIsModal
      style={[StyleSheet.absoluteFill, styles.page, { backgroundColor: colors.background }]}
    >
      <View
        style={[
          styles.card,
          { backgroundColor: colors.cardBackground, borderColor: colors.border },
        ]}
      >
        <BrandLockup />
        <Icon name="settings" size={34} color={colors.tint} />
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          {state.title}
        </Text>
        <Text style={[styles.message, { color: colors.icon }]}>{state.message}</Text>
        {state.back_at ? (
          <Text style={[styles.back, { color: colors.text }]}>Volvemos {state.back_at}.</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { zIndex: 1000, alignItems: "center", justifyContent: "center", padding: 20 },
  card: {
    width: "100%",
    maxWidth: 480,
    padding: 32,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    gap: 14,
  },
  title: { fontSize: 24, lineHeight: 30, fontWeight: "700", textAlign: "center" },
  message: { fontSize: 16, lineHeight: 24, textAlign: "center" },
  back: { fontSize: 15, fontWeight: "600", textAlign: "center" },
  banner: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 1000, padding: 8 },
  bannerText: { fontSize: 13, fontWeight: "600", textAlign: "center" },
});

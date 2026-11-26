import { followButtonLabel } from "@agestyles/api-client/store-follows";
import { Icon } from "@agestyles/icons";
import { AppSwitch, useUiTheme } from "@agestyles/ui-native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFollows } from "../context/follows-context";

type StoreRef = { id: string; name: string; handle?: string | null; logo?: string | null };

/** «Seguir» / «Siguiendo» for a store: the page of the store and «Vendido por» in the product. */
export function FollowStoreButton({ store }: { store: StoreRef }) {
  const { color } = useUiTheme();
  const { isFollowing, isBusy, toggleFollow } = useFollows();
  const following = isFollowing(store.id);
  const label = followButtonLabel(following, store.name);
  return (
    <Pressable
      onPress={() => void toggleFollow(store)}
      disabled={isBusy(store.id)}
      accessibilityRole="button"
      accessibilityLabel={label.accessibility}
      accessibilityState={{ selected: following, busy: isBusy(store.id) }}
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: following ? color.surface : color.action,
          borderColor: following ? color.border : color.action,
          opacity: isBusy(store.id) ? 0.55 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <Icon
        name={following ? "check" : "plus"}
        size={15}
        color={following ? color.text : color.onAction}
      />
      <Text style={[styles.text, { color: following ? color.text : color.onAction }]}>
        {label.text}
      </Text>
    </Pressable>
  );
}

/** The opt-in alert of a followed store; the push is off until the customer turns it on. */
export function StoreAlertSwitch({ store }: { store: StoreRef }) {
  const { color } = useUiTheme();
  const { alertOn, isBusy, setAlert } = useFollows();
  return (
    <View style={styles.alertRow}>
      <View style={styles.alertText}>
        <Text style={[styles.alertTitle, { color: color.text }]}>Avisarme de productos nuevos</Text>
        <Text style={[styles.alertHint, { color: color.muted }]}>
          Recibe un aviso en el móvil cuando {store.name} publique algo nuevo.
        </Text>
      </View>
      <AppSwitch
        value={alertOn(store.id)}
        disabled={isBusy(store.id)}
        onValueChange={(value) => void setAlert(store, value)}
        accessibilityLabel={`Avisarme de productos nuevos de ${store.name}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  text: { fontSize: 14, fontWeight: "600" },
  alertRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  alertText: { flex: 1, gap: 2 },
  alertTitle: { fontSize: 14, fontWeight: "600" },
  alertHint: { fontSize: 12, lineHeight: 17 },
});

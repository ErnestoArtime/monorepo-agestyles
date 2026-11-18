import { badgeText, unreadLabel } from "@agestyles/api-client/notifications";
import { Icon } from "@agestyles/icons";
import { useUiTheme } from "@agestyles/ui-native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useOptionalNotifications } from "./provider";

/** Header bell with the unread counter; 44 px touch target and a spoken count. */
export function NotificationBell({ onPress }: { onPress: () => void }) {
  const { color } = useUiTheme();
  const count = useOptionalNotifications()?.unreadCount ?? 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={unreadLabel(count)}
      hitSlop={6}
      style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}
    >
      <Icon name="bell" size={22} color={color.text} />
      {count > 0 ? (
        <View style={[styles.badge, { backgroundColor: color.error }]}>
          <Text style={[styles.badgeText, { color: color.onError }]}>{badgeText(count)}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
});

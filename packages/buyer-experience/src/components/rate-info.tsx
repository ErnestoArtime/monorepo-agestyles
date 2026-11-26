import { Icon } from "@agestyles/icons";
import { useUiTheme } from "@agestyles/ui-native";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

/**
 * A small «i» that explains where a CUP reference comes from («Tasa informativa · Fuente:
 * elTOQUE · fecha») only when asked, instead of repeating that line on every price. The source
 * stays one tap away, as elTOQUE's licence (CC BY 4.0) asks.
 */
export function RateInfo({
  text,
  children,
  align = "flex-end",
}: {
  text: string;
  /** What the «i» sits next to (the CUP amount), so it reads as one line with it. */
  children?: React.ReactNode;
  align?: "flex-end" | "flex-start";
}) {
  const { color } = useUiTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.wrap, { alignItems: align }]}>
      <View style={styles.row}>
        {children}
        <Pressable
          onPress={() => setOpen((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel="Información sobre la tasa de cambio"
          accessibilityState={{ expanded: open }}
          hitSlop={10}
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}
        >
          <Icon name="info" size={15} color={open ? color.action : color.muted} />
        </Pressable>
      </View>
      {open ? <Text style={[styles.text, { color: color.muted }]}>{text}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  button: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  text: { fontSize: 11, lineHeight: 15 },
});

import { Icon } from "@agestyles/icons";
import { useUiTheme } from "@agestyles/ui-native";
import React, { useState } from "react";
import { Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { publicProductUrl } from "../config";

type Shareable = { id: string; title?: string | null };

/**
 * Shares a product like the legacy catalog did: the device's share sheet when there is one
 * (phones, most mobile browsers), otherwise the link is copied and the button says so.
 */
export function ShareButton({
  product,
  price,
  variant = "icon",
}: {
  product: Shareable;
  price?: string;
  variant?: "icon" | "label";
}) {
  const { color } = useUiTheme();
  const [copied, setCopied] = useState(false);
  const title = product.title ?? "Producto";
  const url = publicProductUrl(product.id);
  const text = price ? `${title} · ${price}` : title;

  async function share() {
    try {
      if (Platform.OS !== "web") {
        await Share.share({ title, message: `${text}\n${url}`, url });
        return;
      }
      const nav = typeof navigator !== "undefined" ? navigator : undefined;
      if (nav?.share) {
        await nav.share({ title, text, url });
        return;
      }
      await nav?.clipboard?.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Closing the share sheet is not an error.
      if ((error as Error)?.name !== "AbortError") setCopied(false);
    }
  }

  const label = copied ? "Enlace copiado" : `Compartir ${title}`;
  if (variant === "label") {
    return (
      <Pressable
        onPress={() => void share()}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={styles.labelButton}
      >
        <Icon name={copied ? "check" : "share"} size={18} color={color.action} />
        <Text style={[styles.labelText, { color: color.action }]}>
          {copied ? "Enlace copiado" : "Compartir"}
        </Text>
      </Pressable>
    );
  }
  return (
    <View>
      <Pressable
        onPress={() => void share()}
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={6}
        style={[styles.round, { backgroundColor: color.surface, borderColor: color.border }]}
      >
        <Icon
          name={copied ? "check" : "share"}
          size={17}
          color={copied ? color.success : color.muted}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  round: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  labelButton: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 },
  labelText: { fontSize: 14, fontWeight: "600" },
});

import { formatPrice } from "../lib/format-price";
import { Icon } from "@agestyles/icons";
import { Stepper, useUiTheme } from "@agestyles/ui-native";
import type { HttpTypes } from "@medusajs/types";
import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface CartItemProps {
  item: HttpTypes.StoreCartLineItem;
  currencyCode?: string;
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
}

/** Cart row (reference POS style): thumbnail, name, variant, price and compact stepper. */
export const CartItem = React.memo(function CartItem({
  item,
  currencyCode,
  onUpdateQuantity,
  onRemove,
}: CartItemProps) {
  const { color } = useUiTheme();
  const title = item.product_title || item.title;
  const thumbnail = item.thumbnail || item.variant?.product?.thumbnail;
  const variant =
    item.variant_title && item.variant_title !== "Default" ? item.variant_title : null;

  return (
    <View style={[styles.row, { borderBottomColor: color.border }]}>
      <View style={[styles.thumb, { backgroundColor: color.placeholder }]}>
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Icon name="package" size={22} color={color.muted} />
        )}
      </View>
      <View style={styles.info}>
        <View style={styles.topLine}>
          <Text style={[styles.title, { color: color.text }]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={[styles.price, { color: color.text }]}>
            {formatPrice(item.subtotal || 0, currencyCode)}
          </Text>
        </View>
        {variant ? (
          <Text style={[styles.variant, { color: color.muted }]}>
            Variante: <Text style={{ color: color.text, fontWeight: "600" }}>{variant}</Text>
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Stepper
            compact
            value={item.quantity}
            min={1}
            onChange={onUpdateQuantity}
            label={`Cantidad de ${title}`}
          />
          <Pressable
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel={`Quitar ${title} del carrito`}
            hitSlop={8}
            style={styles.remove}
          >
            <Icon name="close" size={18} color={color.muted} />
          </Pressable>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1, gap: 6 },
  topLine: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  title: { flex: 1, fontSize: 15, fontWeight: "600" },
  price: { fontSize: 15, fontWeight: "600" },
  variant: { fontSize: 13 },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  remove: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});

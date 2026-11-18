import { useFavorites } from "../context/favorites-context";
import { useRegion } from "../context/region-context";
import { useCupRate } from "../hooks/use-cup-rate";
import { ShareButton } from "./share-button";
import { formatPrice } from "../lib/format-price";
import { formatCupEquivalent } from "@agestyles/api-client/exchange-rate";
import { Icon } from "@agestyles/icons";
import { ProductTile, useUiTheme } from "@agestyles/ui-native";
import type { HttpTypes } from "@medusajs/types";
import { useRouter, type Href } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { buyerPath } from "../config";

interface ProductCardProps {
  product: HttpTypes.StoreProduct;
  /** Opens the product in the catalog's bottom sheet; without it, opens the product page. */
  onOpen?: (product: HttpTypes.StoreProduct) => void;
  /** Columns of the grid this tile sits in (2 on phones, more on wide screens). */
  columns?: number;
}

/** Grid tile (reference POS style) with favourite toggle and CUP reference price. */
export const ProductCard = React.memo(function ProductCard({
  product,
  onOpen,
  columns = 2,
}: ProductCardProps) {
  const router = useRouter();
  const { color } = useUiTheme();
  const { selectedRegion } = useRegion();
  const cupRate = useCupRate();
  const { isFavorite, toggleFavorite, ready } = useFavorites();
  const favorite = isFavorite(product.id);

  const imageUrl = product.thumbnail || product.images?.[0]?.url;
  const amount = product.variants?.[0]?.calculated_price?.calculated_amount ?? undefined;
  const currency = selectedRegion?.currency_code;
  const open = () =>
    onOpen
      ? onOpen(product)
      : router.push({
          pathname: buyerPath(`/(drawer)/(tabs)/(home)/product/${product.id}`),
          params: { title: product.title },
        } as unknown as Href);

  return (
    <View style={[styles.cell, { maxWidth: `${100 / columns}%` }]}>
      <ProductTile
        title={product.title ?? "Producto"}
        price={amount === undefined ? "Consultar precio" : formatPrice(amount, currency)}
        secondaryPrice={formatCupEquivalent(amount, currency, cupRate)}
        imageUrl={imageUrl}
        onPress={open}
        accessory={
          <View style={styles.accessories}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                favorite
                  ? `Quitar ${product.title} de favoritos`
                  : `Guardar ${product.title} en favoritos`
              }
              accessibilityState={{ selected: favorite }}
              disabled={!ready}
              onPress={() => void toggleFavorite(product.id).catch(() => undefined)}
              hitSlop={6}
              style={[
                styles.favorite,
                { backgroundColor: color.surface, borderColor: color.border },
              ]}
            >
              {/* A saved favourite is a filled red heart, as in the legacy catalog. */}
              <Icon
                name="heart"
                size={18}
                color={favorite ? color.error : color.muted}
                fill={favorite ? color.error : "none"}
              />
            </Pressable>
            <ShareButton
              product={product}
              price={amount === undefined ? undefined : formatPrice(amount, currency)}
            />
          </View>
        }
      />
      {/* Same as the Catálogo: «Agregar» opens the quick view to choose store, variant and quantity. */}
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`Agregar ${product.title ?? "producto"} al carrito`}
        style={({ pressed }: { pressed: boolean }) => [
          styles.add,
          {
            borderColor: color.border,
            backgroundColor: pressed ? color.placeholder : color.surface,
          },
        ]}
      >
        <Icon name="shoppingBag" size={16} color={color.text} />
        <Text style={[styles.addText, { color: color.text }]}>Agregar</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  cell: { flex: 1, padding: 6 },
  accessories: { gap: 8 },
  add: {
    marginTop: 8,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addText: { fontSize: 14, fontWeight: "600" },
  favorite: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
});

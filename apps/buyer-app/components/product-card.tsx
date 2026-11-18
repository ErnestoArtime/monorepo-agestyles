import { useFavorites } from "@/context/favorites-context";
import { useRegion } from "@/context/region-context";
import { useCupRate } from "@/hooks/use-cup-rate";
import { formatPrice } from "@/lib/format-price";
import { formatCupEquivalent } from "@agestyles/api-client/exchange-rate";
import { Icon } from "@agestyles/icons";
import { ProductTile, useUiTheme } from "@agestyles/ui-native";
import type { HttpTypes } from "@medusajs/types";
import { useRouter, type Href } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

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

  return (
    <View style={[styles.cell, { maxWidth: `${100 / columns}%` }]}>
      <ProductTile
        title={product.title ?? "Producto"}
        price={amount === undefined ? "Consultar precio" : formatPrice(amount, currency)}
        secondaryPrice={formatCupEquivalent(amount, currency, cupRate)}
        imageUrl={imageUrl}
        onPress={() =>
          onOpen
            ? onOpen(product)
            : router.push({
                pathname: `/(home)/product/${product.id}`,
                params: { title: product.title },
              } as unknown as Href)
        }
        accessory={
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
            style={[styles.favorite, { backgroundColor: color.surface, borderColor: color.border }]}
          >
            <Icon name="heart" size={18} color={favorite ? color.action : color.muted} />
          </Pressable>
        }
      />
    </View>
  );
});

const styles = StyleSheet.create({
  cell: { flex: 1, padding: 6 },
  favorite: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
});

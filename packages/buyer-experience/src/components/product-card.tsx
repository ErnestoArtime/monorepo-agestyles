import { mediaVariant } from "@agestyles/api-client/media";
import { useCart } from "../context/cart-context";
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
  /** Offer to add straight to the cart (single variant, single available offer). */
  directOfferId?: string;
}

/** Grid tile (reference POS style) with favourite toggle and CUP reference price. */
export const ProductCard = React.memo(function ProductCard({
  product,
  onOpen,
  columns = 2,
  directOfferId,
}: ProductCardProps) {
  const { addToCart } = useCart();
  const [adding, setAdding] = React.useState<"idle" | "busy" | "done" | "error">("idle");
  const router = useRouter();
  const { color } = useUiTheme();
  const { selectedRegion } = useRegion();
  const cupRate = useCupRate();
  const { isFavorite, toggleFavorite, ready } = useFavorites();
  const favorite = isFavorite(product.id);

  // Cards are small: the 400 px variant is enough even on dense screens (AG-36).
  const imageUrl = mediaVariant(product.thumbnail || product.images?.[0]?.url, 400);
  const amount = product.variants?.[0]?.calculated_price?.calculated_amount ?? undefined;
  const currency = selectedRegion?.currency_code;
  async function addDirect(offerId: string) {
    setAdding("busy");
    try {
      await addToCart(offerId, 1);
      setAdding("done");
    } catch {
      setAdding("error");
    } finally {
      setTimeout(() => setAdding("idle"), 2000);
    }
  }
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
        store={
          typeof product.metadata?.store_label === "string" ? product.metadata.store_label : null
        }
        imageUrl={imageUrl}
        onPress={open}
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
            {/* A saved favourite is a filled red heart, as in the legacy catalog. */}
            <Icon
              name="heart"
              size={18}
              color={favorite ? color.error : color.muted}
              fill={favorite ? color.error : "none"}
            />
          </Pressable>
        }
      />
      <View style={styles.actions}>
        {/* With one variant and one available offer «Agregar» adds it at once; otherwise it
            opens the quick view to choose store, variant and quantity (as in the Catálogo). */}
        <Pressable
          onPress={directOfferId ? () => void addDirect(directOfferId) : open}
          disabled={adding === "busy"}
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
          <Icon
            name={adding === "done" ? "check" : "shoppingBag"}
            size={16}
            color={adding === "done" ? color.success : color.text}
          />
          <Text style={[styles.addText, { color: adding === "error" ? color.error : color.text }]}>
            {adding === "busy"
              ? "Agregando…"
              : adding === "done"
                ? "Añadido"
                : adding === "error"
                  ? "No se pudo"
                  : "Agregar"}
          </Text>
        </Pressable>
        {/* Next to «Agregar», not on the photo, so the image keeps all its detail. */}
        <ShareButton
          product={product}
          price={amount === undefined ? undefined : formatPrice(amount, currency)}
          variant="button"
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  cell: { flex: 1, padding: 6 },
  actions: { flexDirection: "row", gap: 8, marginTop: 8 },
  add: {
    flex: 1,
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

import { Icon } from "@agestyles/icons";
import { useUiTheme } from "@agestyles/ui-native";
import { useRouter, type Href } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { buyerPath } from "../config";
import { useRegion } from "../context/region-context";
import { useResponsive } from "../hooks/use-responsive";
import { cardAsProduct, fetchCatalog, type CatalogCard } from "../lib/storefront";
import { FeaturedRow } from "./featured-row";
import { ProductCard } from "./product-card";

/** Opens a store's page in the catalog (its cover, banners and products). */
export function useOpenStore() {
  const router = useRouter();
  return (seller: { id: string; name: string }) =>
    router.push({
      pathname: buyerPath("/(drawer)/(tabs)/(home)"),
      params: { filtro: "tienda", tienda: seller.id, nombre: seller.name },
    } as unknown as Href);
}

/** «Ver la tienda» link used in the product page, the quick view and the sections below. */
export function StoreLink({
  seller,
  label,
  onBeforeOpen,
}: {
  seller: { id: string; name: string };
  label?: string;
  onBeforeOpen?: () => void;
}) {
  const { color } = useUiTheme();
  const openStore = useOpenStore();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Ver la tienda ${seller.name}`}
      onPress={() => {
        onBeforeOpen?.();
        openStore(seller);
      }}
      hitSlop={6}
      style={styles.link}
    >
      <Icon name="store" size={16} color={color.action} />
      <Text style={[styles.linkText, { color: color.action }]}>{label ?? seller.name}</Text>
      <Icon name="arrowRight" size={14} color={color.action} />
    </Pressable>
  );
}

/**
 * Below a product page: more from the same store (a swipeable row) and related products
 * from the same categories (a grid). Both come from the server catalog, so only what can be
 * bought now appears.
 */
export function ProductExtras({
  productId,
  categoryIds,
  seller,
}: {
  productId: string;
  categoryIds: string[];
  seller: { id: string; name: string } | null;
}) {
  const { selectedRegion } = useRegion();
  const { isWideWeb, columns } = useResponsive();
  const [sameStore, setSameStore] = useState<CatalogCard[]>([]);
  const [related, setRelated] = useState<CatalogCard[]>([]);
  const regionId = selectedRegion?.id;
  const sellerId = seller?.id;
  const categoriesKey = categoryIds.join(",");

  useEffect(() => {
    if (!regionId || !sellerId) {
      setSameStore([]);
      return;
    }
    let active = true;
    fetchCatalog({ regionId, sellerId, sort: "featured", limit: 13 })
      .then((page) => {
        if (active)
          setSameStore(page.products.filter((card) => card.id !== productId).slice(0, 12));
      })
      .catch(() => active && setSameStore([]));
    return () => {
      active = false;
    };
  }, [productId, regionId, sellerId]);

  useEffect(() => {
    if (!regionId || !categoriesKey) {
      setRelated([]);
      return;
    }
    let active = true;
    fetchCatalog({ regionId, categoryIds: categoriesKey.split(","), sort: "featured", limit: 13 })
      .then((page) => {
        if (active)
          setRelated(
            page.products
              .filter((card) => card.id !== productId)
              .slice(0, Math.max(columns * 2, 4)),
          );
      })
      .catch(() => active && setRelated([]));
    return () => {
      active = false;
    };
  }, [categoriesKey, columns, productId, regionId]);

  if (!sameStore.length && !related.length) return null;
  return (
    <View style={styles.extras}>
      {seller && sameStore.length ? (
        <FeaturedRow
          title={`Más de ${seller.name}`}
          cards={sameStore}
          tileWidth={isWideWeb ? 230 : 168}
          action={<StoreLink seller={seller} label="Ver la tienda" />}
        />
      ) : null}
      {related.length ? (
        <View style={styles.related}>
          <RelatedTitle />
          <View style={styles.grid}>
            {related.map((card) => (
              // A fixed width per column: the card itself grows to fill it.
              <View key={card.id} style={{ width: `${100 / columns}%` }}>
                <ProductCard
                  product={cardAsProduct(card)}
                  columns={1}
                  directOfferId={card.direct_offer_id ?? undefined}
                />
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function RelatedTitle() {
  const { color } = useUiTheme();
  return (
    <Text accessibilityRole="header" style={[styles.title, { color: color.text }]}>
      Artículos relacionados
    </Text>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  linkText: { fontSize: 14, fontWeight: "600" },
  extras: { marginTop: 12, paddingBottom: 12 },
  related: { marginTop: 26, gap: 6 },
  title: { fontSize: 21, fontWeight: "600", letterSpacing: -0.35, marginHorizontal: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 10 },
});

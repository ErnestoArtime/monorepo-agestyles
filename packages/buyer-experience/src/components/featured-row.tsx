import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Colors } from "../constants/theme";
import { useColorScheme } from "../hooks/use-color-scheme";
import { cardAsProduct, type CatalogCard } from "../lib/storefront";
import type { HttpTypes } from "@medusajs/types";
import { ProductCard } from "./product-card";

/** «Destacados» (AG-34): the products the administration features, in a horizontal row. */
export function FeaturedRow({
  cards,
  tileWidth,
  onOpen,
}: {
  cards: CatalogCard[];
  tileWidth: number;
  onOpen: (product: HttpTypes.StoreProduct) => void;
}) {
  const colors = Colors[useColorScheme() ?? "light"];
  if (!cards.length) return null;
  return (
    <View style={styles.section} accessibilityLabel="Productos destacados">
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        Destacados
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {cards.map((card) => (
          <View key={card.id} style={{ width: tileWidth }}>
            <ProductCard
              product={cardAsProduct(card)}
              onOpen={onOpen}
              columns={1}
              directOfferId={card.direct_offer_id ?? undefined}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 22, gap: 6 },
  title: { fontSize: 21, fontWeight: "600", letterSpacing: -0.35, marginHorizontal: 16 },
  row: { paddingHorizontal: 10 },
});

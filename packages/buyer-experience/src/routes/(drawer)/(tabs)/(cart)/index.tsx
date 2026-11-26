import { CartItem } from "../../../../components/cart-item";
import { Loading } from "../../../../components/loading";
import { useCart } from "../../../../context/cart-context";
import { useCupRate } from "../../../../hooks/use-cup-rate";
import { formatPrice } from "../../../../lib/format-price";
import { formatCupEquivalent, rateSourceLine } from "@agestyles/api-client/exchange-rate";
import { Icon } from "@agestyles/icons";
import { Button, KeyValueRow, useUiTheme } from "@agestyles/ui-native";
import { useRouter } from "expo-router";
import React from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { buyerHref } from "../../../../config";

/** Cart (reference POS style): line rows, totals pinned at the bottom with two actions. */
export default function CartScreen() {
  const { color } = useUiTheme();
  const router = useRouter();
  const { cart, updateItemQuantity, removeItem, loading } = useCart();
  const cupRate = useCupRate();

  if (loading && !cart) return <Loading message="Cargando carrito…" />;

  if (!cart?.items?.length) {
    return (
      <View style={[styles.empty, { backgroundColor: color.background }]}>
        <View style={[styles.emptyMark, { backgroundColor: color.surface }]}>
          <Icon name="shoppingBag" size={32} color={color.action} />
        </View>
        <Text style={[styles.emptyTitle, { color: color.text }]}>Tu carrito está vacío</Text>
        <Text style={[styles.emptyText, { color: color.muted }]}>
          Añade productos desde el catálogo para empezar.
        </Text>
        <Button
          title="Explorar productos"
          onPress={() => router.navigate(buyerHref("/(drawer)/(tabs)/(home)"))}
        />
      </View>
    );
  }

  const currency = cart.currency_code;
  const cup = formatCupEquivalent(cart.total, currency, cupRate);
  const cupSource = cup ? rateSourceLine(cupRate) : null;
  const units = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <View style={[styles.screen, { backgroundColor: color.background }]}>
      <FlatList
        data={cart.items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          // The header already says «Carrito»; only the count is new information.
          <Text
            style={{ color: color.muted, fontSize: 14, paddingHorizontal: 4, paddingBottom: 8 }}
          >
            {`${units} ${units === 1 ? "artículo" : "artículos"}`}
          </Text>
        }
        renderItem={({ item }) => (
          <CartItem
            item={item}
            currencyCode={currency}
            onUpdateQuantity={(quantity) => updateItemQuantity(item.id, quantity)}
            onRemove={() => removeItem(item.id)}
          />
        )}
      />
      <View
        style={[styles.footer, { backgroundColor: color.surface, borderTopColor: color.border }]}
      >
        <KeyValueRow label="Subtotal" value={formatPrice(cart.item_subtotal, currency)} />
        {cart.shipping_total ? (
          <KeyValueRow label="Envío" value={formatPrice(cart.shipping_total, currency)} />
        ) : null}
        {cart.tax_total ? (
          <KeyValueRow label="Impuestos" value={formatPrice(cart.tax_total, currency)} />
        ) : null}
        <KeyValueRow label="Total" value={formatPrice(cart.total, currency)} emphasis />
        {cup ? (
          <Text style={[styles.cup, { color: color.muted }]}>
            {cup} · referencia, se cobra en USD
          </Text>
        ) : null}
        {cupSource ? (
          <Text style={[styles.cupSource, { color: color.muted }]}>{cupSource}</Text>
        ) : null}
        <View style={styles.actions}>
          <Button
            title="Seguir comprando"
            variant="secondary"
            onPress={() => router.navigate(buyerHref("/(drawer)/(tabs)/(home)"))}
            style={styles.action}
          />
          <Button
            title="Ir a pagar"
            onPress={() => router.push(buyerHref("/checkout"))}
            loading={loading}
            style={styles.action}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cup: { fontSize: 12, textAlign: "right", marginBottom: 4 },
  cupSource: { fontSize: 11, textAlign: "right", marginBottom: 8 },
  actions: { flexDirection: "row", gap: 12, marginTop: 10 },
  action: { flex: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  emptyMark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 22, fontWeight: "700" },
  emptyText: { fontSize: 15, textAlign: "center", marginBottom: 8 },
});

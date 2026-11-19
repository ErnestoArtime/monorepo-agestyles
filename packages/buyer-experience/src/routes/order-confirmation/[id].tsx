import { mediaVariant } from "@agestyles/api-client/media";
import { Loading } from "../../components/loading";
import { Button } from "../../components/ui/button";
import { Icon } from "@agestyles/icons";
import { Colors } from "../../constants/theme";
import { useCart } from "../../context/cart-context";
import { useColorScheme } from "../../hooks/use-color-scheme";
import { formatPrice } from "../../lib/format-price";
import { getPaymentProviderInfo } from "../../lib/payment-providers";
import { sdk } from "../../config";
import type { HttpTypes } from "@medusajs/types";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { buyerHref } from "../../config";

export default function OrderConfirmationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { clearCart } = useCart();

  const [order, setOrder] = useState<HttpTypes.StoreOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasCleared = useRef(false);

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { order: fetchedOrder } = await sdk.store.order.retrieve(id, {
        fields: "*payment_collections.payments",
      });
      setOrder(fetchedOrder);
    } catch (err) {
      console.error("Failed to fetch order:", err);
      setError("No se pudieron cargar los detalles del pedido.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Fetch order when id changes
  useEffect(() => {
    if (id) {
      fetchOrder();
    }
  }, [id, fetchOrder]);

  // Clear cart when order confirmation page loads (only once)
  useEffect(() => {
    if (!hasCleared.current) {
      hasCleared.current = true;
      clearCart();
    }
  }, [clearCart]);

  if (loading) {
    return <Loading message="Cargando detalles del pedido..." />;
  }

  if (error || !order) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>
          {error || "Pedido no encontrado"}
        </Text>
        <Button
          title="Ir al inicio"
          onPress={() => {
            // Reset to home screen and clear the navigation stack
            router.dismissAll();
            router.replace(buyerHref("/(drawer)/(tabs)/(home)"));
          }}
          style={styles.button}
        />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={[styles.successIcon, { backgroundColor: colors.success }]}>
          <Icon name="check" size={28} color={colors.onSuccess} />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>¡Pedido confirmado!</Text>
        <Text style={[styles.subtitle, { color: colors.icon }]}>
          Hemos recibido tu pedido y lo procesaremos lo antes posible.
        </Text>

        <Button
          title="Seguir comprando"
          onPress={() => {
            // Reset to home screen and clear the navigation stack
            router.dismissAll();
            router.replace(buyerHref("/(drawer)/(tabs)/(home)"));
          }}
          style={styles.continueButton}
        />

        <View
          style={[
            styles.card,
            { backgroundColor: colors.background, borderColor: colors.icon + "30" },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>Detalles del pedido</Text>

          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.icon }]}>Número de pedido</Text>
            <Text style={[styles.value, { color: colors.text }]}>{order.display_id}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.icon }]}>Correo electrónico</Text>
            <Text style={[styles.value, { color: colors.text }]}>{order.email}</Text>
          </View>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.background, borderColor: colors.icon + "30" },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>Artículos del pedido</Text>

          {order.items?.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.itemRow,
                index === order.items!.length - 1 && styles.lastItemRow,
                { borderBottomColor: colors.icon + "30" },
              ]}
            >
              <Image
                source={{
                  uri: mediaVariant(item.thumbnail, 400) || "https://via.placeholder.com/60",
                }}
                style={[styles.itemImage, { backgroundColor: colors.imagePlaceholder }]}
                contentFit="cover"
              />
              <View style={styles.itemInfo}>
                <Text style={[styles.itemTitle, { color: colors.text }]}>
                  {item.product_title || item.title}
                </Text>
                {item.variant_title && (
                  <Text style={[styles.itemVariant, { color: colors.icon }]}>
                    {item.variant_title}
                  </Text>
                )}
                <Text style={[styles.itemQuantity, { color: colors.icon }]}>
                  Cantidad: {item.quantity}
                </Text>
              </View>
              <Text style={[styles.itemPrice, { color: colors.text }]}>
                {formatPrice(item.subtotal, order.currency_code)}
              </Text>
            </View>
          ))}
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.background, borderColor: colors.icon + "30" },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>Envío</Text>

          {order.shipping_address && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Dirección de envío</Text>
              <Text style={[styles.addressText, { color: colors.text }]}>
                {order.shipping_address.first_name} {order.shipping_address.last_name}
              </Text>
              <Text style={[styles.addressText, { color: colors.text }]}>
                {order.shipping_address.address_1}
              </Text>
              <Text style={[styles.addressText, { color: colors.text }]}>
                {order.shipping_address.city}, {order.shipping_address.postal_code}
              </Text>
              <Text style={[styles.addressText, { color: colors.text }]}>
                {order.shipping_address.country_code?.toUpperCase()}
              </Text>
            </>
          )}

          {order.shipping_methods && order.shipping_methods.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Método de envío</Text>
              {order.shipping_methods.map((method) => (
                <Text key={method.id} style={[styles.addressText, { color: colors.text }]}>
                  {method.name} - {formatPrice(method.amount || 0, order.currency_code)}
                </Text>
              ))}
            </>
          )}
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.background, borderColor: colors.icon + "30" },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>Pago</Text>

          {order.payment_collections && order.payment_collections.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Método de pago</Text>
              {order.payment_collections[0].payments?.map((payment) => {
                const providerInfo = getPaymentProviderInfo(payment.provider_id);
                return (
                  <View key={payment.id} style={styles.paymentMethodRow}>
                    <Icon size={20} name={providerInfo.icon} color={colors.text} />
                    <Text style={[styles.addressText, { color: colors.text, marginLeft: 8 }]}>
                      {providerInfo.title}
                    </Text>
                  </View>
                );
              })}
            </>
          )}

          {order.billing_address && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Dirección de facturación
              </Text>
              <Text style={[styles.addressText, { color: colors.text }]}>
                {order.billing_address.first_name} {order.billing_address.last_name}
              </Text>
              <Text style={[styles.addressText, { color: colors.text }]}>
                {order.billing_address.address_1}
              </Text>
              <Text style={[styles.addressText, { color: colors.text }]}>
                {order.billing_address.city}, {order.billing_address.postal_code}
              </Text>
              <Text style={[styles.addressText, { color: colors.text }]}>
                {order.billing_address.country_code?.toUpperCase()}
              </Text>
            </>
          )}
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.background, borderColor: colors.icon + "30" },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>Resumen del pedido</Text>

          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.text }]}>Subtotal</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {formatPrice(order.item_subtotal || 0, order.currency_code)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.text }]}>Descuento</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {(order.discount_total || 0) > 0 ? "-" : ""}
              {formatPrice(order.discount_total || 0, order.currency_code)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.text }]}>Envío</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {formatPrice(order.shipping_total || 0, order.currency_code)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.text }]}>Impuestos</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {formatPrice(order.tax_total || 0, order.currency_code)}
            </Text>
          </View>

          <View style={[styles.summaryRow, styles.totalRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text>
            <Text style={[styles.totalValue, { color: colors.tint }]}>
              {formatPrice(order.total, order.currency_code)}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  content: {
    padding: 20,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 32,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
  },
  value: {
    fontSize: 14,
    fontWeight: "500",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  addressText: {
    fontSize: 14,
    marginBottom: 4,
  },
  paymentMethodRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  lastItemRow: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  itemVariant: {
    fontSize: 12,
    marginBottom: 4,
  },
  itemQuantity: {
    fontSize: 12,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  totalRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: "700",
  },
  totalValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  button: {
    marginTop: 20,
  },
  continueButton: {
    marginBottom: 24,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
});

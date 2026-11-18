import { useCustomer } from "@/context/customer-context";
import { orderWhatsAppLinks } from "@/lib/order-whatsapp";
import { Icon } from "@agestyles/icons";
import { Button, Card, KeyValueRow, useUiTheme } from "@agestyles/ui-native";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";

/** Purchase confirmation (reference POS style): success notice, reference and next actions. */
export default function MarketplaceConfirmation() {
  const { groupId, orderCount } = useLocalSearchParams<{ groupId: string; orderCount: string }>();
  const { color } = useUiTheme();
  const router = useRouter();
  const { customer } = useCustomer();
  const whatsappLinks = orderWhatsAppLinks(groupId);
  const stores = Number(orderCount) || 1;

  return (
    <ScrollView
      style={{ backgroundColor: color.background }}
      contentContainerStyle={styles.content}
    >
      <Stack.Screen options={{ title: "Compra confirmada" }} />
      <Card style={styles.card}>
        <Text accessibilityRole="header" style={[styles.heading, { color: color.text }]}>
          ¡Pedido confirmado!
        </Text>
        <View
          accessibilityRole="alert"
          style={[styles.notice, { backgroundColor: color.successSoft }]}
        >
          <Text style={[styles.noticeText, { color: color.success }]}>
            Tu pedido se registró correctamente.
            {stores > 1
              ? ` Se separó en ${stores} pedidos, uno por tienda, para que cada una prepare su parte.`
              : " La tienda lo preparará en breve."}
          </Text>
          <Icon name="check" size={18} color={color.success} />
        </View>
        <KeyValueRow label="Referencia">
          <Text selectable style={[styles.reference, { color: color.text }]}>
            {groupId}
          </Text>
        </KeyValueRow>
        <KeyValueRow label="Tiendas" value={String(stores)} />

        {whatsappLinks.length > 0 ? (
          <View style={styles.block}>
            <Text style={[styles.help, { color: color.muted }]}>
              Escribe a la tienda por WhatsApp para confirmar disponibilidad y forma de pago.
            </Text>
            {whatsappLinks.map((link) => (
              <Button
                key={link.sellerId}
                icon="send"
                title={
                  whatsappLinks.length > 1
                    ? `Consultar a ${link.sellerName} por WhatsApp`
                    : "Consultar por WhatsApp"
                }
                accessibilityLabel={`Consultar a ${link.sellerName} por WhatsApp`}
                onPress={() => {
                  Linking.openURL(link.url).catch(() => undefined);
                }}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.block}>
          {customer ? (
            <Button
              title="Ver mis pedidos"
              variant={whatsappLinks.length ? "secondary" : "primary"}
              onPress={() => router.replace("/(drawer)/(tabs)/account/orders" as Href)}
            />
          ) : null}
          <Button
            title="Seguir comprando"
            variant="secondary"
            onPress={() => router.replace("/(drawer)/(tabs)/(home)" as Href)}
          />
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "center", padding: 16 },
  card: { width: "100%", maxWidth: 480, alignSelf: "center", padding: 18, gap: 14 },
  heading: { fontSize: 22, fontWeight: "700" },
  notice: { flexDirection: "row", gap: 10, borderRadius: 12, padding: 14 },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 20 },
  reference: { fontSize: 13, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  block: { gap: 10, marginTop: 4 },
  help: { fontSize: 14, lineHeight: 20 },
});

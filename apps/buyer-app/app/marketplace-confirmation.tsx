import { Button } from "@/components/ui/button";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Icon } from "@agestyles/icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function MarketplaceConfirmation() {
  const { groupId, orderCount } = useLocalSearchParams<{ groupId: string; orderCount: string }>();
  const colors = Colors[useColorScheme() ?? "light"];
  const router = useRouter();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "Compra confirmada" }} />
      <View style={styles.content}>
        <View style={[styles.successMark, { backgroundColor: colors.success }]}>
          <Icon name="check" size={28} color={colors.onSuccess} />
        </View>
        <Text style={[styles.heading, { color: colors.text }]}>Tu compra ha sido confirmada</Text>
        <Text style={[styles.description, { color: colors.icon }]}>
          Tu pedido se ha separado por tienda para que cada vendedor pueda preparar su parte.
        </Text>
        <View
          style={[
            styles.summary,
            { backgroundColor: colors.cardBackground, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.summaryLabel, { color: colors.icon }]}>Referencia del pedido</Text>
          <Text selectable style={[styles.reference, { color: colors.text }]}>
            {groupId}
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.summaryLabel, { color: colors.icon }]}>Órdenes de la tienda</Text>
          <Text style={[styles.count, { color: colors.text }]}>{orderCount}</Text>
        </View>
        <Button
          title="Continuar comprando"
          onPress={() => router.replace("/(drawer)/(tabs)/(home)")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "center", padding: 24 },
  content: { width: "100%", maxWidth: 480, alignSelf: "center", gap: 16 },
  successMark: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  heading: { fontSize: 28, lineHeight: 34, fontWeight: "600", letterSpacing: -0.45 },
  description: { fontSize: 15, lineHeight: 22, marginBottom: 8 },
  summary: {
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    gap: 8,
    marginBottom: 8,
  },
  summaryLabel: { fontSize: 12 },
  reference: { fontSize: 14, fontWeight: "600" },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 8 },
  count: { fontSize: 16, fontWeight: "600" },
});

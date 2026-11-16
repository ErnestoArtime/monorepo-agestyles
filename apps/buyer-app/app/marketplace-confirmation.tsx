import { Link, Stack, useLocalSearchParams } from "expo-router"
import { ScrollView, StyleSheet, Text } from "react-native"
import { Colors } from "@/constants/theme"
import { useColorScheme } from "@/hooks/use-color-scheme"

export default function MarketplaceConfirmation() {
  const { groupId, orderCount } = useLocalSearchParams<{ groupId: string; orderCount: string }>()
  const colors = Colors[useColorScheme() ?? "light"]

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Order confirmation" }} />
      <Text style={[styles.heading, { color: colors.text }]}>Purchase confirmed</Text>
      <Text style={{ color: colors.text }}>Order group: {groupId}</Text>
      <Text style={{ color: colors.text }}>Seller orders: {orderCount}</Text>
      <Link href="/" style={{ color: colors.tint }}>Return to the store</Link>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 16 },
  heading: { fontSize: 24, fontWeight: "700" },
})

import { Tabs } from "expo-router";
import { Icon, IconName } from "@agestyles/icons";
import { hasPermission } from "../../components/operation-list";
import { useBusiness } from "../../context/business-context";

const icons: Record<string, IconName> = { index: "home", products: "package", inventory: "warehouse", orders: "list", more: "more" };
const labels: Record<string, string> = { index: "Resumen", products: "Productos", inventory: "Stock", orders: "Pedidos", more: "Más" };

export default function BusinessTabs() {
  const { member } = useBusiness();
  return <Tabs screenOptions={({ route }) => ({
    headerStyle: { backgroundColor: "#FFFFFF" }, headerTitleStyle: { color: "#171717", fontWeight: "600" },
    tabBarActiveTintColor: "#111B2D", tabBarInactiveTintColor: "#6F6F6B", tabBarStyle: { backgroundColor: "#FFFFFF", borderTopColor: "#E4E4DF", minHeight: 62, paddingTop: 5, paddingBottom: 5 },
    tabBarLabel: labels[route.name], tabBarIcon: ({ color, focused }) => <Icon name={icons[route.name] ?? "more"} size={22} color={focused ? "#111B2D" : color} />,
  })}>
    <Tabs.Screen name="index" options={{ title: "Resumen" }} />
    <Tabs.Screen name="products" options={{ title: "Productos", href: hasPermission(member, "products") ? undefined : null }} />
    <Tabs.Screen name="inventory" options={{ title: "Inventario" }} />
    <Tabs.Screen name="orders" options={{ title: "Pedidos", href: hasPermission(member, "orders") ? undefined : null }} />
    <Tabs.Screen name="more" options={{ title: "Más" }} />
    <Tabs.Screen name="team" options={{ title: "Equipo", href: null }} />
  </Tabs>;
}

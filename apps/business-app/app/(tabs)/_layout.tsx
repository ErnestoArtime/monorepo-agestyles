import { Tabs } from "expo-router";
import { Icon, IconName } from "@agestyles/icons";
import { hasPermission } from "../../components/operation-list";
import { useBusiness } from "../../context/business-context";
import { useBusinessTheme } from "../../hooks/use-business-theme";

const icons: Record<string, IconName> = {
  index: "home",
  products: "package",
  inventory: "warehouse",
  orders: "list",
  more: "more",
};
const labels: Record<string, string> = {
  index: "Resumen",
  products: "Productos",
  inventory: "Stock",
  orders: "Pedidos",
  more: "Más",
};

export default function BusinessTabs() {
  const { member } = useBusiness();
  const theme = useBusinessTheme();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: theme.surface },
        headerTitleStyle: { color: theme.text, fontWeight: "600" },
        headerTintColor: theme.action,
        tabBarActiveTintColor: theme.action,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          minHeight: 62,
          paddingTop: 5,
          paddingBottom: 5,
        },
        tabBarLabel: labels[route.name],
        tabBarIcon: ({ color, focused }) => (
          <Icon
            name={icons[route.name] ?? "more"}
            size={22}
            color={focused ? theme.action : color}
          />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Resumen" }} />
      <Tabs.Screen
        name="products"
        options={{ title: "Productos", href: hasPermission(member, "products") ? undefined : null }}
      />
      <Tabs.Screen name="inventory" options={{ title: "Inventario" }} />
      <Tabs.Screen
        name="orders"
        options={{ title: "Pedidos", href: hasPermission(member, "orders") ? undefined : null }}
      />
      <Tabs.Screen name="more" options={{ title: "Más" }} />
      <Tabs.Screen name="team" options={{ title: "Equipo", href: null }} />
    </Tabs>
  );
}

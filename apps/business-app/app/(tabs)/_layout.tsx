import { NotificationBell } from "@agestyles/features-notifications";
import { Tabs, useRouter } from "expo-router";
import { Icon, IconName } from "@agestyles/icons";
import { Platform, View } from "react-native";
import { MenuButton } from "../../components/mobile-menu";
import { hasPermission } from "../../components/operation-list";
import { useBusiness } from "../../context/business-context";
import { useBusinessTheme } from "../../hooks/use-business-theme";
import { useResponsive } from "../../hooks/use-responsive";

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
  inventory: "Inventario",
  orders: "Pedidos",
  more: "Más",
};

export default function BusinessTabs() {
  const { member } = useBusiness();
  const theme = useBusinessTheme();
  const router = useRouter();
  const { isWideWeb } = useResponsive();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        // Browsers draw their own top bar; Android Chrome's safe-area inset doubled the header.
        ...(Platform.OS === "web" ? { headerStatusBarHeight: 0 } : {}),
        // In a wide browser the side menu replaces the app header and the tab bar.
        headerShown: !isWideWeb,
        headerStyle: { backgroundColor: theme.surface },
        headerTitleStyle: { color: theme.text, fontWeight: "600" },
        headerTintColor: theme.text,
        headerLeft: () => <MenuButton />,
        headerRight: () => (
          <View style={{ marginRight: 8 }}>
            <NotificationBell onPress={() => router.push("/notifications")} />
          </View>
        ),
        tabBarActiveTintColor: theme.action,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: {
          ...(isWideWeb ? { display: "none" as const } : {}),
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

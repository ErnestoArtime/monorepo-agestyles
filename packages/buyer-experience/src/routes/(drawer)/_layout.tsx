import { useNavigationContainerRef, useRouter } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { useEffect } from "react";
import { View } from "react-native";

import { DrawerContent } from "../../components/drawer-content";
import { WebSidebar } from "../../components/web-sidebar";
import { WebTopBar } from "../../components/web-top-bar";
import { Colors } from "../../constants/theme";
import { takeHandoffArrival } from "../../context/cart-context";
import { useColorScheme } from "../../hooks/use-color-scheme";
import { useResponsive } from "../../hooks/use-responsive";
import { buyerHref } from "../../config";

export default function DrawerLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { isWideWeb } = useResponsive();

  // A cart handed over from the Catálogo opens on the cart. The tab shares the home URL, so it can
  // only be reached through the router, which refuses to navigate until its container is ready.
  const router = useRouter();
  const container = useNavigationContainerRef();
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    void takeHandoffArrival().then((arrived) => {
      if (!arrived || cancelled) return;
      let attempts = 0;
      timer = setInterval(() => {
        attempts += 1;
        if (container.isReady()) {
          clearInterval(timer);
          router.replace(buyerHref("/(drawer)/(tabs)/(cart)") as never);
        } else if (attempts > 100) {
          clearInterval(timer);
        }
      }, 50);
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [container, router]);

  const drawer = (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerPosition: "left",
        drawerStyle: { backgroundColor: colors.cardBackground },
        drawerActiveTintColor: colors.tint,
        drawerInactiveTintColor: colors.icon,
        drawerActiveBackgroundColor: colors.surfaceMuted,
        sceneStyle: { backgroundColor: colors.background },
        // Desktop uses persistent navigation; compact screens keep the drawer.
        swipeEnabled: !isWideWeb,
      }}
    >
      <Drawer.Screen
        name="(tabs)"
        options={{
          drawerLabel: "Inicio",
          title: "Tienda",
        }}
      />
    </Drawer>
  );

  if (!isWideWeb) return drawer;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <WebTopBar />
      <View style={{ flex: 1, flexDirection: "row", minHeight: 0 }}>
        <WebSidebar />
        <View style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>{drawer}</View>
      </View>
    </View>
  );
}

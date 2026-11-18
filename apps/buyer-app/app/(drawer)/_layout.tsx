import { Drawer } from "expo-router/drawer";
import { View } from "react-native";

import { DrawerContent } from "@/components/drawer-content";
import { WebTopBar } from "@/components/web-top-bar";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useResponsive } from "@/hooks/use-responsive";

export default function DrawerLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { isWideWeb } = useResponsive();

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
        // Wide browsers navigate from the top bar; the side menu stays for phones and the APK.
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
      <View style={{ flex: 1 }}>{drawer}</View>
    </View>
  );
}

import { Drawer } from "expo-router/drawer";

import { DrawerContent } from "@/components/drawer-content";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useHasCountryChoice } from "@/context/region-context";

export default function DrawerLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const hasCountryChoice = useHasCountryChoice();

  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        // With a single country (Cuba) there is nothing to choose in the drawer.
        swipeEnabled: hasCountryChoice,
        drawerPosition: "left",
        drawerStyle: { backgroundColor: colors.cardBackground },
        drawerActiveTintColor: colors.tint,
        drawerInactiveTintColor: colors.icon,
        drawerActiveBackgroundColor: colors.surfaceMuted,
        sceneStyle: { backgroundColor: colors.background },
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
}

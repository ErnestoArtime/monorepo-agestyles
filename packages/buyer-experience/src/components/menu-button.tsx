import { DrawerActions, useNavigation } from "@react-navigation/native";
import React from "react";
import { TouchableOpacity } from "react-native";
import { Colors } from "../constants/theme";
import { useColorScheme } from "../hooks/use-color-scheme";
import { IconSymbol } from "./ui/icon-symbol";

/** Opens the side menu from any first-level page (phones and narrow browsers). */
export function MenuButton() {
  const navigation = useNavigation();
  const colors = Colors[useColorScheme() ?? "light"];
  return (
    <TouchableOpacity
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      accessibilityRole="button"
      accessibilityLabel="Abrir menú de navegación"
      style={{
        height: 44,
        width: 44,
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 4,
      }}
    >
      <IconSymbol size={24} name="line.3.horizontal" color={colors.icon} />
    </TouchableOpacity>
  );
}

import { colors, type ColorScheme } from "@agestyles/design-tokens";
import { useColorScheme } from "react-native";

export function useBusinessTheme() {
  const systemScheme = useColorScheme();
  const scheme: ColorScheme = systemScheme === "dark" ? "dark" : "light";
  const tokens = colors[scheme];
  const isDark = scheme === "dark";

  return {
    ...tokens,
    scheme,
    isDark,
    ink: tokens.text,
    paper: tokens.background,
    white: tokens.surface,
    line: tokens.border,
    navy: tokens.action,
    red: tokens.error,
    onAction: tokens.onAction,
    placeholderText: tokens.muted,
    quietSurface: tokens.quietSurface,
    selectedSurface: tokens.selectedSurface,
    successText: tokens.success,
    statusBarStyle: isDark ? ("light" as const) : ("dark" as const),
  };
}

export type BusinessTheme = ReturnType<typeof useBusinessTheme>;

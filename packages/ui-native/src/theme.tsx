import { colors, radius, spacing, type ColorScheme } from "@agestyles/design-tokens";
import React, { createContext, useContext } from "react";

/**
 * Each app decides the active scheme (device or the buyer's preference) and
 * passes it down; components only read semantic tokens from here.
 */
const SchemeContext = createContext<ColorScheme>("light");

export function UiThemeProvider({
  scheme,
  children,
}: {
  scheme: ColorScheme | null | undefined;
  children: React.ReactNode;
}) {
  return <SchemeContext.Provider value={scheme ?? "light"}>{children}</SchemeContext.Provider>;
}

export function useUiTheme() {
  const scheme = useContext(SchemeContext);
  return { scheme, color: colors[scheme], spacing, radius };
}

export type UiTheme = ReturnType<typeof useUiTheme>;

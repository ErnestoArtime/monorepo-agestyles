import { colors, radius, spacing, type ColorScheme } from "@agestyles/design-tokens";
import React, { createContext, useContext, useEffect } from "react";
import { Platform } from "react-native";

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
  useWebScrollbars(scheme ?? "light");
  return <SchemeContext.Provider value={scheme ?? "light"}>{children}</SchemeContext.Provider>;
}

// Innermost provider wins (the Tienda mounted inside Negocio); leaving it restores the outer one.
const webSchemes: ColorScheme[] = [];

function applyWebScheme(scheme: ColorScheme | undefined) {
  let style = document.getElementById("agestyles-scrollbars") as HTMLStyleElement | null;
  if (!scheme) {
    style?.remove();
    return;
  }
  if (!style) {
    style = document.createElement("style");
    style.id = "agestyles-scrollbars";
    document.head.appendChild(style);
  }
  const palette = colors[scheme];
  // `color-scheme` makes the browser draw dark scrollbars and form controls in the dark theme;
  // thin scrollbars in a soft tone of the theme instead of the default grey bars.
  style.textContent = `:root{color-scheme:${scheme}}*{scrollbar-width:thin;scrollbar-color:${palette.muted}66 transparent}`;
}

function useWebScrollbars(scheme: ColorScheme) {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    webSchemes.push(scheme);
    applyWebScheme(scheme);
    return () => {
      const index = webSchemes.lastIndexOf(scheme);
      if (index >= 0) webSchemes.splice(index, 1);
      applyWebScheme(webSchemes[webSchemes.length - 1]);
    };
  }, [scheme]);
}

export function useUiTheme() {
  const scheme = useContext(SchemeContext);
  return { scheme, color: colors[scheme], spacing, radius };
}

export type UiTheme = ReturnType<typeof useUiTheme>;

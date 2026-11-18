import { Platform, useWindowDimensions } from "react-native";

/** From this width a browser gets the website layout: fixed side menu, no tab bar. */
export const WIDE_WEB_MIN = 900;
/** Width of the centred page content on large screens. */
export const CONTENT_MAX = 1120;

/** Same rule as Tienda: phones and the APK keep the app layout; wide browsers get a web layout. */
export function useResponsive() {
  const { width } = useWindowDimensions();
  const isWideWeb = Platform.OS === "web" && width >= WIDE_WEB_MIN;
  return { width, isWideWeb };
}

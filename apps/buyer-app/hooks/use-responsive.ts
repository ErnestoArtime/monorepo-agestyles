import { Platform, useWindowDimensions } from "react-native";

/** From this width a browser gets the website layout: top navigation, no tab bar. */
export const WIDE_WEB_MIN = 900;
/** Width of the centred page content on large screens. */
export const CONTENT_MAX = 1240;

/**
 * One implementation for the APK and the web: phones keep the app layout, while
 * wide browsers get a website layout and every screen gets as many product
 * columns as its width allows (also tablets).
 */
export function useResponsive() {
  const { width } = useWindowDimensions();
  const isWideWeb = Platform.OS === "web" && width >= WIDE_WEB_MIN;
  const contentWidth = Math.min(width, CONTENT_MAX);
  const columns = contentWidth >= 1100 ? 5 : contentWidth >= 860 ? 4 : contentWidth >= 600 ? 3 : 2;
  return { width, isWideWeb, columns, contentWidth };
}

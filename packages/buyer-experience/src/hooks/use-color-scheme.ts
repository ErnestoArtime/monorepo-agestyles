import { useColorScheme as useDeviceColorScheme } from "react-native";
import { useThemePreference } from "../context/theme-preference";

/** Device scheme unless the buyer chose light or dark in the menu. */
export function useColorScheme() {
  const device = useDeviceColorScheme();
  const { preference } = useThemePreference();
  return preference === "system" ? device : preference;
}

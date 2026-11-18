import { useEffect, useState } from "react";
import { useColorScheme as useDeviceColorScheme } from "react-native";
import { useThemePreference } from "../context/theme-preference";

/**
 * Device scheme unless the buyer chose light or dark in the menu. To support
 * static rendering the device value is only trusted after hydration.
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);
  const device = useDeviceColorScheme();
  const { preference } = useThemePreference();

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  if (preference !== "system") return preference;
  return hasHydrated ? device : "light";
}

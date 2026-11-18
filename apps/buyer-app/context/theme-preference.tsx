import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Buyer's appearance choice, as in the legacy catalog menu («Apariencia»).
 * `system` follows the device; `light`/`dark` are persisted on this device.
 */
export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "agestyles.buyer.theme";

type ThemePreferenceValue = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const ThemePreferenceContext = createContext<ThemePreferenceValue | null>(null);

export function ThemePreferenceProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === "light" || stored === "dark" || stored === "system") {
          setPreferenceState(stored);
        }
      })
      .catch(() => undefined);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ preference, setPreference }), [preference, setPreference]);
  return (
    <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>
  );
}

/** Outside the provider it behaves as `system`, so isolated components keep working. */
export function useThemePreference(): ThemePreferenceValue {
  return (
    useContext(ThemePreferenceContext) ?? { preference: "system", setPreference: () => undefined }
  );
}

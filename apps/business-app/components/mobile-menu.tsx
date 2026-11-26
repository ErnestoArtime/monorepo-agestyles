import { Icon } from "@agestyles/icons";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useBusinessTheme } from "../hooks/use-business-theme";
import { WebSidebar } from "./web-sidebar";

type MobileMenuValue = { open: () => void; close: () => void };
const MobileMenuContext = createContext<MobileMenuValue | null>(null);

/**
 * The side menu of a wide browser, as a slide-in panel on phones (and narrow browsers): every
 * section of Negocio one tap from any page, without going through «Más». The panel closes when
 * a destination is chosen.
 */
export function MobileMenuProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);
  const value = useMemo(() => ({ open, close }), [open, close]);
  return (
    <MobileMenuContext.Provider value={value}>
      {children}
      <MobileMenuPanel visible={visible} onClose={close} />
    </MobileMenuContext.Provider>
  );
}

function MobileMenuPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useBusinessTheme();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(340, Math.round(width * 0.88));
  const slide = useRef(new Animated.Value(-panelWidth)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      slide.setValue(-panelWidth);
      Animated.timing(slide, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(slide, {
        toValue: -panelWidth,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setMounted(false));
    }
  }, [visible, mounted, panelWidth, slide]);

  if (!mounted) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable
          style={[styles.scrim, { backgroundColor: "rgba(0,0,0,0.5)" }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar menú"
        />
        <Animated.View
          style={[
            styles.panel,
            {
              width: panelWidth,
              backgroundColor: theme.surface,
              transform: [{ translateX: slide }],
            },
          ]}
        >
          <WebSidebar variant="drawer" onNavigate={onClose} />
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Hamburger for the header of any page: opens the menu. */
export function MenuButton() {
  const theme = useBusinessTheme();
  const menu = useContext(MobileMenuContext);
  return (
    <Pressable
      onPress={() => menu?.open()}
      accessibilityRole="button"
      accessibilityLabel="Abrir menú de navegación"
      hitSlop={6}
      style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}
    >
      <Icon name="menu" size={24} color={theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  scrim: { ...StyleSheet.absoluteFillObject },
  panel: { height: "100%" },
  button: { height: 44, width: 44, alignItems: "center", justifyContent: "center", marginLeft: 4 },
});

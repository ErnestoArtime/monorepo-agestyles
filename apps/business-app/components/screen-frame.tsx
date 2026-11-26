import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBusinessTheme } from "../hooks/use-business-theme";
import { CONTENT_MAX, useResponsive } from "../hooks/use-responsive";

/**
 * Page for the stack screens outside the tabs. Phones get the app header from the root layout
 * (menu button, page name, bell), so the page only keeps its content; a wide browser has no
 * header, so it shows the page title above the content, next to the side menu.
 */
export function ScreenFrame({ title, children }: { title: string; children: ReactNode }) {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const { isWideWeb } = useResponsive();
  return (
    <SafeAreaView edges={isWideWeb ? ["top"] : []} style={styles.page}>
      <View style={[styles.body, isWideWeb && styles.wide, isWideWeb && styles.bodyWide]}>
        {isWideWeb ? (
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
        ) : null}
        {children}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: theme.background },
    wide: { width: "100%", maxWidth: CONTENT_MAX, alignSelf: "center", paddingHorizontal: 24 },
    title: { color: theme.text, fontSize: 28, fontWeight: "700", marginBottom: 12 },
    body: { flex: 1 },
    bodyWide: { paddingTop: 40 },
  });

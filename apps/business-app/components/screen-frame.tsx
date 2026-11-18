import { Icon } from "@agestyles/icons";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBusinessTheme } from "../hooks/use-business-theme";
import { CONTENT_MAX, useResponsive } from "../hooks/use-responsive";

/** Safe-area page with an accessible back button, for stack screens outside the tabs. */
export function ScreenFrame({ backLabel, children }: { backLabel: string; children: ReactNode }) {
  const theme = useBusinessTheme();
  const router = useRouter();
  const styles = createStyles(theme);
  const { isWideWeb } = useResponsive();
  const wide = isWideWeb ? styles.wide : null;
  return (
    <SafeAreaView edges={["top"]} style={styles.page}>
      <View style={[styles.header, wide]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
          accessibilityRole="button"
          accessibilityLabel={`Volver: ${backLabel}`}
          hitSlop={6}
          style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
        >
          <Icon name="arrowLeft" size={18} color={theme.action} />
          <Text style={styles.backText}>{backLabel}</Text>
        </Pressable>
      </View>
      <View style={[styles.body, wide]}>{children}</View>
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: theme.background },
    wide: { width: "100%", maxWidth: CONTENT_MAX, alignSelf: "center", paddingHorizontal: 24 },
    header: { paddingHorizontal: 16, paddingTop: 6 },
    back: {
      minHeight: 44,
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    backText: { color: theme.action, fontSize: 15, fontWeight: "500" },
    body: { flex: 1 },
  });

import { Icon } from "@agestyles/icons";
import React from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Colors } from "../constants/theme";
import { useColorScheme } from "../hooks/use-color-scheme";
import { CONTENT_MAX } from "../hooks/use-responsive";

type HeaderProps = {
  options: { title?: string };
  route: { name: string };
  back?: unknown;
  navigation: { goBack(): void; canGoBack(): boolean };
};

/**
 * In a wide browser a screen's header is a page heading, not a second app bar under the
 * website top bar: title aligned with the content, no background or border, and «Volver»
 * when there is somewhere to go back to.
 */
export function WebPageHeader({ options, route, back, navigation }: HeaderProps) {
  const colors = Colors[useColorScheme() ?? "light"];
  const title = options.title ?? route.name;
  const canGoBack = Boolean(back) && navigation.canGoBack();
  return (
    <View style={[styles.host, { backgroundColor: colors.background }]}>
      <View style={styles.inner}>
        {canGoBack ? (
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="link"
            style={styles.back}
          >
            <Icon name="arrowLeft" size={16} color={colors.tint} />
            <Text style={[styles.backText, { color: colors.tint }]}>Volver</Text>
          </Pressable>
        ) : null}
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          {title}
        </Text>
      </View>
    </View>
  );
}

/** In a wide browser a page's content is centred under its heading, like the rest of the site. */
export const webContentStyle = {
  width: "100%",
  maxWidth: CONTENT_MAX,
  alignSelf: "center",
} as const;

/** Forms (sign in, sign up…) in a wide browser: a narrow centred column, as on any website. */
export function webFormStyle(backgroundColor: string): ViewStyle {
  return { backgroundColor, width: "100%", maxWidth: 480, alignSelf: "center" };
}

/** Screen option: use the page heading in wide browsers, the app header elsewhere. */
export function webPageHeaderOption(isWideWeb: boolean) {
  return isWideWeb ? { header: (props: HeaderProps) => <WebPageHeader {...props} /> } : {};
}

const styles = StyleSheet.create({
  host: { paddingTop: 24, paddingBottom: 4 },
  inner: {
    width: "100%",
    maxWidth: CONTENT_MAX,
    alignSelf: "center",
    paddingHorizontal: 16,
    gap: 8,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    minHeight: 32,
  },
  backText: { fontSize: 14, fontWeight: "600" },
  title: { fontSize: 30, lineHeight: 36, fontWeight: "700", letterSpacing: -0.5 },
});

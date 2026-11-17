/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';
import { colors } from '@agestyles/design-tokens';

export const Colors = {
  light: {
    text: colors.light.text,
    background: colors.light.background,
    tint: colors.light.action,
    icon: colors.light.muted,
    tabIconDefault: colors.light.muted,
    tabIconSelected: colors.light.action,
    border: colors.light.border,
    cardBackground: colors.light.surface,
    error: colors.light.error,
    warning: colors.light.warning,
    success: colors.light.success,
    imagePlaceholder: colors.light.placeholder,
  },
  dark: {
    text: colors.dark.text,
    background: colors.dark.background,
    tint: colors.dark.action,
    icon: colors.dark.muted,
    tabIconDefault: colors.dark.muted,
    tabIconSelected: colors.dark.action,
    border: colors.dark.border,
    cardBackground: colors.dark.surface,
    error: colors.dark.error,
    warning: colors.dark.warning,
    success: colors.dark.success,
    imagePlaceholder: colors.dark.placeholder,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

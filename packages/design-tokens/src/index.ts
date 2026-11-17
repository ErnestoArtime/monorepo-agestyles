export const palette = {
  ivory: '#F7F7F4',
  white: '#FFFFFF',
  graphite: '#171717',
  graphiteSoft: '#6F6F6B',
  nightBlue: '#17283D',
  nightBlueHover: '#223A57',
  champagne: '#B69A72',
  border: '#E4E4DF',
  placeholder: '#ECECE8',
  danger: '#B42318',
  warning: '#A15C00',
  success: '#287A46',
} as const;

export const colors = {
  light: {
    text: palette.graphite,
    background: palette.ivory,
    surface: palette.white,
    action: palette.nightBlue,
    actionHover: palette.nightBlueHover,
    accent: palette.champagne,
    muted: palette.graphiteSoft,
    border: palette.border,
    placeholder: palette.placeholder,
    error: palette.danger,
    warning: palette.warning,
    success: palette.success,
  },
  dark: {
    text: '#F4F2EE',
    background: '#151718',
    surface: '#1E2021',
    action: '#B9CBE0',
    actionHover: '#D6E2EF',
    accent: '#D2B88F',
    muted: '#A5A49F',
    border: '#3A3B39',
    placeholder: '#2A2C2B',
    error: '#F97066',
    warning: '#FDB022',
    success: '#75C99A',
  },
} as const;

export const typography = {
  family: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
  },
  size: { caption: 12, body: 16, subtitle: 20, title: 28, display: 40 },
  lineHeight: { body: 1.5, heading: 1.15 },
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32, '3xl': 48 } as const;
export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;
export const touchTarget = { minimum: 44 } as const;

export type ColorScheme = keyof typeof colors;
export type SemanticColor = keyof typeof colors.light;

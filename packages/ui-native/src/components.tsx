import { Icon, type IconName } from "@agestyles/icons";
import React from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { useUiTheme } from "./theme";

/** Large left-aligned screen title, as in the reference POS («Carrito», «Pedidos»). */
export function LargeTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const { color } = useUiTheme();
  return (
    <View style={styles.titleBlock}>
      <Text accessibilityRole="header" style={[styles.largeTitle, { color: color.text }]}>
        {title}
      </Text>
      {subtitle ? <Text style={[styles.subtitle, { color: color.muted }]}>{subtitle}</Text> : null}
    </View>
  );
}

/** Rounded search field with icon and clear button. */
export function SearchField({
  value,
  onChangeText,
  placeholder = "Buscar",
  ...props
}: TextInputProps & { value: string; onChangeText: (text: string) => void }) {
  const { color } = useUiTheme();
  return (
    <View style={[styles.search, { borderColor: color.border, backgroundColor: color.surface }]}>
      <Icon name="search" size={18} color={color.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={color.muted}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        style={[styles.searchInput, { color: color.text }]}
        {...props}
      />
      {value ? (
        <Pressable
          onPress={() => onChangeText("")}
          accessibilityRole="button"
          accessibilityLabel="Borrar búsqueda"
          hitSlop={8}
        >
          <Icon name="close" size={18} color={color.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger";

/** Filled (primary), outlined (secondary) or destructive button, 48 px tall. */
export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  loading,
  icon,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { color } = useUiTheme();
  const filled = variant === "primary" || variant === "danger";
  const background =
    variant === "primary" ? color.action : variant === "danger" ? color.error : color.surface;
  const foreground =
    variant === "primary" ? color.onAction : variant === "danger" ? color.onError : color.text;
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: background,
          borderColor: filled ? background : color.border,
          opacity: inactive ? 0.45 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={18} color={foreground} /> : null}
          <Text style={[styles.buttonText, { color: foreground }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Single-choice pills (variant options, filters); the selected one is filled. */
export function PillGroup<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: { value: T; label: string; disabled?: boolean }[];
  value: T | null | undefined;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}) {
  const { color } = useUiTheme();
  return (
    <View
      style={styles.pills}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            disabled={option.disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: !!option.disabled }}
            style={[
              styles.pill,
              {
                backgroundColor: selected ? color.action : color.surface,
                borderColor: selected ? color.action : color.border,
                opacity: option.disabled ? 0.4 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.pillText,
                { color: selected ? color.onAction : color.text },
                selected && styles.pillTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** − n + quantity selector. */
export function Stepper({
  value,
  onChange,
  min = 1,
  max,
  compact,
  label = "Cantidad",
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  compact?: boolean;
  label?: string;
}) {
  const { color } = useUiTheme();
  const size = compact ? 32 : 44;
  const button = (delta: number, icon: IconName, name: string) => {
    const next = value + delta;
    const blocked = next < min || (max !== undefined && next > max);
    return (
      <Pressable
        onPress={() => onChange(next)}
        disabled={blocked}
        accessibilityRole="button"
        accessibilityLabel={name}
        style={[styles.stepperButton, { width: size, height: size, opacity: blocked ? 0.35 : 1 }]}
      >
        <Icon name={icon} size={compact ? 16 : 20} color={color.text} />
      </Pressable>
    );
  };
  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ now: value, min, max }}
      style={[styles.stepper, compact && { borderColor: color.border, borderWidth: 1 }]}
    >
      {button(-1, "minus", `Reducir ${label.toLowerCase()}`)}
      <Text style={[styles.stepperValue, { color: color.text, minWidth: compact ? 24 : 36 }]}>
        {value}
      </Text>
      {button(1, "plus", `Aumentar ${label.toLowerCase()}`)}
    </View>
  );
}

export type BadgeTone = "success" | "error" | "warning" | "neutral";

/** Status badge with soft background, as in the reference order list. */
export function StatusBadge({
  label,
  tone = "neutral",
  icon,
}: {
  label: string;
  tone?: BadgeTone;
  icon?: IconName;
}) {
  const { color } = useUiTheme();
  const palette = {
    success: { fg: color.success, bg: color.successSoft },
    error: { fg: color.error, bg: color.errorSoft },
    warning: { fg: color.warning, bg: color.warningSoft },
    neutral: { fg: color.muted, bg: color.quietSurface },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      {icon ? <Icon name={icon} size={14} color={palette.fg} /> : null}
      <Text style={[styles.badgeText, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

/** Bordered surface; pressable when `onPress` is given. */
export function Card({
  children,
  onPress,
  accessibilityLabel,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { color } = useUiTheme();
  const base = [styles.card, { borderColor: color.border, backgroundColor: color.surface }, style];
  return onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, pressed && { opacity: 0.75 }]}
    >
      {children}
    </Pressable>
  ) : (
    <View style={base}>{children}</View>
  );
}

/** «Etiqueta    valor» row used in summaries and order details. */
export function KeyValueRow({
  label,
  value,
  emphasis,
  children,
}: {
  label: string;
  value?: string;
  emphasis?: boolean;
  children?: React.ReactNode;
}) {
  const { color } = useUiTheme();
  return (
    <View style={styles.keyValue}>
      <Text
        style={[
          emphasis ? styles.totalLabel : styles.keyLabel,
          { color: emphasis ? color.text : color.muted },
        ]}
      >
        {label}
      </Text>
      {children ?? (
        <Text style={[emphasis ? styles.totalValue : styles.keyValueText, { color: color.text }]}>
          {value}
        </Text>
      )}
    </View>
  );
}

/** Square product tile for the 2-column grid: photo on a quiet surface, name and bold price. */
export function ProductTile({
  title,
  price,
  secondaryPrice,
  imageUrl,
  onPress,
  badge,
  accessory,
}: {
  title: string;
  price: string;
  secondaryPrice?: string | null;
  imageUrl?: string | null;
  onPress: () => void;
  badge?: React.ReactNode;
  accessory?: React.ReactNode;
}) {
  const { color } = useUiTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${price}`}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.8 }]}
    >
      <View style={[styles.tileImage, { backgroundColor: color.placeholder }]}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <Icon name="package" size={28} color={color.muted} />
        )}
        {badge ? <View style={styles.tileBadge}>{badge}</View> : null}
        {accessory ? <View style={styles.tileAccessory}>{accessory}</View> : null}
      </View>
      <Text numberOfLines={2} style={[styles.tileTitle, { color: color.text }]}>
        {title}
      </Text>
      <Text style={[styles.tilePrice, { color: color.text }]}>{price}</Text>
      {secondaryPrice ? (
        <Text style={[styles.tileSecondary, { color: color.muted }]}>{secondaryPrice}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  titleBlock: { gap: 4, marginBottom: 16 },
  largeTitle: { fontSize: 32, lineHeight: 38, fontWeight: "700", letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 21 },
  search: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },
  button: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonText: { fontSize: 16, fontWeight: "600" },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
  },
  pillText: { fontSize: 14 },
  pillTextSelected: { fontWeight: "600" },
  stepper: { flexDirection: "row", alignItems: "center", borderRadius: 10 },
  stepperButton: { alignItems: "center", justifyContent: "center" },
  stepperValue: { fontSize: 17, fontWeight: "600", textAlign: "center" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  badgeText: { fontSize: 12, fontWeight: "600" },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  keyValue: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  keyLabel: { fontSize: 14 },
  keyValueText: { fontSize: 14, fontWeight: "500", textAlign: "right", flexShrink: 1 },
  totalLabel: { fontSize: 17, fontWeight: "600" },
  totalValue: { fontSize: 17, fontWeight: "700" },
  tile: { flex: 1, gap: 6 },
  tileImage: {
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  tileBadge: { position: "absolute", left: 8, top: 8 },
  tileAccessory: { position: "absolute", right: 8, top: 8 },
  tileTitle: { fontSize: 14, lineHeight: 19 },
  tilePrice: { fontSize: 15, fontWeight: "700" },
  tileSecondary: { fontSize: 12 },
});

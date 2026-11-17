import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
} from "react-native";

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: "primary" | "secondary";
  loading?: boolean;
}

export function Button({
  title,
  variant = "primary",
  loading = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const isPrimary = variant === "primary";
  const isDisabled = disabled || loading;

  const primaryBgColor = colors.tint;
  const primaryTextColor = colors.onTint;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        isPrimary
          ? { backgroundColor: primaryBgColor }
          : [
              styles.secondaryButton,
              { backgroundColor: colors.cardBackground, borderColor: colors.border },
            ],
        isDisabled && styles.disabled,
        style,
      ]}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? primaryTextColor : colors.tint} />
      ) : (
        <Text
          style={[styles.text, isPrimary ? { color: primaryTextColor } : { color: colors.text }]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  secondaryButton: {
    borderWidth: 1,
  },
  text: {
    fontSize: 15,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.5,
  },
});

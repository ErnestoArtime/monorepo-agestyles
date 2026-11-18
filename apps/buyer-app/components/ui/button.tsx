import { Button as UiButton } from "@agestyles/ui-native";
import React from "react";
import type { StyleProp, ViewStyle } from "react-native";

interface ButtonProps {
  title: string;
  variant?: "primary" | "secondary";
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** App-wide button; delegates to the shared ui-native button so every screen matches (AG-24). */
export function Button(props: ButtonProps) {
  return <UiButton {...props} />;
}

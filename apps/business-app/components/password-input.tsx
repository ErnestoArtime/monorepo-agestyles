import { Icon } from "@agestyles/icons";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { useBusinessTheme } from "../hooks/use-business-theme";

/** Password input with a «show/hide» eye; the style comes from the screen. */
export function PasswordInput({ style, ...props }: TextInputProps) {
  const theme = useBusinessTheme();
  const [visible, setVisible] = useState(false);
  return (
    <View>
      <TextInput {...props} secureTextEntry={!visible} style={[style, styles.withEye]} />
      <Pressable
        onPress={() => setVisible((current) => !current)}
        accessibilityRole="button"
        accessibilityLabel={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        hitSlop={8}
        style={styles.eye}
      >
        <Icon name={visible ? "eyeOff" : "eye"} size={20} color={theme.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  withEye: { paddingRight: 48 },
  eye: {
    position: "absolute",
    right: 6,
    top: 0,
    bottom: 0,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});

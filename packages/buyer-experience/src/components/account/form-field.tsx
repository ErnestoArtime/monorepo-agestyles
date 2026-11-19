import { Icon } from "@agestyles/icons";
import { Colors } from "../../constants/theme";
import { useColorScheme } from "../../hooks/use-color-scheme";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";

type FormFieldProps = TextInputProps & { label: string };

/** Labelled input; password fields get a «show/hide» eye. */
export function FormField({ label, style, secureTextEntry, ...props }: FormFieldProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.icon}
          selectionColor={colors.tint}
          secureTextEntry={secureTextEntry && !visible}
          style={[
            styles.input,
            secureTextEntry && styles.withEye,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.border,
              color: colors.text,
            },
            style,
          ]}
          {...props}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setVisible((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            hitSlop={8}
            style={styles.eye}
          >
            <Icon name={visible ? "eyeOff" : "eye"} size={20} color={colors.icon} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 7 },
  label: { fontSize: 14, fontWeight: "600" },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
  },
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

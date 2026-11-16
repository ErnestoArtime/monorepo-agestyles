import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";

type FormFieldProps = TextInputProps & { label: string };

export function FormField({ label, style, ...props }: FormFieldProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.icon}
        selectionColor={colors.tint}
        style={[
          styles.input,
          {
            backgroundColor: colors.cardBackground,
            borderColor: colors.border,
            color: colors.text,
          },
          style,
        ]}
        {...props}
      />
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
});

import { FormField } from "@/components/account/form-field";
import { Button } from "@/components/ui/button";
import { Colors } from "@/constants/theme";
import { useCustomer } from "@/context/customer-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Link, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

function registrationError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/identity.*already exists|already.*registered|email.*already/i.test(message)) {
    return "Ya existe una cuenta con este correo electrónico. Inicia sesión en su lugar.";
  }
  return "No se pudo crear la cuenta. Revisa los datos e inténtalo de nuevo.";
}

export default function RegisterScreen() {
  const { register } = useCustomer();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!firstName.trim() || !lastName.trim() || !normalizedEmail || password.length < 8) {
      setError(
        "Ingresa tu nombre, un correo electrónico válido y una contraseña de al menos 8 caracteres.",
      );
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        password,
      });
      router.replace("/(drawer)/(tabs)/account");
    } catch (cause) {
      setError(registrationError(cause));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <Text style={[styles.title, { color: colors.text }]}>Crea tu cuenta</Text>
          <Text style={[styles.description, { color: colors.icon }]}>
            Tus compras se guardarán aquí cuando hagas compras mientras estás conectado.
          </Text>
        </View>

        <View style={styles.form}>
          <FormField
            label="Nombre"
            value={firstName}
            onChangeText={setFirstName}
            autoComplete="given-name"
            textContentType="givenName"
            returnKeyType="next"
          />
          <FormField
            label="Apellido"
            value={lastName}
            onChangeText={setLastName}
            autoComplete="family-name"
            textContentType="familyName"
            returnKeyType="next"
          />
          <FormField
            label="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            placeholder="nombre@ejemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
          />
          <FormField
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder="Al menos 8 caracteres"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            onSubmitEditing={handleRegister}
            returnKeyType="go"
          />
          {error ? (
            <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>
              {error}
            </Text>
          ) : null}
          <Button
            title="Crear cuenta"
            loading={loading}
            disabled={!firstName.trim() || !lastName.trim() || !email.trim() || password.length < 8}
            onPress={handleRegister}
          />
        </View>

        <Text style={[styles.footer, { color: colors.icon }]}>
          ¿Ya tienes una cuenta?{" "}
          <Link href="/(drawer)/(tabs)/account/login" style={{ color: colors.tint }}>
            Iniciar sesión
          </Link>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: 24, gap: 24 },
  intro: { gap: 8 },
  title: { fontSize: 27, fontWeight: "700" },
  description: { fontSize: 15, lineHeight: 22 },
  form: { gap: 16 },
  error: { fontSize: 14, lineHeight: 20 },
  footer: { fontSize: 14, textAlign: "center" },
});

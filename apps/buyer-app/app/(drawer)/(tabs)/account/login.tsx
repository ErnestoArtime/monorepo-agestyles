import { FormField } from "@/components/account/form-field";
import { Button } from "@/components/ui/button";
import { Colors } from "@/constants/theme";
import { useCustomer } from "@/context/customer-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Link, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

function signInError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return /unauthorized|invalid.*(email|password|credential)/i.test(message)
    ? "El correo y la contraseña no coinciden. Inténtalo de nuevo."
    : "No se pudo iniciar sesión. Revisa tus datos e inténtalo de nuevo.";
}

export default function LoginScreen() {
  const { login } = useCustomer();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError("Introduce tu correo electrónico y tu contraseña.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await login(normalizedEmail, password);
      router.replace("/(drawer)/(tabs)/account");
    } catch (cause) {
      setError(signInError(cause));
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
          <Text style={[styles.title, { color: colors.text }]}>Bienvenido de nuevo</Text>
          <Text style={[styles.description, { color: colors.icon }]}>
            Inicia sesión para ver tus compras y seguir comprando.
          </Text>
        </View>

        <View style={styles.form}>
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
            placeholder="Introduce tu contraseña"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditing={handleLogin}
            returnKeyType="go"
          />
          {error ? (
            <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>
              {error}
            </Text>
          ) : null}
          <Button
            title="Iniciar sesión"
            loading={loading}
            disabled={!email.trim() || !password}
            onPress={handleLogin}
          />
          <Link
            href="/(drawer)/(tabs)/account/forgot-password"
            accessibilityRole="link"
            style={[styles.forgot, { color: colors.tint }]}
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </View>

        <Text style={[styles.footer, { color: colors.icon }]}>
          ¿Nuevo en AgeStyles?{" "}
          <Link href="/(drawer)/(tabs)/account/register" style={{ color: colors.tint }}>
            Crear una cuenta
          </Link>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: 24, gap: 28, justifyContent: "center" },
  intro: { gap: 8 },
  title: { fontSize: 27, fontWeight: "700" },
  description: { fontSize: 15, lineHeight: 22 },
  form: { gap: 18 },
  error: { fontSize: 14, lineHeight: 20 },
  forgot: { fontSize: 14, textAlign: "center" },
  footer: { fontSize: 14, textAlign: "center" },
});

import { FormField } from "@/components/account/form-field";
import { Button } from "@/components/ui/button";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { sdk } from "@/lib/sdk";
import { Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

const SENT =
  "Si existe una cuenta con ese correo, te hemos enviado un enlace para elegir una contraseña nueva.";

export default function ForgotPasswordScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const identifier = email.trim().toLowerCase();
    if (!identifier.includes("@")) {
      setError("Introduce el correo electrónico de tu cuenta.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // The server answers the same way whether or not the account exists.
      await sdk.auth.resetPassword("customer", "emailpass", { identifier });
      setSent(true);
    } catch {
      setError("No se pudo enviar la solicitud. Revisa tu conexión e inténtalo de nuevo.");
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
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
            Recupera tu contraseña
          </Text>
          <Text style={[styles.description, { color: colors.icon }]}>
            Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una contraseña
            nueva.
          </Text>
        </View>

        {sent ? (
          <View style={styles.form}>
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={[styles.body, { color: colors.text }]}
            >
              {SENT}
            </Text>
            <Text style={[styles.description, { color: colors.icon }]}>
              Revisa también la carpeta de correo no deseado. El enlace caduca pronto.
            </Text>
            <Link
              href="/(drawer)/(tabs)/account/login"
              style={{ color: colors.tint, fontSize: 15 }}
            >
              Volver a iniciar sesión
            </Link>
          </View>
        ) : (
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
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
            />
            {error ? (
              <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>
                {error}
              </Text>
            ) : null}
            <Button
              title="Enviar enlace"
              loading={loading}
              disabled={!email.trim()}
              onPress={handleSubmit}
            />
          </View>
        )}
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
  body: { fontSize: 16, lineHeight: 23 },
  form: { gap: 18 },
  error: { fontSize: 14, lineHeight: 20 },
});

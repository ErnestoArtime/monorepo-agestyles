import { FormField } from "../components/account/form-field";
import { Button } from "../components/ui/button";
import { Colors } from "../constants/theme";
import { useColorScheme } from "../hooks/use-color-scheme";
import { sdk } from "../config";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { buyerHref } from "../config";

const EXPIRED =
  "El enlace ha caducado o ya se ha usado. Solicita uno nuevo para elegir tu contraseña.";

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

/**
 * Public screen opened from the password-reset email (`/reset-password?token=…&email=…`).
 * It needs no session: the emailed token is the credential for this single change.
 */
export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string; email?: string }>();
  const token = first(params.token);
  const email = first(params.email);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [expired, setExpired] = useState(!token);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await sdk.auth.updateProvider("customer", "emailpass", { password }, token);
      setDone(true);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      if (/unauthorized|invalid|expired|token|jwt/i.test(message)) setExpired(true);
      else setError("No se pudo cambiar la contraseña. Revisa tu conexión e inténtalo de nuevo.");
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
            Elige una contraseña nueva
          </Text>
          {email && !done && !expired ? (
            <Text style={[styles.description, { color: colors.icon }]}>Cuenta: {email}</Text>
          ) : null}
        </View>

        {done ? (
          <View style={styles.form}>
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={[styles.body, { color: colors.text }]}
            >
              Tu contraseña se ha actualizado. Ya puedes iniciar sesión.
            </Text>
            <Button
              title="Iniciar sesión"
              onPress={() => router.replace(buyerHref("/(drawer)/(tabs)/account/login"))}
            />
          </View>
        ) : expired ? (
          <View style={styles.form}>
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={[styles.body, { color: colors.error }]}
            >
              {EXPIRED}
            </Text>
            <Button
              title="Solicitar un enlace nuevo"
              onPress={() => router.replace(buyerHref("/(drawer)/(tabs)/account/forgot-password"))}
            />
          </View>
        ) : (
          <View style={styles.form}>
            <FormField
              label="Contraseña nueva"
              value={password}
              onChangeText={setPassword}
              placeholder="Al menos 8 caracteres"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="next"
            />
            <FormField
              label="Repite la contraseña"
              value={confirmation}
              onChangeText={setConfirmation}
              placeholder="Vuelve a escribirla"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
            />
            {error ? (
              <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>
                {error}
              </Text>
            ) : null}
            <Button
              title="Cambiar contraseña"
              loading={loading}
              disabled={!password || !confirmation}
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

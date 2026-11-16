import { FormField } from "@/components/account/form-field";
import { Button } from "@/components/ui/button";
import { Colors } from "@/constants/theme";
import { useCustomer } from "@/context/customer-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Link, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

function registrationError(error: unknown) {
  const message = error instanceof Error ? error.message : "Please check your details and try again.";
  if (/identity.*already exists|already.*registered|email.*already/i.test(message)) {
    return "An account already uses this email. Sign in instead.";
  }
  return message;
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
      setError("Enter your name, a valid email, and a password with at least 8 characters.");
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
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <Text style={[styles.title, { color: colors.text }]}>Create your account</Text>
          <Text style={[styles.description, { color: colors.icon }]}>Your purchases will be saved here when you shop while signed in.</Text>
        </View>

        <View style={styles.form}>
          <FormField label="First name" value={firstName} onChangeText={setFirstName} autoComplete="given-name" textContentType="givenName" returnKeyType="next" />
          <FormField label="Last name" value={lastName} onChangeText={setLastName} autoComplete="family-name" textContentType="familyName" returnKeyType="next" />
          <FormField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
          />
          <FormField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            onSubmitEditing={handleRegister}
            returnKeyType="go"
          />
          {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
          <Button
            title="Create account"
            loading={loading}
            disabled={!firstName.trim() || !lastName.trim() || !email.trim() || password.length < 8}
            onPress={handleRegister}
          />
        </View>

        <Text style={[styles.footer, { color: colors.icon }]}>Already have an account? <Link href="/(drawer)/(tabs)/account/login" style={{ color: colors.tint }}>Sign in</Link></Text>
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

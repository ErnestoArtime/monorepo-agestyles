import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Icon } from "@agestyles/icons";
import { BrandLockup } from "../components/brand-lockup";
import { Seller, useBusiness } from "../context/business-context";
import { useBusinessTheme } from "../hooks/use-business-theme";

export default function EntryScreen() {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const { ready, loading, error, sellers, seller, login, selectSeller } = useBusiness();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (seller) router.replace("/(tabs)");
  }, [seller, router]);

  async function onLogin() {
    setLocalError("");
    try {
      await login(email.trim(), password);
    } catch (cause) {
      setLocalError(
        cause instanceof Error ? cause.message : "Revisa tus datos e inténtalo de nuevo.",
      );
    }
  }
  async function onSelect(choice: Seller) {
    setLocalError("");
    try {
      await selectSeller(choice);
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : "No se pudo abrir esta tienda.");
    }
  }

  if (!ready)
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.action} />
        <Text style={styles.muted}>Conectando con AgeStyles…</Text>
      </View>
    );

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.brand}>
        <BrandLockup />
      </View>
      <Text style={styles.title}>{sellers.length ? "Elige una tienda" : "Gestiona tu tienda"}</Text>
      <Text style={styles.subtitle}>
        {sellers.length
          ? "Tu acceso y tus tareas dependen de la tienda seleccionada."
          : "Entra con tu cuenta de equipo para continuar."}
      </Text>

      {sellers.length > 0 ? (
        sellers.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => void onSelect(item)}
            style={({ pressed }) => [styles.seller, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <View style={styles.sellerIcon}>
              <Icon name="store" size={20} color={theme.action} />
            </View>
            <View style={styles.sellerInfo}>
              <Text style={styles.sellerName}>{item.name}</Text>
              <Text style={styles.muted}>
                {item.handle ? `@${item.handle}` : "Tienda AgeStyles"}
              </Text>
            </View>
            <Icon name="chevronRight" size={20} color={theme.muted} />
          </Pressable>
        ))
      ) : (
        <View style={styles.form}>
          <Text style={styles.label}>Correo del equipo</Text>
          <TextInput
            accessibilityLabel="Correo del equipo"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="nombre@tienda.com"
            placeholderTextColor={theme.placeholderText}
            style={styles.input}
          />
          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            accessibilityLabel="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            placeholder="Tu contraseña"
            placeholderTextColor={theme.placeholderText}
            style={styles.input}
          />
          <Pressable
            onPress={() => void onLogin()}
            disabled={loading || !email || !password}
            style={({ pressed }) => [
              styles.primary,
              (loading || !email || !password) && styles.disabled,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color={theme.onAction} />
            ) : (
              <Text style={styles.primaryText}>Continuar</Text>
            )}
          </Pressable>
        </View>
      )}
      {error || localError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {localError || error}
        </Text>
      ) : null}
      {loading && sellers.length > 0 ? (
        <ActivityIndicator style={{ marginTop: 18 }} color={theme.action} />
      ) : null}
      <View style={styles.note}>
        <Icon name="shieldCheck" size={20} color={theme.action} />
        <Text style={styles.noteText}>
          Los permisos se comprueban en el servidor para cada tienda.
        </Text>
      </View>
    </ScrollView>
  );
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    page: { flexGrow: 1, backgroundColor: theme.background, padding: 24, paddingTop: 56 },
    loading: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      backgroundColor: theme.background,
    },
    brand: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 54 },
    title: {
      fontSize: 31,
      lineHeight: 37,
      letterSpacing: -0.8,
      fontWeight: "600",
      color: theme.text,
    },
    subtitle: {
      color: theme.muted,
      fontSize: 16,
      lineHeight: 23,
      marginTop: 10,
      marginBottom: 28,
      maxWidth: 440,
    },
    form: { gap: 9 },
    label: { color: theme.text, fontSize: 14, fontWeight: "500", marginTop: 12 },
    input: {
      height: 52,
      paddingHorizontal: 15,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: 12,
      backgroundColor: theme.surface,
      fontSize: 16,
      color: theme.text,
    },
    primary: {
      minHeight: 52,
      backgroundColor: theme.action,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 17,
    },
    primaryText: { color: theme.onAction, fontSize: 16, fontWeight: "600" },
    disabled: { opacity: 0.45 },
    seller: {
      minHeight: 76,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      borderRadius: 14,
      paddingHorizontal: 15,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      marginBottom: 10,
    },
    sellerIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: theme.quietSurface,
      alignItems: "center",
      justifyContent: "center",
    },
    sellerInfo: { flex: 1, gap: 4 },
    sellerName: { color: theme.text, fontSize: 16, fontWeight: "600" },
    muted: { color: theme.muted, fontSize: 14 },
    pressed: { opacity: 0.72 },
    error: { color: theme.error, fontSize: 14, lineHeight: 20, marginTop: 15 },
    note: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      borderTopColor: theme.border,
      borderTopWidth: 1,
      marginTop: 30,
      paddingTop: 18,
    },
    noteText: { flex: 1, color: theme.muted, fontSize: 13, lineHeight: 19 },
  });

import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Icon } from "@agestyles/icons";
import { BrandLockup } from "../components/brand-lockup";
import { Seller, useBusiness } from "../context/business-context";

const C = { ink: "#171717", muted: "#6F6F6B", line: "#E4E4DF", paper: "#F7F7F4", navy: "#111B2D", white: "#FFFFFF", red: "#9B342A" };

export default function EntryScreen() {
  const router = useRouter();
  const { ready, loading, error, sellers, seller, login, selectSeller } = useBusiness();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => { if (seller) router.replace("/(tabs)"); }, [seller, router]);

  async function onLogin() {
    setLocalError("");
    try { await login(email.trim(), password); }
    catch (cause) { setLocalError(cause instanceof Error ? cause.message : "Revisa tus datos e inténtalo de nuevo."); }
  }
  async function onSelect(choice: Seller) {
    setLocalError("");
    try { await selectSeller(choice); }
    catch (cause) { setLocalError(cause instanceof Error ? cause.message : "No se pudo abrir esta tienda."); }
  }

  if (!ready) return <View style={s.loading}><ActivityIndicator color={C.navy} /><Text style={s.muted}>Conectando con AgeStyles…</Text></View>;

  return <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
    <View style={s.brand}><BrandLockup /></View>
    <Text style={s.title}>{sellers.length ? "Elige una tienda" : "Gestiona tu tienda"}</Text>
    <Text style={s.subtitle}>{sellers.length ? "Tu acceso y tus tareas dependen de la tienda seleccionada." : "Entra con tu cuenta de equipo para continuar."}</Text>

    {sellers.length > 0 ? sellers.map((item) => <Pressable key={item.id} onPress={() => void onSelect(item)} style={({ pressed }) => [s.seller, pressed && s.pressed]} accessibilityRole="button">
      <View style={s.sellerIcon}><Icon name="store" size={20} color={C.navy} /></View>
      <View style={s.sellerInfo}><Text style={s.sellerName}>{item.name}</Text><Text style={s.muted}>{item.handle ? `@${item.handle}` : "Tienda AgeStyles"}</Text></View>
      <Icon name="chevronRight" size={19} color={C.muted} />
    </Pressable>) : <View style={s.form}>
      <Text style={s.label}>Correo del equipo</Text>
      <TextInput accessibilityLabel="Correo del equipo" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="nombre@tienda.com" placeholderTextColor="#777773" style={s.input} />
      <Text style={s.label}>Contraseña</Text>
      <TextInput accessibilityLabel="Contraseña" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" placeholder="Tu contraseña" placeholderTextColor="#777773" style={s.input} />
      <Pressable onPress={() => void onLogin()} disabled={loading || !email || !password} style={({ pressed }) => [s.primary, (loading || !email || !password) && s.disabled, pressed && s.pressed]} accessibilityRole="button">
        {loading ? <ActivityIndicator color={C.white} /> : <Text style={s.primaryText}>Continuar</Text>}
      </Pressable>
    </View>}
    {(error || localError) ? <Text accessibilityRole="alert" style={s.error}>{localError || error}</Text> : null}
    {loading && sellers.length > 0 ? <ActivityIndicator style={{ marginTop: 18 }} color={C.navy} /> : null}
    <View style={s.note}><Icon name="shieldCheck" size={17} color={C.navy} /><Text style={s.noteText}>Los permisos se comprueban en el servidor para cada tienda.</Text></View>
  </ScrollView>;
}

const s = StyleSheet.create({ page: { flexGrow: 1, backgroundColor: C.paper, padding: 24, paddingTop: 56 }, loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, backgroundColor: C.paper }, brand: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 54 }, title: { fontSize: 31, lineHeight: 37, letterSpacing: -0.8, fontWeight: "600", color: C.ink }, subtitle: { color: C.muted, fontSize: 16, lineHeight: 23, marginTop: 10, marginBottom: 28, maxWidth: 440 }, form: { gap: 9 }, label: { color: C.ink, fontSize: 14, fontWeight: "500", marginTop: 12 }, input: { height: 52, paddingHorizontal: 15, borderColor: C.line, borderWidth: 1, borderRadius: 12, backgroundColor: C.white, fontSize: 16, color: C.ink }, primary: { minHeight: 52, backgroundColor: C.navy, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 17 }, primaryText: { color: C.white, fontSize: 16, fontWeight: "600" }, disabled: { opacity: 0.45 }, seller: { minHeight: 76, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, borderRadius: 14, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 10 }, sellerIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: C.paper, alignItems: "center", justifyContent: "center" }, sellerInfo: { flex: 1, gap: 4 }, sellerName: { color: C.ink, fontSize: 16, fontWeight: "600" }, muted: { color: C.muted, fontSize: 14 }, pressed: { opacity: 0.72 }, error: { color: C.red, fontSize: 14, lineHeight: 20, marginTop: 15 }, note: { flexDirection: "row", alignItems: "center", gap: 9, borderTopColor: C.line, borderTopWidth: 1, marginTop: 30, paddingTop: 18 }, noteText: { flex: 1, color: C.muted, fontSize: 13, lineHeight: 19 } });

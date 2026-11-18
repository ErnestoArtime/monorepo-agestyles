import { Button } from "@agestyles/ui-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { AuthInput, AuthNotice, AuthScreen } from "../components/auth-screen";
import { useAdmin } from "../context/admin-context";
import { acceptAdminInvite } from "../context/admin-actor";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Accepting an invitation to the marketplace administration (AG-32): the invited person
 * chooses a password here, from the link the administrator sent.
 */
export default function AcceptInviteScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { refreshAdmin } = useAdmin();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!token) return setError("El enlace no es válido. Pide una invitación nueva.");
    if (!firstName.trim()) return setError("Escribe tu nombre.");
    if (!EMAIL.test(email.trim())) return setError("Escribe el correo al que llegó la invitación.");
    if (password.length < 8) return setError("La contraseña necesita al menos 8 caracteres.");
    setBusy(true);
    try {
      const signedIn = await acceptAdminInvite({
        token,
        email: email.trim().toLowerCase(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      await refreshAdmin();
      router.replace(signedIn ? "/admin" : "/");
    } catch {
      setError(
        "No se pudo aceptar la invitación: puede haber caducado, ya estar usada o ser para otro correo.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthScreen
      title="Únete a la administración"
      subtitle="Te han invitado a administrar el marketplace AgeStyles. Elige tu contraseña para entrar."
    >
      {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}
      <AuthInput
        label="Nombre"
        value={firstName}
        onChangeText={setFirstName}
        autoComplete="given-name"
      />
      <AuthInput
        label="Apellidos"
        value={lastName}
        onChangeText={setLastName}
        autoComplete="family-name"
      />
      <AuthInput
        label="Correo"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        placeholder="El correo de la invitación"
      />
      <AuthInput
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        placeholder="Al menos 8 caracteres"
      />
      <Button title="Crear mi acceso" onPress={() => void submit()} loading={busy} />
    </AuthScreen>
  );
}

import { Button } from "@agestyles/ui-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { AuthInput, AuthNotice, AuthScreen } from "../components/auth-screen";
import { completePasswordReset, PasswordResetError } from "../context/business-context";

const MIN_LENGTH = 8;

type Phase = "idle" | "saving" | "done" | "expired" | "failed";

/** Opened from the link in the reset email: `/reset-password?token=…&email=…`. */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string; email?: string }>();
  const token = typeof params.token === "string" ? params.token : "";
  const email = typeof params.email === "string" ? params.email : "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [problem, setProblem] = useState("");

  async function submit() {
    if (password.length < MIN_LENGTH) {
      return setProblem(`La contraseña necesita al menos ${MIN_LENGTH} caracteres.`);
    }
    if (password !== confirmation) return setProblem("Las contraseñas no coinciden.");
    setProblem("");
    setPhase("saving");
    try {
      await completePasswordReset(token, password);
      setPhase("done");
    } catch (cause) {
      setPhase(
        cause instanceof PasswordResetError && cause.kind === "expired" ? "expired" : "failed",
      );
    }
  }

  if (!token || phase === "expired") {
    return (
      <AuthScreen
        title="Enlace no válido"
        subtitle="Este enlace ha caducado, ya se usó o no es correcto."
      >
        <AuthNotice tone="error">Solicita un enlace nuevo para elegir tu contraseña.</AuthNotice>
        <Button title="Solicitar otro enlace" onPress={() => router.replace("/forgot-password")} />
        <Button
          title="Volver a iniciar sesión"
          variant="secondary"
          onPress={() => router.replace("/")}
        />
      </AuthScreen>
    );
  }

  if (phase === "done") {
    return (
      <AuthScreen
        title="Contraseña actualizada"
        subtitle="Ya puedes entrar con tu contraseña nueva."
      >
        <AuthNotice tone="success">Tu contraseña se ha cambiado correctamente.</AuthNotice>
        <Button title="Iniciar sesión" onPress={() => router.replace("/")} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Elige una contraseña nueva"
      subtitle={email ? `Cuenta: ${email}` : "Elige una contraseña para tu cuenta de equipo."}
    >
      <AuthInput
        label="Contraseña nueva"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        placeholder={`Al menos ${MIN_LENGTH} caracteres`}
      />
      <AuthInput
        label="Repite la contraseña"
        value={confirmation}
        onChangeText={setConfirmation}
        secureTextEntry
        autoComplete="new-password"
        placeholder="Vuelve a escribirla"
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
      />
      {problem ? <AuthNotice tone="error">{problem}</AuthNotice> : null}
      {phase === "failed" ? (
        <AuthNotice tone="error">
          No se pudo cambiar la contraseña. Inténtalo de nuevo en unos minutos.
        </AuthNotice>
      ) : null}
      <Button
        title="Guardar contraseña"
        loading={phase === "saving"}
        disabled={!password || !confirmation}
        onPress={() => void submit()}
      />
    </AuthScreen>
  );
}

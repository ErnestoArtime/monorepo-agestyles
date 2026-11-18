import { Button } from "@agestyles/ui-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { AuthInput, AuthNotice, AuthScreen } from "../components/auth-screen";
import { requestPasswordReset } from "../context/business-context";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<"idle" | "sending" | "sent" | "error" | "invalid">("idle");

  async function submit() {
    if (!EMAIL.test(email.trim())) return setPhase("invalid");
    setPhase("sending");
    try {
      await requestPasswordReset(email);
      setPhase("sent");
    } catch {
      setPhase("error");
    }
  }

  return (
    <AuthScreen
      title="Recupera tu contraseña"
      subtitle="Escribe el correo de tu cuenta de equipo y te enviaremos un enlace para elegir una contraseña nueva."
    >
      {phase === "sent" ? (
        <AuthNotice tone="success">
          Si existe una cuenta con ese correo, te hemos enviado un enlace para elegir una contraseña
          nueva.
        </AuthNotice>
      ) : (
        <>
          <AuthInput
            label="Correo del equipo"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (phase === "invalid" || phase === "error") setPhase("idle");
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="nombre@tienda.com"
            returnKeyType="send"
            onSubmitEditing={() => void submit()}
          />
          {phase === "invalid" ? (
            <AuthNotice tone="error">Escribe un correo válido.</AuthNotice>
          ) : null}
          {phase === "error" ? (
            <AuthNotice tone="error">
              No se pudo enviar la solicitud. Revisa tu conexión e inténtalo de nuevo.
            </AuthNotice>
          ) : null}
          <Button
            title="Enviar enlace"
            loading={phase === "sending"}
            disabled={!email.trim()}
            onPress={() => void submit()}
          />
        </>
      )}
      <Button
        title="Volver a iniciar sesión"
        variant="secondary"
        onPress={() => router.replace("/")}
      />
    </AuthScreen>
  );
}

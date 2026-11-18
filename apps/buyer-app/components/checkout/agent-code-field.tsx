import { Button } from "@/components/ui/button";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  AGENT_CODE_METADATA_KEY,
  forgetAgentCode,
  lookupAgentCode,
  normalizeAgentCode,
  pendingAgentCode,
  setCartAgentCode,
  type AgentCodeInfo,
} from "@/lib/agent-code";
import { Icon } from "@agestyles/icons";
import type { HttpTypes } from "@medusajs/types";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

interface AgentCodeFieldProps {
  cart: HttpTypes.StoreCart;
  onChanged: () => Promise<void> | void;
}

/** Optional «código de gestor» at checkout: validated, then kept in the cart metadata. */
export function AgentCodeField({ cart, onChanged }: AgentCodeFieldProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const saved = normalizeAgentCode(
    (cart.metadata as Record<string, unknown> | null | undefined)?.[AGENT_CODE_METADATA_KEY],
  );
  const [open, setOpen] = useState(Boolean(saved));
  const [value, setValue] = useState(saved ?? "");
  const [applied, setApplied] = useState<AgentCodeInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(
    async (raw: string, { quiet = false } = {}) => {
      const code = normalizeAgentCode(raw);
      if (!code) {
        if (!quiet) setError("El código tiene entre 4 y 12 letras o números.");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const info = await lookupAgentCode(code);
        if (!info) {
          if (!quiet) setError("No encontramos ese código. Revísalo con quien te atendió.");
          return;
        }
        await setCartAgentCode(cart.id, info.code);
        setApplied(info);
        setValue(info.code);
        setOpen(true);
        await onChanged();
      } catch {
        if (!quiet) setError("No se pudo comprobar el código. Inténtalo de nuevo.");
      } finally {
        setBusy(false);
      }
    },
    [cart.id, onChanged],
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const initial = saved ?? (await pendingAgentCode());
      if (active && initial) await apply(initial, { quiet: true });
    })();
    return () => {
      active = false;
    };
    // Only on entering the payment step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = async () => {
    setBusy(true);
    try {
      await setCartAgentCode(cart.id, null);
      await forgetAgentCode();
      setApplied(null);
      setValue("");
      await onChanged();
    } catch {
      setError("No se pudo quitar el código. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <TouchableOpacity
        style={styles.toggle}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Añadir código de gestor de venta"
      >
        <Icon name="user" size={18} color={colors.tint} />
        <Text style={[styles.toggleText, { color: colors.tint }]}>
          ¿Te atendió un gestor de venta? Añade su código
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.box, { borderColor: colors.icon + "30" }]}>
      <Text style={[styles.label, { color: colors.text }]}>Código de gestor (opcional)</Text>
      {applied ? (
        <View style={styles.appliedRow}>
          <Icon name="check" size={18} color={colors.tint} />
          <Text style={[styles.appliedText, { color: colors.text }]}>
            {applied.code}
            {applied.seller_name ? ` · ${applied.seller_name}` : ""}
          </Text>
          <TouchableOpacity
            onPress={remove}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Quitar código de gestor"
          >
            <Text style={[styles.link, { color: colors.tint }]}>Quitar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.inputRow}>
          <TextInput
            value={value}
            onChangeText={(text) => {
              setValue(text.toUpperCase());
              setError(null);
            }}
            placeholder="Por ejemplo, ANA24"
            placeholderTextColor={colors.icon}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={12}
            onSubmitEditing={() => apply(value)}
            accessibilityLabel="Código de gestor"
            style={[
              styles.input,
              { color: colors.text, borderColor: error ? colors.error : colors.icon + "50" },
            ]}
          />
          <Button
            title="Aplicar"
            variant="secondary"
            onPress={() => apply(value)}
            loading={busy}
            disabled={!value.trim()}
          />
        </View>
      )}
      {error ? (
        <Text style={[styles.hint, { color: colors.error }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : (
        <Text style={[styles.hint, { color: colors.icon }]}>
          {applied?.seller_name
            ? `Cuenta para los productos de ${applied.seller_name}.`
            : "La venta quedará a nombre del gestor de la tienda que te atendió."}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 },
  toggleText: { fontSize: 15, fontWeight: "600", flexShrink: 1 },
  box: { borderWidth: 1, borderRadius: 8, padding: 16, gap: 10, marginTop: 8 },
  label: { fontSize: 16, fontWeight: "600" },
  inputRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  input: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    letterSpacing: 1,
  },
  appliedRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  appliedText: { flex: 1, fontSize: 16, fontWeight: "600" },
  link: { fontSize: 15, fontWeight: "600" },
  hint: { fontSize: 13 },
});

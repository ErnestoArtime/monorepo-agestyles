import type { StoreInfo } from "@agestyles/api-client/store-info";
import { useCallback } from "react";
import { StoreInfoEditor } from "../components/store-info-editor";
import { useBusiness } from "../context/business-context";

/**
 * «Información de la tienda» (AG-55): the data buyers see on the store's page in Tienda and
 * Catálogo. Everyone in the team can read it; the owner or administration edits it.
 */
export default function StoreInfoScreen() {
  const { request } = useBusiness();
  const load = useCallback(
    () => request<{ info: StoreInfo; can_edit?: boolean }>("/vendor/agestyles/store-info"),
    [request],
  );
  const save = useCallback(
    (info: Record<string, unknown>) =>
      request<{ info: StoreInfo }>("/vendor/agestyles/store-info", "POST", info),
    [request],
  );
  return (
    <StoreInfoEditor
      backLabel="Más"
      title="Información de la tienda"
      subtitle="Lo que ven los compradores en la página de tu tienda: cómo atiendes, contacto, dirección, horario y redes."
      load={load}
      save={save}
    />
  );
}

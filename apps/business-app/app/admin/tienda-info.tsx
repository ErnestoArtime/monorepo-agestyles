import type { StoreInfo } from "@agestyles/api-client/store-info";
import { useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { StoreInfoEditor } from "../../components/store-info-editor";
import { useAdmin } from "../../context/admin-context";

/**
 * Administración → Tiendas → «Información»: the marketplace administration edits the public
 * information of any store (AG-55), with the same editor and validation as the store itself.
 */
export default function AdminStoreInfoScreen() {
  const { id, name } = useLocalSearchParams<{ id?: string; name?: string }>();
  const { adminRequest } = useAdmin();
  const path = `/admin/agestyles/stores/${encodeURIComponent(String(id ?? ""))}/info`;
  const load = useCallback(() => adminRequest<{ info: StoreInfo }>(path), [adminRequest, path]);
  const save = useCallback(
    (info: Record<string, unknown>) => adminRequest<{ info: StoreInfo }>(path, "POST", info),
    [adminRequest, path],
  );
  return (
    <StoreInfoEditor
      backLabel="Tiendas"
      title={name ? `Información · ${name}` : "Información de la tienda"}
      subtitle="Cómo atiende, contacto, dirección, horario y redes que ven los compradores. Los cambios se publican al guardar."
      load={load}
      save={save}
    />
  );
}

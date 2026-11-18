import {
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
  PillGroup,
  SearchField,
  StatusBadge,
} from "@agestyles/ui-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { CardGrid } from "../../components/card-grid";
import { OperationList } from "../../components/operation-list";
import { useAdmin } from "../../context/admin-context";
import { useBusinessTheme } from "../../hooks/use-business-theme";
import { adminError, personName, SELLER_STATUS, shortDate, STORE_ROLES } from "../../lib/admin";
import { memberRoleLabel } from "../../lib/roles";

type Store = {
  id: string;
  name: string;
  handle: string;
  email?: string | null;
  phone?: string | null;
  status: string;
  status_reason?: string | null;
  created_at?: string;
};
type StoreMember = {
  id: string;
  is_owner?: boolean;
  role_id?: string | null;
  member?: { email?: string | null; first_name?: string | null; last_name?: string | null };
};
type Lifecycle = "approve" | "suspend" | "unsuspend";

const FILTERS = [
  { value: "all", label: "Todas" },
  { value: "pending_approval", label: "Pendientes" },
  { value: "open", label: "Abiertas" },
  { value: "suspended", label: "Suspendidas" },
];

const ACTION_COPY: Record<Lifecycle, { title: string; message: string; done: string }> = {
  approve: {
    title: "Aprobar tienda",
    message: "La tienda podrá publicar productos y vender en el marketplace.",
    done: "Tienda aprobada.",
  },
  suspend: {
    title: "Suspender tienda",
    message: "Sus productos dejan de venderse hasta que la reactives.",
    done: "Tienda suspendida.",
  },
  unsuspend: {
    title: "Reactivar tienda",
    message: "La tienda vuelve a vender con normalidad.",
    done: "Tienda reactivada.",
  },
};

/** Every store of the marketplace: status, members and roles, approval and suspension. */
export default function AdminStoresScreen() {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const { adminRequest } = useAdmin();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Store | null>(null);
  const [members, setMembers] = useState<StoreMember[]>([]);
  const [action, setAction] = useState<{ store: Store; kind: Lifecycle } | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState(STORE_ROLES[0].value);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminRequest<{ sellers: Store[] }>(
        "/admin/sellers?limit=200&fields=id,name,handle,email,phone,status,status_reason,created_at",
      );
      setStores(data.sellers ?? []);
    } catch (cause) {
      setError(adminError(cause, "No se pudieron cargar las tiendas."));
    } finally {
      setLoading(false);
    }
  }, [adminRequest]);

  useEffect(() => {
    void load();
  }, [load]);

  const openStore = async (store: Store) => {
    setOpen(store);
    setMembers([]);
    try {
      const data = await adminRequest<{ seller_members: StoreMember[] }>(
        `/admin/sellers/${store.id}/members?fields=id,is_owner,role_id,member.email,member.first_name,member.last_name`,
      );
      setMembers(data.seller_members ?? []);
    } catch (cause) {
      setError(adminError(cause, "No se pudieron cargar los miembros de la tienda."));
    }
  };

  const visible = useMemo(
    () =>
      stores.filter(
        (store) =>
          (filter === "all" || store.status === filter) &&
          (!query.trim() ||
            `${store.name} ${store.handle} ${store.email ?? ""}`
              .toLowerCase()
              .includes(query.trim().toLowerCase())),
      ),
    [filter, query, stores],
  );

  async function runAction() {
    const current = action;
    setAction(null);
    if (!current) return;
    setBusy(true);
    setError("");
    try {
      await adminRequest(`/admin/sellers/${current.store.id}/${current.kind}`, "POST", {});
      setNotice(ACTION_COPY[current.kind].done);
      setOpen(null);
      await load();
    } catch (cause) {
      setError(adminError(cause, "No se pudo cambiar el estado de la tienda."));
    } finally {
      setBusy(false);
    }
  }

  async function inviteMember(store: Store) {
    const email = inviteEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Escribe un correo válido.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await adminRequest(`/admin/sellers/${store.id}/members/invite`, "POST", {
        email,
        role_id: inviteRole,
      });
      setInviteEmail("");
      setNotice(`Invitación enviada a ${email} para ${store.name}.`);
    } catch (cause) {
      setError(adminError(cause, "No se pudo invitar a esa persona."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <OperationList
      title="Tiendas"
      subtitle="Todas las tiendas del marketplace, su estado y su equipo."
      loading={loading}
      error={error}
      empty="No hay tiendas que coincidan."
      isEmpty={!visible.length}
      onRefresh={() => void load()}
    >
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      <View style={styles.toolbar}>
        <SearchField value={query} onChangeText={setQuery} placeholder="Buscar tienda" />
        <PillGroup
          accessibilityLabel="Estado de la tienda"
          value={filter}
          onChange={setFilter}
          options={FILTERS}
        />
      </View>
      {visible.length ? (
        <CardGrid>
          {visible.map((store) => {
            const status = SELLER_STATUS[store.status] ?? {
              label: "Estado desconocido",
              tone: "neutral" as const,
            };
            return (
              <Card
                key={store.id}
                onPress={() => void openStore(store)}
                accessibilityLabel={`${store.name}, ${status.label}`}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {store.name}
                  </Text>
                  <StatusBadge label={status.label} tone={status.tone} />
                </View>
                <Text style={styles.muted}>
                  @{store.handle}
                  {store.created_at ? ` · desde ${shortDate(store.created_at)}` : ""}
                </Text>
              </Card>
            );
          })}
        </CardGrid>
      ) : null}

      <BottomSheet visible={!!open} onClose={() => setOpen(null)} title={open?.name}>
        {open ? (
          <View style={styles.sheet}>
            <StatusBadge
              label={SELLER_STATUS[open.status]?.label ?? "Estado desconocido"}
              tone={SELLER_STATUS[open.status]?.tone ?? "neutral"}
            />
            <Text style={styles.muted}>
              @{open.handle}
              {open.email ? ` · ${open.email}` : ""}
              {open.phone ? ` · ${open.phone}` : ""}
            </Text>
            {open.status_reason ? (
              <Text style={styles.muted}>Motivo: {open.status_reason}</Text>
            ) : null}
            <View style={styles.actions}>
              {open.status === "pending_approval" ? (
                <Button
                  title="Aprobar"
                  onPress={() => setAction({ store: open, kind: "approve" })}
                />
              ) : null}
              {open.status === "open" ? (
                <Button
                  title="Suspender"
                  variant="secondary"
                  onPress={() => setAction({ store: open, kind: "suspend" })}
                />
              ) : null}
              {open.status === "suspended" ? (
                <Button
                  title="Reactivar"
                  onPress={() => setAction({ store: open, kind: "unsuspend" })}
                />
              ) : null}
            </View>

            <Text style={styles.heading}>Equipo</Text>
            {members.length ? (
              members.map((item) => (
                <View key={item.id} style={styles.memberRow}>
                  <View style={styles.flex}>
                    <Text style={styles.cardTitle}>{personName(item.member ?? {})}</Text>
                    <Text style={styles.muted}>{item.member?.email}</Text>
                  </View>
                  <StatusBadge label={memberRoleLabel(item)} tone="neutral" />
                </View>
              ))
            ) : (
              <Text style={styles.muted}>Cargando el equipo…</Text>
            )}

            <Text style={styles.heading}>Invitar a la tienda</Text>
            <TextInput
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="correo@ejemplo.com"
              placeholderTextColor={theme.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              accessibilityLabel="Correo de la persona a invitar"
              style={styles.input}
            />
            <PillGroup
              accessibilityLabel="Rol en la tienda"
              value={inviteRole}
              onChange={setInviteRole}
              options={STORE_ROLES}
            />
            <Button
              title="Invitar a la tienda"
              variant="secondary"
              onPress={() => void inviteMember(open)}
              loading={busy}
            />
          </View>
        ) : null}
      </BottomSheet>

      <ConfirmDialog
        visible={!!action}
        tone="warning"
        title={action ? ACTION_COPY[action.kind].title : ""}
        message={action ? `${action.store.name}: ${ACTION_COPY[action.kind].message}` : ""}
        primary={{ label: "Confirmar", onPress: () => void runAction() }}
        secondary={{ label: "Cancelar", onPress: () => setAction(null) }}
        onClose={() => setAction(null)}
      />
    </OperationList>
  );
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    toolbar: { gap: 12, marginBottom: 14 },
    notice: { color: theme.successText, fontSize: 14, lineHeight: 20, marginBottom: 12 },
    cardTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      justifyContent: "space-between",
    },
    cardTitle: { color: theme.text, fontSize: 15, fontWeight: "600", flexShrink: 1 },
    muted: { color: theme.muted, fontSize: 13, lineHeight: 18, marginTop: 4 },
    sheet: { gap: 10 },
    actions: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 4 },
    heading: { color: theme.text, fontSize: 16, fontWeight: "700", marginTop: 14 },
    memberRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
    flex: { flex: 1 },
    input: {
      minHeight: 44,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      color: theme.text,
      backgroundColor: theme.surface,
      fontSize: 15,
    },
  });

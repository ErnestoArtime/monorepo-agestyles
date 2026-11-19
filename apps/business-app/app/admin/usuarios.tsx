import { Button, PillGroup, SearchField, StatusBadge } from "@agestyles/ui-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { OperationList, Section } from "../../components/operation-list";
import { useAdmin } from "../../context/admin-context";
import { useBusinessTheme } from "../../hooks/use-business-theme";
import { adminError, inviteLink, personName, shortDate, STORE_ROLES } from "../../lib/admin";
import { memberRoleLabel } from "../../lib/roles";

type PersonStore = {
  seller_member_id: string;
  seller_id: string;
  seller_name: string;
  role_id: string | null;
  is_owner: boolean;
};
type Person = {
  email: string;
  first_name: string | null;
  last_name: string | null;
  customer_id: string | null;
  user_id: string | null;
  has_password: boolean;
  legacy_role: string | null;
  created_at: string | null;
  stores: PersonStore[];
};
type Invite = { id: string; email: string; accepted: boolean; token: string; expires_at?: string };
type Store = { id: string; name: string; status?: string };
type Filter = "all" | "admins" | "teams" | "customers" | "legacy";

const FILTERS: { value: Filter; label: string; test: (p: Person) => boolean }[] = [
  { value: "all", label: "Todas", test: () => true },
  { value: "admins", label: "Administradores", test: (p) => Boolean(p.user_id) },
  { value: "teams", label: "Equipos de tienda", test: (p) => p.stores.length > 0 },
  { value: "customers", label: "Clientes", test: (p) => Boolean(p.customer_id) },
  { value: "legacy", label: "Catálogo antiguo", test: (p) => Boolean(p.legacy_role) },
];

const LEGACY_ROLE: Record<string, string> = {
  admin: "administrador",
  gestor_venta: "gestor de venta",
  user: "cliente",
};

/** The server's own Spanish message for rule violations (400/409), else a generic one. */
function actionError(cause: unknown, fallback: string) {
  const status = (cause as { status?: number })?.status;
  const message = (cause as { message?: string })?.message;
  if ((status === 400 || status === 409) && message) return message;
  return adminError(cause, fallback);
}

function confirmAction(message: string): Promise<boolean> {
  if (Platform.OS === "web")
    return Promise.resolve(typeof window === "undefined" || window.confirm(message));
  return new Promise((resolve) =>
    Alert.alert("Confirmar", message, [
      { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
      { text: "Sí, continuar", style: "destructive", onPress: () => resolve(true) },
    ]),
  );
}

/**
 * Everyone in the marketplace as one list (AG-45). Each person opens to their roles and the
 * superadmin's actions: marketplace administration, store teams and roles. The API checks
 * every rule; this screen only offers what makes sense.
 */
export default function AdminUsersScreen() {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const { adminRequest, admin } = useAdmin();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [addStore, setAddStore] = useState<string | null>(null);
  const [addRole, setAddRole] = useState<string>(STORE_ROLES[0].value);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [peopleData, invitations, sellers] = await Promise.all([
        adminRequest<{ people: Person[] }>("/admin/agestyles/people"),
        adminRequest<{ invites: Invite[] }>("/admin/invites?limit=100"),
        adminRequest<{ sellers: Store[] }>("/admin/sellers?limit=200&fields=id,name,status"),
      ]);
      setPeople(peopleData.people ?? []);
      setInvites((invitations.invites ?? []).filter((invite) => !invite.accepted));
      setStores(
        (sellers.sellers ?? [])
          .filter((store) => store.status !== "terminated")
          .sort((a, b) => a.name.localeCompare(b.name, "es")),
      );
    } catch (cause) {
      setError(adminError(cause, "No se pudieron cargar los usuarios."));
    } finally {
      setLoading(false);
    }
  }, [adminRequest]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map((item) => [item.value, people.filter(item.test).length]),
      ) as Record<Filter, number>,
    [people],
  );
  const visible = useMemo(() => {
    const test = FILTERS.find((item) => item.value === filter)?.test ?? (() => true);
    const text = query.trim().toLowerCase();
    return people.filter(
      (person) =>
        test(person) &&
        (!text ||
          `${person.email} ${person.first_name ?? ""} ${person.last_name ?? ""}`
            .toLowerCase()
            .includes(text)),
    );
  }, [filter, people, query]);

  async function act(body: Record<string, unknown>, done: string, confirm?: string) {
    if (confirm && !(await confirmAction(confirm))) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { person } = await adminRequest<{ person: Person | null }>(
        "/admin/agestyles/people",
        "POST",
        body,
      );
      if (person)
        setPeople((current) => current.map((p) => (p.email === person.email ? person : p)));
      setNotice(done);
    } catch (cause) {
      setError(actionError(cause, "No se pudo completar la acción."));
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite(invite: Invite) {
    const link = inviteLink(invite.token);
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(link);
        setNotice(`Enlace de invitación para ${invite.email} copiado. Envíaselo a esa persona.`);
      } else {
        await Share.share({ message: `Invitación a la administración de AgeStyles: ${link}` });
      }
    } catch {
      setError("No se pudo copiar el enlace.");
    }
  }

  async function invite(emailInput = inviteEmail) {
    const email = emailInput.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Escribe un correo válido.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { invite: created } = await adminRequest<{ invite: Invite }>("/admin/invites", "POST", {
        email,
      });
      setInviteEmail("");
      await load();
      if (created?.token) await copyInvite(created);
    } catch (cause) {
      setError(adminError(cause, "No se pudo crear la invitación. ¿Ya tiene una pendiente?"));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(item: Invite) {
    setBusy(true);
    try {
      await adminRequest(`/admin/invites/${item.id}`, "DELETE");
      setNotice(`Invitación para ${item.email} retirada.`);
      await load();
    } catch (cause) {
      setError(adminError(cause, "No se pudo retirar la invitación."));
    } finally {
      setBusy(false);
    }
  }

  function toggle(person: Person) {
    setOpen((current) => (current === person.email ? null : person.email));
    setAddStore(null);
    setAddRole(STORE_ROLES[0].value);
  }

  function renderActions(person: Person) {
    const name = personName(person);
    const isMe = Boolean(person.user_id && person.user_id === admin?.id);
    const freeStores = stores.filter((s) => !person.stores.some((m) => m.seller_id === s.id));
    return (
      <View style={styles.panel}>
        {!person.has_password ? (
          <Text style={styles.warning}>
            Aún no tiene contraseña en AgeStyles. Si viene del catálogo antiguo, se activa cuando
            entre una vez en la Tienda; si es nueva, invítala.
          </Text>
        ) : null}

        <Text style={styles.panelTitle}>Administración del marketplace</Text>
        <View style={styles.inline}>
          <Text style={[styles.muted, styles.flex]}>
            {person.user_id
              ? "Tiene acceso completo a la administración de AgeStyles."
              : "No administra el marketplace."}
          </Text>
          {person.user_id ? (
            isMe ? (
              <StatusBadge label="Tú" tone="success" />
            ) : (
              <Button
                title="Quitar administración"
                variant="danger"
                disabled={busy}
                onPress={() =>
                  void act(
                    { action: "revoke_admin", email: person.email },
                    `${name} ya no administra el marketplace.`,
                    `¿Quitar la administración del marketplace a ${name}?`,
                  )
                }
              />
            )
          ) : person.has_password ? (
            <Button
              title="Dar administración"
              variant="secondary"
              disabled={busy}
              onPress={() =>
                void act(
                  { action: "grant_admin", email: person.email },
                  `${name} ya administra el marketplace.`,
                  `¿Dar a ${name} acceso completo a la administración del marketplace?`,
                )
              }
            />
          ) : (
            <Button
              title="Invitar como administrador"
              variant="secondary"
              disabled={busy}
              onPress={() => void invite(person.email)}
            />
          )}
        </View>

        <Text style={styles.panelTitle}>Tiendas</Text>
        {person.stores.length ? (
          person.stores.map((store) => (
            <View key={store.seller_member_id} style={styles.storeBlock}>
              <View style={styles.inline}>
                <Text style={[styles.rowTitle, styles.flex]}>{store.seller_name}</Text>
                {store.is_owner ? (
                  <StatusBadge label="Propietario" tone="success" />
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() =>
                      void act(
                        {
                          action: "remove_from_store",
                          email: person.email,
                          seller_member_id: store.seller_member_id,
                        },
                        `${name} ya no está en el equipo de ${store.seller_name}.`,
                        `¿Quitar a ${name} del equipo de ${store.seller_name}?`,
                      )
                    }
                  >
                    <Text style={styles.danger}>Quitar de la tienda</Text>
                  </Pressable>
                )}
              </View>
              {store.is_owner ? (
                <Text style={styles.muted}>
                  El propietario conserva todos los permisos de su tienda.
                </Text>
              ) : (
                <PillGroup
                  accessibilityLabel={`Rol en ${store.seller_name}`}
                  value={store.role_id}
                  onChange={(role) =>
                    role !== store.role_id &&
                    void act(
                      {
                        action: "change_role",
                        email: person.email,
                        seller_member_id: store.seller_member_id,
                        role_id: role,
                      },
                      `${name} ahora es ${memberRoleLabel({ role_id: role }).toLowerCase()} en ${store.seller_name}.`,
                    )
                  }
                  options={STORE_ROLES.map((role) => ({ ...role, disabled: busy }))}
                />
              )}
            </View>
          ))
        ) : (
          <Text style={styles.muted}>No forma parte del equipo de ninguna tienda.</Text>
        )}

        {person.has_password && freeStores.length ? (
          <View style={styles.storeBlock}>
            <Text style={styles.rowTitle}>Añadir a una tienda</Text>
            <PillGroup
              accessibilityLabel="Tienda"
              value={addStore}
              onChange={setAddStore}
              options={freeStores.map((store) => ({ value: store.id, label: store.name }))}
            />
            {addStore ? (
              <>
                <PillGroup
                  accessibilityLabel="Rol en la tienda"
                  value={addRole}
                  onChange={setAddRole}
                  options={STORE_ROLES}
                />
                <Button
                  title="Añadir al equipo"
                  loading={busy}
                  onPress={() => {
                    const store = stores.find((s) => s.id === addStore);
                    void act(
                      {
                        action: "add_to_store",
                        email: person.email,
                        seller_id: addStore,
                        role_id: addRole,
                      },
                      `${name} ya forma parte del equipo de ${store?.name ?? "la tienda"}.`,
                    ).then(() => setAddStore(null));
                  }}
                />
              </>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.muted}>
          {[
            person.customer_id ? "Tiene cuenta de cliente en la Tienda" : null,
            person.legacy_role
              ? `En el catálogo antiguo era ${LEGACY_ROLE[person.legacy_role] ?? person.legacy_role}`
              : null,
            person.created_at ? `Desde el ${shortDate(person.created_at)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
    );
  }

  return (
    <OperationList
      title="Usuarios"
      subtitle="Todas las personas del marketplace: administración, equipos de tienda y clientes. Abre una para gestionar sus permisos."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
    >
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      <View style={styles.toolbar}>
        <PillGroup
          accessibilityLabel="Tipo de usuario"
          value={filter}
          onChange={(value) => setFilter(value as Filter)}
          options={FILTERS.map((item) => ({
            value: item.value,
            label: `${item.label} (${counts[item.value] ?? 0})`,
          }))}
        />
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por nombre o correo"
        />
      </View>

      <Section title={`Personas (${visible.length})`}>
        {visible.length ? (
          visible.map((person) => {
            const expanded = open === person.email;
            return (
              <View key={person.email}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  onPress={() => toggle(person)}
                  style={({ hovered }: { hovered?: boolean }) => [
                    styles.row,
                    (hovered || expanded) && styles.rowActive,
                  ]}
                >
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle}>{personName(person)}</Text>
                    {personName(person) !== person.email ? (
                      <Text style={styles.muted}>{person.email}</Text>
                    ) : null}
                  </View>
                  <View style={styles.badges}>
                    {person.user_id ? <StatusBadge label="Administración" tone="success" /> : null}
                    {person.stores.length ? (
                      <StatusBadge
                        label={
                          person.stores.length === 1
                            ? `${person.stores[0].seller_name} · ${memberRoleLabel(person.stores[0])}`
                            : `${person.stores.length} tiendas`
                        }
                        tone="neutral"
                      />
                    ) : null}
                    {!person.user_id && !person.stores.length && person.customer_id ? (
                      <StatusBadge label="Cliente" tone="neutral" />
                    ) : null}
                    {!person.has_password ? (
                      <StatusBadge label="Sin activar" tone="warning" />
                    ) : null}
                  </View>
                  <Text style={styles.chevron}>{expanded ? "▴" : "▾"}</Text>
                </Pressable>
                {expanded ? renderActions(person) : null}
              </View>
            );
          })
        ) : (
          <Text style={[styles.muted, styles.block]}>No hay personas que coincidan.</Text>
        )}
      </Section>

      <Section title="Invitar administrador">
        <View style={styles.block}>
          <Text style={styles.muted}>
            Para alguien que aún no tiene cuenta. Recibe un enlace para crear su contraseña;
            mientras el correo no esté configurado, copia el enlace y envíaselo tú.
          </Text>
          <View style={styles.inline}>
            <TextInput
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="correo@ejemplo.com"
              placeholderTextColor={theme.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              accessibilityLabel="Correo de la persona a invitar"
              style={[styles.input, styles.flex]}
            />
            <Button title="Invitar" onPress={() => void invite()} loading={busy} />
          </View>
        </View>
      </Section>
      {invites.length ? (
        <Section title={`Invitaciones pendientes (${invites.length})`}>
          {invites.map((item) => (
            <View key={item.id} style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{item.email}</Text>
                <Text style={styles.muted}>
                  {item.expires_at ? `Caduca el ${shortDate(item.expires_at)}` : "Pendiente"}
                </Text>
              </View>
              <Pressable onPress={() => void copyInvite(item)} accessibilityRole="button">
                <Text style={styles.link}>Copiar enlace</Text>
              </Pressable>
              <Pressable
                onPress={() => void revoke(item)}
                disabled={busy}
                accessibilityRole="button"
              >
                <Text style={styles.danger}>Retirar</Text>
              </Pressable>
            </View>
          ))}
        </Section>
      ) : null}
    </OperationList>
  );
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    toolbar: { gap: 12, marginBottom: 6 },
    notice: { color: theme.successText, fontSize: 14, lineHeight: 20, marginBottom: 12 },
    block: { padding: 14, gap: 10 },
    inline: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
    flex: { flex: 1, minWidth: 160 },
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
    row: {
      minHeight: 60,
      paddingHorizontal: 14,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 12,
      borderBottomColor: theme.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    rowActive: { backgroundColor: theme.paper },
    badges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chevron: { color: theme.muted, fontSize: 14 },
    panel: {
      paddingHorizontal: 18,
      paddingVertical: 14,
      gap: 10,
      borderBottomColor: theme.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    panelTitle: {
      color: theme.text,
      fontSize: 13,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginTop: 6,
    },
    storeBlock: {
      gap: 8,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    rowTitle: { color: theme.text, fontSize: 15, fontWeight: "500" },
    muted: { color: theme.muted, fontSize: 13, lineHeight: 18 },
    warning: { color: theme.warning, fontSize: 13, lineHeight: 18 },
    link: { color: theme.action, fontSize: 14, fontWeight: "600" },
    danger: { color: theme.error, fontSize: 14, fontWeight: "600" },
  });

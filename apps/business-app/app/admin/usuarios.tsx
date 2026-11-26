import { ManagementPanel } from "../../components/management-list";
import { useNotice } from "../../hooks/use-notice";
import { Icon } from "@agestyles/icons";
import { Button, PillGroup, SearchField, StatusBadge } from "@agestyles/ui-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { OperationList, Section } from "../../components/operation-list";
import { useAdmin } from "../../context/admin-context";
import { useBusinessTheme } from "../../hooks/use-business-theme";
import { adminError, inviteLink, personName, shortDate, STORE_ROLES } from "../../lib/admin";
import { memberRoleLabel } from "../../lib/roles";
import { UserDirectoryTable, type UserSort } from "../../components/admin-user-directory";

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

const PAGE_SIZE = 20;
const byName = new Intl.Collator("es", { numeric: true, sensitivity: "base" });

function searchValue(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function accessLabel(person: Person) {
  return (
    [
      person.user_id && "Administración",
      person.stores.length > 0 && "Equipo de tienda",
      person.customer_id && "Cliente",
    ]
      .filter(Boolean)
      .join(" · ") || "Sin acceso asignado"
  );
}

function storeCount(person: Person) {
  return person.stores.length === 1 ? "1 tienda" : `${person.stores.length} tiendas`;
}

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
  const [width, setWidth] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState<"people" | "invites">("people");
  const [inviting, setInviting] = useState(false);
  const [sort, setSort] = useState<UserSort>({ key: "name", direction: "ascending" });
  const [page, setPage] = useState(0);
  const wide = Platform.OS === "web" && width >= 750;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useNotice();
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
    const terms = searchValue(query).trim().split(/\s+/).filter(Boolean);
    return people
      .filter((person) => {
        if (!test(person)) return false;
        const searchable = searchValue(
          [
            personName(person),
            person.email,
            accessLabel(person),
            ...person.stores.flatMap((store) => [store.seller_name, memberRoleLabel(store)]),
          ].join(" "),
        );
        return terms.every((term) => searchable.includes(term));
      })
      .sort((a, b) => {
        const nameOrder = byName.compare(personName(a), personName(b));
        const order =
          sort.key === "name"
            ? nameOrder
            : (Date.parse(a.created_at ?? "") || 0) - (Date.parse(b.created_at ?? "") || 0) ||
              nameOrder;
        return sort.direction === "ascending" ? order : -order;
      });
  }, [filter, people, query, sort]);
  const lastPage = Math.max(0, Math.ceil(visible.length / PAGE_SIZE) - 1);
  const currentPage = Math.min(page, lastPage);
  const start = currentPage * PAGE_SIZE;
  const pagePeople = visible.slice(start, start + PAGE_SIZE);
  const selected = people.find((person) => person.email === open);

  function changeSort(key: UserSort["key"]) {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "ascending" ? "descending" : "ascending",
    }));
    setPage(0);
  }

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

  function showPerson(person: Person) {
    setError("");
    setOpen(person.email);
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
      subtitle="Gestiona las personas y sus permisos en el marketplace."
      loading={loading}
      error={selected || inviting ? "" : error}
      onRefresh={() => void load()}
    >
      <View style={styles.directory} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {notice && !selected && !inviting ? (
          <Text accessibilityRole="alert" style={styles.notice}>
            {notice}
          </Text>
        ) : null}
        <View style={styles.toolbar}>
          <PillGroup
            accessibilityLabel="Vista de usuarios"
            value={view}
            onChange={(value) => setView(value === "invites" ? "invites" : "people")}
            options={[
              { value: "people", label: `Personas (${people.length})` },
              { value: "invites", label: `Invitaciones (${invites.length})` },
            ]}
          />
          <View style={styles.inline}>
            {view === "people" ? (
              <>
                <View style={styles.flex}>
                  <SearchField
                    value={query}
                    onChangeText={(value) => {
                      setQuery(value);
                      setPage(0);
                    }}
                    placeholder="Buscar nombre, correo, tienda o rol"
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showFilters }}
                  style={styles.filterButton}
                  onPress={() => setShowFilters((value) => !value)}
                >
                  <Text style={styles.rowTitle}>Filtrar</Text>
                  <Icon
                    name={showFilters ? "chevronUp" : "chevronDown"}
                    size={16}
                    color={theme.text}
                  />
                </Pressable>
              </>
            ) : null}
            <Button
              title="Invitar"
              onPress={() => {
                setError("");
                setNotice("");
                setInviting(true);
              }}
            />
          </View>

          {view === "people" && showFilters ? (
            <PillGroup
              accessibilityLabel="Tipo de usuario"
              value={filter}
              onChange={(value) => {
                setFilter(value as Filter);
                setPage(0);
              }}
              options={FILTERS.map((item) => ({
                value: item.value,
                label: `${item.label} (${counts[item.value] ?? 0})`,
              }))}
            />
          ) : null}
        </View>

        {view === "people" ? (
          <Section title={`Personas (${visible.length})`}>
            {!wide && visible.length ? (
              <View style={[styles.inline, styles.block]}>
                <Text style={styles.muted}>Ordenar por</Text>
                {(["name", "date"] as const).map((key) => (
                  <Pressable
                    key={key}
                    style={styles.filterButton}
                    accessibilityRole="button"
                    accessibilityState={{ selected: sort.key === key }}
                    onPress={() => changeSort(key)}
                  >
                    <Text style={styles.rowTitle}>
                      {key === "name" ? "Nombre" : "Fecha de alta"}
                    </Text>
                    {sort.key === key ? (
                      <Icon
                        name={sort.direction === "ascending" ? "chevronUp" : "chevronDown"}
                        size={16}
                        color={theme.text}
                      />
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : null}
            {wide && pagePeople.length ? (
              <UserDirectoryTable
                sort={sort}
                onSort={changeSort}
                users={pagePeople.map((person) => ({
                  name: personName(person),
                  email: person.email,
                  access: accessLabel(person),
                  stores: person.stores.length ? storeCount(person) : "—",
                  active: person.has_password,
                  date: person.created_at ? shortDate(person.created_at) : null,
                  edit: () => showPerson(person),
                }))}
              />
            ) : (
              pagePeople.map((person) => (
                <Pressable
                  key={person.email}
                  accessibilityRole="button"
                  accessibilityLabel={`Ver permisos de ${personName(person)}`}
                  onPress={() => showPerson(person)}
                  style={({ hovered, pressed }) => [
                    styles.personRow,
                    (hovered || pressed) && styles.rowActive,
                  ]}
                >
                  <View style={styles.personMain}>
                    <View style={styles.personIdentity}>
                      <Text style={styles.rowTitle}>{personName(person)}</Text>
                      {personName(person) !== person.email ? (
                        <Text style={styles.muted}>{person.email}</Text>
                      ) : null}
                    </View>
                    <Icon name="chevronRight" size={18} color={theme.muted} />
                  </View>
                  <View style={styles.badges}>
                    <Text style={styles.muted}>
                      {accessLabel(person)}
                      {person.stores.length ? ` · ${storeCount(person)}` : ""}
                    </Text>
                    <StatusBadge
                      label={person.has_password ? "Activo" : "Sin activar"}
                      tone={person.has_password ? "success" : "warning"}
                    />
                  </View>
                </Pressable>
              ))
            )}
            {!visible.length ? (
              <Text style={[styles.muted, styles.block]}>No hay personas que coincidan.</Text>
            ) : null}
            {visible.length > PAGE_SIZE ? (
              <View style={styles.pagination}>
                <Text accessibilityLiveRegion="polite" style={styles.muted}>
                  {start + 1}–{start + pagePeople.length} de {visible.length}
                </Text>
                <View style={styles.inline}>
                  <Button
                    title="Anterior"
                    variant="secondary"
                    disabled={!currentPage}
                    onPress={() => setPage(currentPage - 1)}
                  />
                  <Button
                    title="Siguiente"
                    variant="secondary"
                    disabled={currentPage === lastPage}
                    onPress={() => setPage(currentPage + 1)}
                  />
                </View>
              </View>
            ) : null}
          </Section>
        ) : (
          <Section title="Invitaciones pendientes">
            {invites.length ? (
              invites.map((item) => (
                <View key={item.id} style={styles.row}>
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle}>{item.email}</Text>
                    <Text style={styles.muted}>
                      {item.expires_at ? `Caduca el ${shortDate(item.expires_at)}` : "Pendiente"}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => void copyInvite(item)}
                    accessibilityRole="button"
                    style={styles.inviteAction}
                  >
                    <Text style={styles.link}>Copiar enlace</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void revoke(item)}
                    disabled={busy}
                    accessibilityRole="button"
                    style={styles.inviteAction}
                  >
                    <Text style={styles.danger}>Retirar</Text>
                  </Pressable>
                </View>
              ))
            ) : (
              <Text style={[styles.muted, styles.block]}>No hay invitaciones pendientes.</Text>
            )}
          </Section>
        )}
      </View>
      {selected ? (
        <ManagementPanel title={personName(selected)} wide={wide} onClose={() => setOpen(null)}>
          <View style={styles.block}>
            <Text style={styles.muted}>{selected.email}</Text>
            {notice ? (
              <Text accessibilityRole="alert" style={styles.notice}>
                {notice}
              </Text>
            ) : null}
            {error ? (
              <Text accessibilityRole="alert" style={styles.danger}>
                {error}
              </Text>
            ) : null}
          </View>
          {renderActions(selected)}
        </ManagementPanel>
      ) : null}
      {inviting ? (
        <ManagementPanel
          title="Invitar a Administración"
          wide={wide}
          onClose={() => setInviting(false)}
        >
          <View style={styles.block}>
            <Text style={styles.muted}>
              Crea un enlace de invitación para que la persona pueda establecer su contraseña.
            </Text>
            <Text style={styles.rowTitle}>Correo electrónico</Text>
            <TextInput
              value={inviteEmail}
              onChangeText={setInviteEmail}
              onSubmitEditing={() => {
                if (!busy) void invite();
              }}
              placeholder="correo@ejemplo.com"
              placeholderTextColor={theme.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              accessibilityLabel="Correo de la persona a invitar"
              style={styles.input}
            />
            {error ? (
              <Text accessibilityRole="alert" style={styles.danger}>
                {error}
              </Text>
            ) : null}
            {notice ? (
              <Text accessibilityRole="alert" style={styles.notice}>
                {notice}
              </Text>
            ) : null}
            <Button title="Crear invitación" onPress={() => void invite()} loading={busy} />
          </View>
        </ManagementPanel>
      ) : null}
    </OperationList>
  );
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    directory: { minWidth: 0 },
    toolbar: { gap: 12, marginBottom: 8 },
    filterButton: {
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      flexDirection: "row",
      gap: 8,
      backgroundColor: theme.surface,
    },
    pagination: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      padding: 12,
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    inviteAction: { minHeight: 44, justifyContent: "center" },
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
    badges: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
    personRow: {
      minHeight: 60,
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 8,
      borderBottomColor: theme.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    personMain: { flexDirection: "row", alignItems: "center", gap: 12 },
    personIdentity: { flex: 1, minWidth: 0, gap: 3 },
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

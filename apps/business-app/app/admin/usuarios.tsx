import { Button, PillGroup, SearchField, StatusBadge } from "@agestyles/ui-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { OperationList, Row, Section } from "../../components/operation-list";
import { useAdmin } from "../../context/admin-context";
import { useBusinessTheme } from "../../hooks/use-business-theme";
import { adminError, inviteLink, personName, shortDate } from "../../lib/admin";

type Person = {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  created_at?: string;
};
type Invite = { id: string; email: string; accepted: boolean; token: string; expires_at?: string };
type Member = { id: string; email?: string | null; is_active?: boolean; created_at?: string };
type Tab = "admins" | "customers" | "members";

const TABS: { value: Tab; label: string }[] = [
  { value: "admins", label: "Administradores" },
  { value: "customers", label: "Clientes" },
  { value: "members", label: "Miembros de tiendas" },
];

/** Everyone in the marketplace: administrators (and invitations), customers and store members. */
export default function AdminUsersScreen() {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const { adminRequest, admin } = useAdmin();
  const [tab, setTab] = useState<Tab>("admins");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [admins, setAdmins] = useState<Person[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [customers, setCustomers] = useState<Person[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [users, invitations, customerData, memberData] = await Promise.all([
        adminRequest<{ users: Person[] }>("/admin/users?limit=100"),
        adminRequest<{ invites: Invite[] }>("/admin/invites?limit=100"),
        adminRequest<{ customers: Person[] }>(
          "/admin/customers?limit=200&order=-created_at&fields=id,email,first_name,last_name,created_at",
        ),
        adminRequest<{ members: Member[] }>("/admin/members?limit=200"),
      ]);
      setAdmins(users.users ?? []);
      setInvites((invitations.invites ?? []).filter((invite) => !invite.accepted));
      setCustomers(customerData.customers ?? []);
      setMembers(memberData.members ?? []);
    } catch (cause) {
      setError(adminError(cause, "No se pudieron cargar los usuarios."));
    } finally {
      setLoading(false);
    }
  }, [adminRequest]);

  useEffect(() => {
    void load();
  }, [load]);

  const matches = useCallback(
    (person: { email?: string | null; first_name?: string | null; last_name?: string | null }) => {
      const text = `${person.email ?? ""} ${person.first_name ?? ""} ${person.last_name ?? ""}`;
      return !query.trim() || text.toLowerCase().includes(query.trim().toLowerCase());
    },
    [query],
  );
  const visible = useMemo(
    () => ({
      admins: admins.filter(matches),
      customers: customers.filter(matches),
      members: members.filter(matches),
    }),
    [admins, customers, matches, members],
  );

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

  async function invite() {
    const email = inviteEmail.trim().toLowerCase();
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

  async function revoke(invite: Invite) {
    setBusy(true);
    try {
      await adminRequest(`/admin/invites/${invite.id}`, "DELETE");
      setNotice(`Invitación para ${invite.email} retirada.`);
      await load();
    } catch (cause) {
      setError(adminError(cause, "No se pudo retirar la invitación."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <OperationList
      title="Usuarios"
      subtitle="Administradores, clientes y miembros de todas las tiendas del marketplace."
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
          value={tab}
          onChange={(value) => setTab(value as Tab)}
          options={TABS.map((item) => ({
            ...item,
            label: `${item.label} (${visible[item.value].length})`,
          }))}
        />
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por nombre o correo"
        />
      </View>

      {tab === "admins" ? (
        <>
          <Section title="Invitar administrador">
            <View style={styles.block}>
              <Text style={styles.muted}>
                La persona recibe un enlace para crear su contraseña. Mientras el correo no esté
                configurado, copia el enlace y envíaselo tú.
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
          <Section title="Administradores">
            {visible.admins.map((person) => (
              <View key={person.id} style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{personName(person)}</Text>
                  {personName(person) !== person.email ? (
                    <Text style={styles.muted}>{person.email}</Text>
                  ) : null}
                </View>
                {person.id === admin?.id ? <StatusBadge label="Tú" tone="success" /> : null}
              </View>
            ))}
          </Section>
        </>
      ) : null}

      {tab === "customers" ? (
        <Section title="Clientes">
          {visible.customers.length ? (
            visible.customers.map((person) => (
              <Row
                key={person.id}
                title={personName(person)}
                detail={`${person.email ?? ""}${person.created_at ? ` · desde ${shortDate(person.created_at)}` : ""}`}
              />
            ))
          ) : (
            <Text style={[styles.muted, styles.block]}>No hay clientes que coincidan.</Text>
          )}
        </Section>
      ) : null}

      {tab === "members" ? (
        <Section title="Miembros de tiendas">
          {visible.members.length ? (
            visible.members.map((person) => (
              <View key={person.id} style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{person.email ?? "Sin correo"}</Text>
                  <Text style={styles.muted}>
                    {person.created_at ? `Desde ${shortDate(person.created_at)}` : ""}
                  </Text>
                </View>
                <StatusBadge
                  label={person.is_active === false ? "Inactivo" : "Activo"}
                  tone={person.is_active === false ? "neutral" : "success"}
                />
              </View>
            ))
          ) : (
            <Text style={[styles.muted, styles.block]}>No hay miembros que coincidan.</Text>
          )}
          <Text style={[styles.muted, styles.block]}>
            Los roles de cada persona se gestionan dentro de su tienda, en Tiendas.
          </Text>
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
    inline: { flexDirection: "row", alignItems: "center", gap: 10 },
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
    row: {
      minHeight: 60,
      paddingHorizontal: 14,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      borderBottomColor: theme.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    rowTitle: { color: theme.text, fontSize: 15, fontWeight: "500" },
    muted: { color: theme.muted, fontSize: 13, lineHeight: 18 },
    link: { color: theme.action, fontSize: 14, fontWeight: "600" },
    danger: { color: theme.error, fontSize: 14, fontWeight: "600" },
  });

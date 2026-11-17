import { useCallback, useEffect, useMemo, useState } from "react"
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { Icon } from "@agestyles/icons"
import { OperationList, palette, Section } from "../../components/operation-list"
import { useBusiness } from "../../context/business-context"

type SellerMember = {
  id: string
  is_owner?: boolean
  role_id: string
  member?: {
    id?: string
    email?: string
    first_name?: string | null
    last_name?: string | null
  }
}

type SellerMembersResponse = { seller_members: SellerMember[] }

const roles = [
  { id: "role_seller_inventory_management", label: "Gestor de inventario" },
  { id: "role_seller_order_management", label: "Gestor de pedidos" },
  { id: "role_seller_accounting", label: "Contabilidad" },
  { id: "role_seller_support", label: "Solo lectura" },
]

function roleName(roleId: string) {
  if (roleId === "role_seller_administration") return "Administración"
  return roles.find(({ id }) => id === roleId)?.label ?? "Miembro"
}

function memberName(member: SellerMember) {
  const fullName = [member.member?.first_name, member.member?.last_name].filter(Boolean).join(" ")
  return fullName || member.member?.email || "Miembro de tienda"
}

export default function TeamScreen() {
  const { seller, member, request } = useBusiness()
  const [members, setMembers] = useState<SellerMember[]>([])
  const [email, setEmail] = useState("")
  const [inviteRole, setInviteRole] = useState(roles[0].id)
  const [rolePicker, setRolePicker] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const canManageMembers = Boolean(member?.is_owner || member?.permissions?.members === "manage")
  const membersPath = useMemo(() => seller ? `/vendor/sellers/${seller.id}/members` : null, [seller])

  const loadMembers = useCallback(async () => {
    if (!membersPath || !canManageMembers) {
      setMembers([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError("")
    try {
      const result = await request<SellerMembersResponse>(
        `${membersPath}?limit=50&fields=id,is_owner,role_id,member.id,member.email,member.first_name,member.last_name`,
      )
      setMembers(result.seller_members ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el equipo de la tienda.")
    } finally {
      setLoading(false)
    }
  }, [canManageMembers, membersPath, request])

  useEffect(() => { void loadMembers() }, [loadMembers])

  async function inviteMember() {
    const normalizedEmail = email.trim().toLowerCase()
    if (!membersPath || !normalizedEmail || !normalizedEmail.includes("@")) {
      setError("Escribe un correo electrónico válido.")
      return
    }
    setSaving(true)
    setError("")
    setNotice("")
    try {
      await request(membersPath, "POST", { email: normalizedEmail, role_id: inviteRole })
      setEmail("")
      setNotice("La invitación se creó correctamente.")
      await loadMembers()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo invitar a la persona.")
    } finally {
      setSaving(false)
    }
  }

  async function changeRole(target: SellerMember, roleId: string) {
    if (!membersPath || target.is_owner) return
    setSaving(true)
    setError("")
    setNotice("")
    try {
      await request(`${membersPath}/${target.id}`, "POST", { role_id: roleId })
      setRolePicker(null)
      setNotice(`Permisos actualizados para ${memberName(target)}.`)
      await loadMembers()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cambiar el rol.")
    } finally {
      setSaving(false)
    }
  }

  function revokeMember(target: SellerMember) {
    if (!membersPath || target.is_owner) return
    Alert.alert(
      "Revocar acceso",
      `Se quitará a ${memberName(target)} de ${seller?.name ?? "esta tienda"}.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Revocar",
          style: "destructive",
          onPress: () => {
            setSaving(true)
            setError("")
            setNotice("")
            void request(`${membersPath}/${target.id}`, "DELETE")
              .then(async () => {
                setNotice(`Se revocó el acceso de ${memberName(target)}.`)
                await loadMembers()
              })
              .catch((cause) => setError(cause instanceof Error ? cause.message : "No se pudo revocar el acceso."))
              .finally(() => setSaving(false))
          },
        },
      ],
    )
  }

  if (!canManageMembers) {
    return <OperationList title="Equipo" subtitle="Personas y permisos de esta tienda." loading={false} error="">
      <View style={styles.accessNotice}>
        <Icon name="shieldCheck" color={palette.navy} size={20} />
        <Text style={styles.accessText}>Solo el propietario puede administrar los miembros. La tienda aplica los permisos en el servidor.</Text>
      </View>
    </OperationList>
  }

  return <OperationList
    title="Equipo"
    subtitle={`${seller?.name ?? "Tienda"} · administra quién puede acceder y qué tareas puede realizar.`}
    loading={loading}
    error={error}
    onRefresh={() => void loadMembers()}
  >
    {notice ? <View style={styles.notice}><Icon name="check" color={palette.navy} size={18} /><Text style={styles.noticeText}>{notice}</Text></View> : null}
    <Section title="Invitar a la tienda">
      <View style={styles.form}>
        <Text style={styles.label}>Correo electrónico</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="persona@ejemplo.com"
          placeholderTextColor={palette.muted}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          accessibilityLabel="Correo electrónico de la persona invitada"
          style={styles.input}
        />
        <Text style={styles.label}>Permisos iniciales</Text>
        <View style={styles.roleChoices}>
          {roles.map((role) => <RoleChoice key={role.id} role={role} selected={inviteRole === role.id} onPress={() => setInviteRole(role.id)} />)}
        </View>
        <Pressable onPress={() => void inviteMember()} disabled={saving || loading} accessibilityRole="button" style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, (saving || loading) && styles.disabled]}>
          <Text style={styles.primaryText}>{saving ? "Guardando…" : "Crear invitación"}</Text>
        </Pressable>
      </View>
    </Section>

    <Section title={`Miembros (${members.length})`}>
      {members.length === 0 && !loading ? <Text style={styles.empty}>Todavía no hay miembros en esta tienda.</Text> : null}
      {members.map((person) => <View key={person.id} style={styles.memberCard}>
        <View style={styles.memberHeading}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{memberName(person).slice(0, 1).toUpperCase()}</Text></View>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{memberName(person)}</Text>
            {person.member?.email ? <Text style={styles.memberEmail}>{person.member.email}</Text> : null}
          </View>
          <Text style={styles.roleBadge}>{person.is_owner ? "Propietario" : roleName(person.role_id)}</Text>
        </View>
        {!person.is_owner ? <View style={styles.memberActions}>
          <Pressable onPress={() => setRolePicker(rolePicker === person.id ? null : person.id)} disabled={saving} accessibilityRole="button" style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>{rolePicker === person.id ? "Cerrar" : "Cambiar permisos"}</Text>
          </Pressable>
          <Pressable onPress={() => revokeMember(person)} disabled={saving} accessibilityRole="button" style={styles.revokeButton}>
            <Text style={styles.revokeText}>Revocar acceso</Text>
          </Pressable>
        </View> : <Text style={styles.ownerNote}>El propietario mantiene el control de esta tienda.</Text>}
        {rolePicker === person.id ? <View style={styles.roleChoices}>
          {roles.map((role) => <RoleChoice key={role.id} role={role} selected={person.role_id === role.id} onPress={() => void changeRole(person, role.id)} />)}
        </View> : null}
      </View>)}
    </Section>
    <View style={styles.accessNotice}>
      <Icon name="shieldCheck" color={palette.navy} size={18} />
      <Text style={styles.accessText}>Los permisos se vuelven a validar en el servidor en cada operación.</Text>
    </View>
  </OperationList>
}

function RoleChoice({ role, selected, onPress }: { role: (typeof roles)[number]; selected: boolean; onPress: () => void }) {
  return <Pressable
    onPress={onPress}
    accessibilityRole="radio"
    accessibilityState={{ checked: selected }}
    style={({ pressed }) => [styles.roleChoice, selected && styles.roleChoiceSelected, pressed && styles.pressed]}
  >
    <Text style={[styles.roleChoiceText, selected && styles.roleChoiceTextSelected]}>{role.label}</Text>
    {selected ? <Icon name="check" size={15} color={palette.navy} /> : null}
  </Pressable>
}

const styles = StyleSheet.create({
  form: { padding: 16 },
  label: { color: palette.ink, fontSize: 13, fontWeight: "600", marginBottom: 8, marginTop: 6 },
  input: { backgroundColor: palette.white, borderWidth: 1, borderColor: palette.line, borderRadius: 11, minHeight: 48, paddingHorizontal: 13, color: palette.ink, fontSize: 15, marginBottom: 13 },
  roleChoices: { gap: 8, marginVertical: 5 },
  roleChoice: { minHeight: 43, borderColor: palette.line, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: palette.white },
  roleChoiceSelected: { backgroundColor: "#EEF0F3", borderColor: palette.navy },
  roleChoiceText: { color: palette.ink, fontSize: 13 },
  roleChoiceTextSelected: { color: palette.navy, fontWeight: "600" },
  primaryButton: { backgroundColor: palette.navy, minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 12 },
  primaryText: { color: palette.white, fontWeight: "600", fontSize: 14 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
  memberCard: { padding: 15, borderBottomColor: palette.line, borderBottomWidth: StyleSheet.hairlineWidth },
  memberHeading: { flexDirection: "row", alignItems: "center", gap: 11 },
  avatar: { width: 39, height: 39, borderRadius: 20, backgroundColor: "#EEF0F3", alignItems: "center", justifyContent: "center" },
  avatarText: { color: palette.navy, fontSize: 15, fontWeight: "700" },
  memberInfo: { flex: 1 },
  memberName: { color: palette.ink, fontSize: 14, fontWeight: "600" },
  memberEmail: { color: palette.muted, fontSize: 12, marginTop: 3 },
  roleBadge: { color: palette.navy, backgroundColor: "#EEF0F3", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20, fontSize: 11, fontWeight: "600", overflow: "hidden" },
  memberActions: { flexDirection: "row", gap: 9, marginTop: 13 },
  secondaryButton: { minHeight: 40, paddingHorizontal: 12, justifyContent: "center", borderColor: palette.line, borderWidth: 1, borderRadius: 10 },
  secondaryText: { color: palette.navy, fontSize: 12, fontWeight: "600" },
  revokeButton: { minHeight: 40, paddingHorizontal: 12, justifyContent: "center" },
  revokeText: { color: palette.red, fontSize: 12, fontWeight: "600" },
  ownerNote: { color: palette.muted, fontSize: 12, marginTop: 11 },
  empty: { padding: 15, color: palette.muted, fontSize: 14 },
  notice: { backgroundColor: "#EEF0F3", borderRadius: 12, flexDirection: "row", gap: 9, alignItems: "center", padding: 13, marginBottom: 2 },
  noticeText: { color: palette.navy, flex: 1, fontSize: 13, lineHeight: 18 },
  accessNotice: { flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: "#EEF0F3", borderRadius: 13, padding: 14, marginTop: 18 },
  accessText: { color: palette.navy, flex: 1, fontSize: 13, lineHeight: 19 },
})

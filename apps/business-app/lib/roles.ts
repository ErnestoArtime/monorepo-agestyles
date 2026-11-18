/** Spanish name of a store member's role, the same everywhere in Negocio. */
export function memberRoleLabel(
  member: { is_owner?: boolean; role_id?: string | null } | null | undefined,
): string {
  if (member?.is_owner) return "Propietario";
  const roleId = member?.role_id?.toLowerCase() ?? "";
  if (roleId.includes("administration")) return "Administración";
  if (roleId.includes("inventory")) return "Gestor de inventario";
  if (roleId.includes("order")) return "Gestor de pedidos";
  if (roleId.includes("accounting")) return "Contabilidad";
  if (roleId.includes("support")) return "Solo lectura";
  return "Miembro";
}

/** Name to show for the signed-in member: full name, else email. */
export function memberDisplayName(
  member:
    | {
        member?: {
          email?: string | null;
          first_name?: string | null;
          last_name?: string | null;
        } | null;
      }
    | null
    | undefined,
): string {
  const person = member?.member;
  const fullName = [person?.first_name, person?.last_name].filter(Boolean).join(" ");
  return fullName || person?.email || "Tu cuenta";
}

/**
 * AG-45: everyone in the marketplace as one list of people, merged by email, for the
 * superadmin's «Usuarios» screen. Pure functions (tested) plus the input checks of its actions.
 */

export const STORE_ROLE_IDS = [
  "role_seller_administration",
  "role_seller_inventory_management",
  "role_seller_order_management",
  "role_seller_accounting",
  "role_seller_support",
] as const;

export type PersonStore = {
  seller_member_id: string;
  seller_id: string;
  seller_name: string;
  member_id: string;
  role_id: string | null;
  is_owner: boolean;
};

export type Person = {
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

type Named = { email?: string | null; first_name?: string | null; last_name?: string | null };
export type CustomerRow = Named & {
  id: string;
  created_at?: string | Date | null;
  metadata?: Record<string, unknown> | null;
};
export type UserRow = Named & { id: string; created_at?: string | Date | null };
export type SellerMemberRow = {
  id: string;
  is_owner?: boolean | null;
  role_id?: string | null;
  seller?: { id: string; name?: string | null } | null;
  member?: (Named & { id: string }) | null;
};

const normal = (email?: string | null) => (email ?? "").trim().toLowerCase();
const iso = (value?: string | Date | null) =>
  value ? (value instanceof Date ? value.toISOString() : String(value)) : null;

export function mergePeople(input: {
  customers: CustomerRow[];
  users: UserRow[];
  sellerMembers: SellerMemberRow[];
  passwordEmails: Iterable<string>;
}): Person[] {
  const passwords = new Set([...input.passwordEmails].map(normal));
  const people = new Map<string, Person>();
  const person = (row: Named, createdAt?: string | Date | null) => {
    const email = normal(row.email);
    if (!email) return null;
    let entry = people.get(email);
    if (!entry) {
      entry = {
        email,
        first_name: null,
        last_name: null,
        customer_id: null,
        user_id: null,
        has_password: passwords.has(email),
        legacy_role: null,
        created_at: null,
        stores: [],
      };
      people.set(email, entry);
    }
    entry.first_name ||= row.first_name?.trim() || null;
    entry.last_name ||= row.last_name?.trim() || null;
    const at = iso(createdAt);
    if (at && (!entry.created_at || at < entry.created_at)) entry.created_at = at;
    return entry;
  };

  for (const user of input.users) {
    const entry = person(user, user.created_at);
    if (entry) entry.user_id = user.id;
  }
  for (const customer of input.customers) {
    const entry = person(customer, customer.created_at);
    if (!entry) continue;
    entry.customer_id = customer.id;
    const role = customer.metadata?.legacy_role;
    if (typeof role === "string") entry.legacy_role = role;
  }
  for (const row of input.sellerMembers) {
    if (!row.member || !row.seller) continue;
    const entry = person(row.member);
    if (!entry) continue;
    entry.stores.push({
      seller_member_id: row.id,
      seller_id: row.seller.id,
      seller_name: row.seller.name ?? "Tienda",
      member_id: row.member.id,
      role_id: row.role_id ?? null,
      is_owner: Boolean(row.is_owner),
    });
  }
  for (const entry of people.values())
    entry.stores.sort((a, b) => a.seller_name.localeCompare(b.seller_name, "es"));

  return [...people.values()].sort(
    (a, b) =>
      Number(Boolean(b.user_id)) - Number(Boolean(a.user_id)) ||
      b.stores.length - a.stores.length ||
      (b.created_at ?? "").localeCompare(a.created_at ?? ""),
  );
}

export type PeopleAction =
  | { action: "grant_admin"; email: string }
  | { action: "revoke_admin"; email: string }
  | { action: "add_to_store"; email: string; seller_id: string; role_id: string }
  | { action: "change_role"; email: string; seller_member_id: string; role_id: string }
  | { action: "remove_from_store"; email: string; seller_member_id: string };

export class PeopleError extends Error {}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Validates an action's body; throws PeopleError with a Spanish message. */
export function parsePeopleAction(body: unknown): PeopleAction {
  const input = (body ?? {}) as Record<string, unknown>;
  const email = normal(text(input.email));
  if (!email.includes("@")) throw new PeopleError("Falta el correo de la persona.");
  const role = text(input.role_id);
  const checkRole = () => {
    if (!(STORE_ROLE_IDS as readonly string[]).includes(role))
      throw new PeopleError("Elige un rol de tienda válido.");
  };
  switch (input.action) {
    case "grant_admin":
    case "revoke_admin":
      return { action: input.action, email };
    case "add_to_store": {
      const seller = text(input.seller_id);
      if (!seller.startsWith("sel_")) throw new PeopleError("Elige una tienda.");
      checkRole();
      return { action: "add_to_store", email, seller_id: seller, role_id: role };
    }
    case "change_role":
    case "remove_from_store": {
      const membership = text(input.seller_member_id);
      if (!membership) throw new PeopleError("Falta la tienda de la persona.");
      if (input.action === "remove_from_store")
        return { action: "remove_from_store", email, seller_member_id: membership };
      checkRole();
      return { action: "change_role", email, seller_member_id: membership, role_id: role };
    }
    default:
      throw new PeopleError("Acción no reconocida.");
  }
}

import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

/**
 * Accounts migrated from the old catalog (AG-32, phase C). Supabase does not hand out
 * password hashes (and they are bcrypt, Medusa's emailpass uses scrypt), so the account is
 * imported without a password and, on its first sign-in, the password is checked against
 * the old catalog's Supabase Auth and saved in Medusa. No email is needed.
 */
type Scope = Pick<MedusaContainer, "resolve">;

export function legacyAuthConfig() {
  const url = process.env.AGESTYLES_LEGACY_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const key = process.env.AGESTYLES_LEGACY_SUPABASE_ANON_KEY?.trim();
  return url?.startsWith("https://") && key ? { url, key } : null;
}

/** True only when the old catalog accepts this email and password. */
export async function verifyLegacyPassword(email: string, password: string): Promise<boolean> {
  const config = legacyAuthConfig();
  if (!config) return false;
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: config.key, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  return Boolean(response?.ok);
}

export type LegacyCustomer = {
  id: string;
  email: string;
  has_account: boolean;
  metadata: Record<string, unknown> | null;
};

/** The imported customer for this email, if the account came from the old catalog. */
export async function legacyCustomer(scope: Scope, email: string): Promise<LegacyCustomer | null> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY) as unknown as {
    graph(input: {
      entity: string;
      fields: string[];
      filters: Record<string, unknown>;
    }): Promise<{ data: LegacyCustomer[] }>;
  };
  const { data } = await query.graph({
    entity: "customer",
    fields: ["id", "email", "has_account", "metadata"],
    filters: { email },
  });
  return data.find((customer) => customer.metadata?.legacy_user_id) ?? null;
}

/** Whether Medusa already has an email/password identity for this email. */
export async function hasEmailIdentity(scope: Scope, email: string): Promise<boolean> {
  const auth = scope.resolve(Modules.AUTH) as unknown as {
    listProviderIdentities(filters: Record<string, unknown>): Promise<unknown[]>;
  };
  const found = await auth.listProviderIdentities({ provider: "emailpass", entity_id: email });
  return found.length > 0;
}

// Attempts per email and per client, so the route cannot be used to guess passwords.
const attempts = new Map<string, { count: number; until: number }>();
export function allowAttempt(key: string, max = 5, windowMs = 15 * 60_000): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.until < now) {
    attempts.set(key, { count: 1, until: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= max;
}

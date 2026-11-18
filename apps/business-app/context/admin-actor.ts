import AsyncStorage from "@react-native-async-storage/async-storage";
import Medusa from "@medusajs/js-sdk";

/**
 * Marketplace administration (AG-32): the `user` actor of Medusa, kept apart from the store
 * member and the customer (ADR-002). It talks to the admin gateway, which only forwards the
 * admin routes Negocio's screens use.
 */
const ADMIN_SESSION_PREFIX = "agestyles.business.admin.actor.";

const storage = {
  getItem: (key: string) => AsyncStorage.getItem(`${ADMIN_SESSION_PREFIX}${key}`),
  setItem: (key: string, value: string) =>
    AsyncStorage.setItem(`${ADMIN_SESSION_PREFIX}${key}`, value),
  removeItem: (key: string) => AsyncStorage.removeItem(`${ADMIN_SESSION_PREFIX}${key}`),
};

function adminBaseUrl() {
  if (process.env.EXPO_PUBLIC_ADMIN_MEDUSA_URL) return process.env.EXPO_PUBLIC_ADMIN_MEDUSA_URL;
  const api = process.env.EXPO_PUBLIC_MEDUSA_URL || "http://127.0.0.1:19081";
  try {
    return `${new URL(api).origin}/admin-app`;
  } catch {
    return api;
  }
}

export const adminSdk: any = new Medusa({
  baseUrl: adminBaseUrl(),
  auth: { type: "jwt", jwtTokenStorageMethod: "custom", storage },
});

export type AdminUser = {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
};

/** Signs in as administrator; false when this person has no administrator account. */
export async function loginAdminActor(email: string, password: string): Promise<boolean> {
  try {
    const token = await adminSdk.auth.login("user", "emailpass", { email, password });
    return typeof token === "string";
  } catch {
    return false;
  }
}

export async function currentAdmin(): Promise<AdminUser | null> {
  try {
    const result = await adminSdk.client.fetch("/admin/users/me");
    return (result?.user ?? null) as AdminUser | null;
  } catch {
    return null;
  }
}

export async function logoutAdminActor() {
  try {
    await adminSdk.auth.logout();
  } catch {
    // Already signed out.
  }
}

/** Accepts an administrator invitation: creates the identity, accepts, then signs in. */
export async function acceptAdminInvite(input: {
  token: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}) {
  const registration = await adminSdk.auth.register("user", "emailpass", {
    email: input.email,
    password: input.password,
  });
  await adminSdk.client.fetch(`/admin/invites/accept?token=${encodeURIComponent(input.token)}`, {
    method: "POST",
    headers: { authorization: `Bearer ${registration}` },
    body: { first_name: input.firstName, last_name: input.lastName },
  });
  return loginAdminActor(input.email, input.password);
}

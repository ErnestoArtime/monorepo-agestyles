import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

/**
 * AG-32 phase C: imports the old catalog's accounts as Medusa customers WITHOUT passwords
 * (authorised by the user on 19 nov 2026). Only email, name and the old role are read;
 * address, phone and ID document are not. Passwords move on the first sign-in
 * (`/store/agestyles/legacy-login`). Old roles are only recorded in metadata
 * (`legacy_role`): administrators and sales agents are assigned by hand later.
 *
 *   LEGACY_SUPABASE_URL=… LEGACY_SUPABASE_SERVICE_KEY=… [LEGACY_DRY_RUN=1] \
 *     medusa exec ./src/scripts/legacy-users-import.ts
 *
 * Idempotent: an existing customer with the same email only gets the legacy metadata.
 * Prints counts, never personal data.
 */
type LegacyUser = { id: string; email: string | null };
type Profile = { id: string; email: string | null; full_name: string | null; role: string | null };
type Customer = { id: string; email: string; metadata: Record<string, unknown> | null };

export default async function legacyUsersImport({ container }: ExecArgs) {
  const url = process.env.LEGACY_SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.LEGACY_SUPABASE_SERVICE_KEY;
  const dryRun = process.env.LEGACY_DRY_RUN === "1";
  if (!url || !key)
    throw new Error("LEGACY_SUPABASE_URL and LEGACY_SUPABASE_SERVICE_KEY are required.");
  const headers = { apikey: key, authorization: `Bearer ${key}` };

  const users: LegacyUser[] = [];
  for (let page = 1; page < 50; page++) {
    const response = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=100`, {
      headers,
    });
    if (!response.ok) throw new Error(`legacy auth ${response.status}`);
    const batch = ((await response.json()) as { users: LegacyUser[] }).users;
    users.push(...batch);
    if (batch.length < 100) break;
  }
  const profilesResponse = await fetch(`${url}/rest/v1/profiles?select=id,email,full_name,role`, {
    headers,
  });
  if (!profilesResponse.ok) throw new Error(`legacy profiles ${profilesResponse.status}`);
  const profiles = new Map(((await profilesResponse.json()) as Profile[]).map((p) => [p.id, p]));

  const query = container.resolve(ContainerRegistrationKeys.QUERY) as unknown as {
    graph(input: {
      entity: string;
      fields: string[];
      filters: Record<string, unknown>;
    }): Promise<{ data: Customer[] }>;
  };
  const customers = container.resolve(Modules.CUSTOMER) as unknown as {
    createCustomers(data: Record<string, unknown>): Promise<{ id: string }>;
    updateCustomers(id: string, data: Record<string, unknown>): Promise<unknown>;
  };

  const counts = {
    read: users.length,
    created: 0,
    updated: 0,
    skipped: 0,
    roles: {} as Record<string, number>,
  };
  for (const user of users) {
    const profile = profiles.get(user.id);
    const email = (user.email ?? profile?.email ?? "").trim().toLowerCase();
    if (!email.includes("@")) {
      counts.skipped += 1;
      continue;
    }
    const role = profile?.role ?? "user";
    counts.roles[role] = (counts.roles[role] ?? 0) + 1;
    const [first, ...rest] = (profile?.full_name ?? "").trim().split(/\s+/).filter(Boolean);
    const legacy = {
      legacy_user_id: user.id,
      legacy_role: role,
      legacy_imported_at: new Date().toISOString(),
    };
    const { data } = await query.graph({
      entity: "customer",
      fields: ["id", "email", "metadata"],
      filters: { email },
    });
    if (data[0]) {
      if (!dryRun)
        await customers.updateCustomers(data[0].id, {
          metadata: { ...(data[0].metadata ?? {}), ...legacy },
        });
      counts.updated += 1;
    } else {
      if (!dryRun)
        await customers.createCustomers({
          email,
          first_name: first ?? null,
          last_name: rest.join(" ") || null,
          has_account: false,
          metadata: legacy,
        });
      counts.created += 1;
    }
  }
  console.log(
    `${dryRun ? "[prueba] " : ""}cuentas leídas: ${counts.read}, clientes nuevos: ${counts.created}, ` +
      `ya existían (metadatos añadidos): ${counts.updated}, sin correo: ${counts.skipped}, ` +
      `roles antiguos: ${JSON.stringify(counts.roles)}`,
  );
}

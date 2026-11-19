import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

/**
 * AG-32: gives marketplace administration to an account migrated from the old catalog,
 * once its owner has signed in (so its email/password identity exists). Selects by
 * customer id (LEGACY_CUSTOMER_ID) or, with LEGACY_PROMOTE_LATEST=1, the most recently
 * migrated account whose old role was «admin». Prints ids only, never emails.
 *
 *   LEGACY_PROMOTE_LATEST=1 [LEGACY_DRY_RUN=1] medusa exec ./src/scripts/legacy-promote-admin.ts
 */
type Customer = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  metadata: Record<string, unknown> | null;
};

export default async function legacyPromoteAdmin({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as unknown as {
    graph(input: {
      entity: string;
      fields: string[];
      filters: Record<string, unknown>;
    }): Promise<{ data: Customer[] }>;
  };
  const dryRun = process.env.LEGACY_DRY_RUN === "1";
  const { data: migrated } = await query.graph({
    entity: "customer",
    fields: ["id", "email", "first_name", "last_name", "metadata"],
    filters: process.env.LEGACY_CUSTOMER_ID
      ? { id: process.env.LEGACY_CUSTOMER_ID }
      : { has_account: true },
  });
  const candidates = migrated
    .filter((c) => c.metadata?.legacy_migrated_at && c.metadata?.legacy_role === "admin")
    .sort((a, b) =>
      String(b.metadata?.legacy_migrated_at).localeCompare(String(a.metadata?.legacy_migrated_at)),
    );
  const customer = process.env.LEGACY_CUSTOMER_ID ? migrated[0] : candidates[0];
  if (!customer) {
    console.log(
      "No hay ninguna cuenta antigua de administrador migrada todavía (debe entrar una vez en la Tienda).",
    );
    return;
  }
  const auth = container.resolve(Modules.AUTH) as unknown as {
    listProviderIdentities(f: Record<string, unknown>): Promise<{ auth_identity_id: string }[]>;
    retrieveAuthIdentity(
      id: string,
    ): Promise<{ id: string; app_metadata: Record<string, unknown> | null }>;
    updateAuthIdentities(d: {
      id: string;
      app_metadata: Record<string, unknown>;
    }): Promise<unknown>;
  };
  const users = container.resolve(Modules.USER) as unknown as {
    listUsers(f: Record<string, unknown>): Promise<{ id: string }[]>;
    createUsers(d: Record<string, unknown>): Promise<{ id: string }>;
  };
  const [provider] = await auth.listProviderIdentities({
    provider: "emailpass",
    entity_id: customer.email,
  });
  if (!provider) {
    console.log(
      `La cuenta ${customer.id} aún no tiene contraseña en Medusa: debe entrar una vez en la Tienda.`,
    );
    return;
  }
  const identity = await auth.retrieveAuthIdentity(provider.auth_identity_id);
  if (identity.app_metadata?.user_id) {
    console.log(
      `La cuenta ${customer.id} ya es administradora (${identity.app_metadata.user_id}).`,
    );
    return;
  }
  if (dryRun) {
    console.log(
      `[prueba] se daría administración a la cuenta ${customer.id} (identidad ${identity.id}).`,
    );
    return;
  }
  const [existing] = await users.listUsers({ email: customer.email });
  const user =
    existing ??
    (await users.createUsers({
      email: customer.email,
      first_name: customer.first_name,
      last_name: customer.last_name,
    }));
  await auth.updateAuthIdentities({
    id: identity.id,
    app_metadata: { ...(identity.app_metadata ?? {}), user_id: user.id },
  });
  console.log(`Administración dada: cuenta ${customer.id} → usuario ${user.id}.`);
}

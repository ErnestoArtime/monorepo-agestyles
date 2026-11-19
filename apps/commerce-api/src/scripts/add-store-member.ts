import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { acceptMemberInviteWorkflow, createMemberInvitesWorkflow } from "@mercurjs/core/workflows";
import { SellerRole } from "@mercurjs/types";

/**
 * Adds an existing sign-in identity (for example an account migrated from the old catalog)
 * to a store's team through Mercur's supported invite workflows, without creating a new
 * password. Prints ids only, never emails.
 *
 *   AUTH_IDENTITY_ID=authid_… SELLER_HANDLE=agestyles [MEMBER_ROLE=role_seller_administration] \
 *     [DRY_RUN=1] medusa exec ./src/scripts/add-store-member.ts
 */
export default async function addStoreMember({ container }: ExecArgs) {
  const identityId = process.env.AUTH_IDENTITY_ID;
  const handle = process.env.SELLER_HANDLE;
  const roleId = process.env.MEMBER_ROLE || SellerRole.SELLER_ADMINISTRATION;
  const dryRun = process.env.DRY_RUN === "1";
  if (!identityId || !handle) throw new Error("AUTH_IDENTITY_ID and SELLER_HANDLE are required.");

  const query = container.resolve(ContainerRegistrationKeys.QUERY) as unknown as {
    graph(input: {
      entity: string;
      fields: string[];
      filters: Record<string, unknown>;
    }): Promise<{ data: Record<string, any>[] }>;
  };
  const auth = container.resolve(Modules.AUTH) as unknown as {
    retrieveAuthIdentity(
      id: string,
      config?: Record<string, unknown>,
    ): Promise<{
      id: string;
      app_metadata: Record<string, unknown> | null;
      provider_identities?: { provider: string; entity_id: string }[];
    }>;
  };

  const identity = await auth.retrieveAuthIdentity(identityId, {
    relations: ["provider_identities"],
  });
  const email = identity.provider_identities?.find((p) => p.provider === "emailpass")?.entity_id;
  if (!email) throw new Error(`La identidad ${identityId} no tiene correo y contraseña.`);

  const { data: sellers } = await query.graph({
    entity: "seller",
    fields: ["id", "members.id", "members.email"],
    filters: { handle },
  });
  const seller = sellers[0];
  if (!seller) throw new Error(`No existe la tienda ${handle}.`);

  if (identity.app_metadata?.member_id) {
    const memberId = identity.app_metadata.member_id as string;
    const inStore = (seller.members ?? []).some((m: { id: string }) => m?.id === memberId);
    console.log(
      inStore
        ? `La identidad ${identityId} ya es del equipo de ${seller.id} (miembro ${memberId}).`
        : `La identidad ${identityId} ya es el miembro ${memberId} de otra tienda; añádelo desde Equipo.`,
    );
    return;
  }
  if (dryRun) {
    console.log(`[prueba] se añadiría ${identityId} a ${seller.id} con el rol ${roleId}.`);
    return;
  }

  const { result: invites } = await createMemberInvitesWorkflow(container).run({
    input: [{ seller_id: seller.id, email, role_id: roleId }],
  });
  const { data: customers } = await query.graph({
    entity: "customer",
    fields: ["first_name", "last_name"],
    filters: { email },
  });
  await acceptMemberInviteWorkflow(container).run({
    input: {
      invite_token: (invites as { token?: string }[])[0].token as string,
      auth_identity_id: identityId,
      first_name: customers[0]?.first_name ?? undefined,
      last_name: customers[0]?.last_name ?? undefined,
    },
  });
  const updated = await auth.retrieveAuthIdentity(identityId);
  console.log(
    `Añadida ${identityId} al equipo de ${seller.id} (rol ${roleId}, miembro ${String(updated.app_metadata?.member_id)}).`,
  );
}

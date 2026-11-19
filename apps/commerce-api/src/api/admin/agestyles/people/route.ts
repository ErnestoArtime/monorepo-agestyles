import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { createUserAccountWorkflow, removeUserAccountWorkflow } from "@medusajs/medusa/core-flows";
import {
  acceptMemberInviteWorkflow,
  addSellerMemberWorkflow,
  createMemberInvitesWorkflow,
  removeSellerMemberWorkflow,
  updateMemberRoleWorkflow,
} from "@mercurjs/core/workflows";
import {
  mergePeople,
  parsePeopleAction,
  PeopleError,
  type CustomerRow,
  type SellerMemberRow,
  type UserRow,
} from "../../../../lib/people";

type Query = {
  graph(input: {
    entity: string;
    fields: string[];
    filters?: Record<string, unknown>;
    pagination?: { take?: number; skip?: number };
  }): Promise<{ data: Record<string, any>[] }>;
};
type Auth = {
  listProviderIdentities(
    filters: Record<string, unknown>,
    config?: Record<string, unknown>,
  ): Promise<{ entity_id: string; auth_identity_id: string }[]>;
  retrieveAuthIdentity(
    id: string,
  ): Promise<{ id: string; app_metadata: Record<string, unknown> | null }>;
};

async function loadPeople(scope: MedusaContainer) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY) as unknown as Query;
  const auth = scope.resolve(Modules.AUTH) as unknown as Auth;
  const [customers, users, sellerMembers, identities] = await Promise.all([
    query.graph({
      entity: "customer",
      fields: ["id", "email", "first_name", "last_name", "created_at", "metadata"],
      pagination: { take: 2000 },
    }),
    query.graph({
      entity: "user",
      fields: ["id", "email", "first_name", "last_name", "created_at"],
      pagination: { take: 500 },
    }),
    query.graph({
      entity: "seller_member",
      fields: [
        "id",
        "is_owner",
        "role_id",
        "seller.id",
        "seller.name",
        "member.id",
        "member.email",
        "member.first_name",
        "member.last_name",
      ],
      pagination: { take: 2000 },
    }),
    auth.listProviderIdentities({ provider: "emailpass" }, { take: 5000 }),
  ]);
  return mergePeople({
    customers: customers.data as CustomerRow[],
    users: users.data as UserRow[],
    sellerMembers: sellerMembers.data as SellerMemberRow[],
    passwordEmails: identities.map((identity) => identity.entity_id),
  });
}

/** Administración → Usuarios: every account, merged by email, with its roles. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const people = await loadPeople(req.scope);
  res.json({ people, count: people.length });
}

/**
 * Administrative actions on one person. Every rule is checked here, not in the screen:
 * an account needs its own password before it can be an administrator or join a store,
 * nobody removes their own administration or the last administrator, and store owners
 * keep their role (ownership is changed only from the store).
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  let action;
  try {
    action = parsePeopleAction(req.body);
  } catch (error) {
    if (error instanceof PeopleError) return res.status(400).json({ message: error.message });
    throw error;
  }
  const people = await loadPeople(req.scope);
  const person = people.find((entry) => entry.email === action.email);
  if (!person) return res.status(404).json({ message: "No existe esa persona." });
  const auth = req.scope.resolve(Modules.AUTH) as unknown as Auth;
  const identity = async () => {
    const [provider] = await auth.listProviderIdentities({
      provider: "emailpass",
      entity_id: person.email,
    });
    return provider ? auth.retrieveAuthIdentity(provider.auth_identity_id) : null;
  };
  const fail = (status: number, message: string) => res.status(status).json({ message });
  const noPassword =
    "Esta persona aún no tiene contraseña: debe entrar una vez en la Tienda (las cuentas del catálogo antiguo se activan así) o recibir una invitación.";

  switch (action.action) {
    case "grant_admin": {
      if (person.user_id) return fail(409, "Ya es administradora del marketplace.");
      const account = await identity();
      if (!account) return fail(409, noPassword);
      await createUserAccountWorkflow(req.scope).run({
        input: {
          authIdentityId: account.id,
          userData: {
            email: person.email,
            first_name: person.first_name ?? undefined,
            last_name: person.last_name ?? undefined,
          },
        },
      });
      break;
    }
    case "revoke_admin": {
      if (!person.user_id) return fail(409, "No es administradora del marketplace.");
      if (person.user_id === req.auth_context.actor_id)
        return fail(409, "No puedes quitarte la administración a ti mismo.");
      if (people.filter((entry) => entry.user_id).length <= 1)
        return fail(409, "Debe quedar al menos un administrador.");
      await removeUserAccountWorkflow(req.scope).run({ input: { userId: person.user_id } });
      break;
    }
    case "add_to_store": {
      if (person.stores.some((store) => store.seller_id === action.seller_id))
        return fail(409, "Ya forma parte del equipo de esa tienda.");
      const account = await identity();
      if (!account) return fail(409, noPassword);
      const memberId = account.app_metadata?.member_id as string | undefined;
      if (memberId) {
        await addSellerMemberWorkflow(req.scope).run({
          input: { seller_id: action.seller_id, member_id: memberId, role_id: action.role_id },
        });
      } else {
        const { result: invites } = await createMemberInvitesWorkflow(req.scope).run({
          input: [{ seller_id: action.seller_id, email: person.email, role_id: action.role_id }],
        });
        await acceptMemberInviteWorkflow(req.scope).run({
          input: {
            invite_token: (invites as { token?: string }[])[0].token as string,
            auth_identity_id: account.id,
            first_name: person.first_name ?? undefined,
            last_name: person.last_name ?? undefined,
          },
        });
      }
      break;
    }
    case "change_role":
    case "remove_from_store": {
      const store = person.stores.find(
        (entry) => entry.seller_member_id === action.seller_member_id,
      );
      if (!store) return fail(404, "Esa persona no está en esa tienda.");
      if (store.is_owner)
        return fail(409, "El propietario de la tienda conserva su rol; cámbialo desde la tienda.");
      if (action.action === "change_role") {
        await updateMemberRoleWorkflow(req.scope).run({
          input: { seller_member_id: store.seller_member_id, role_id: action.role_id },
        });
      } else {
        await removeSellerMemberWorkflow(req.scope).run({
          input: { seller_member_id: store.seller_member_id, seller_id: store.seller_id },
        });
      }
      break;
    }
  }

  const updated = (await loadPeople(req.scope)).find((entry) => entry.email === person.email);
  res.json({ person: updated ?? null });
}

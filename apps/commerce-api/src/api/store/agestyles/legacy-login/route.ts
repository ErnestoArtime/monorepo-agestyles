import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MedusaError, Modules } from "@medusajs/framework/utils";
import {
  allowAttempt,
  hasEmailIdentity,
  legacyAuthConfig,
  legacyCustomer,
  verifyLegacyPassword,
} from "../../../../lib/legacy-accounts";

type AuthModule = {
  register(
    provider: string,
    data: { body: Record<string, unknown> },
  ): Promise<{
    success: boolean;
    authIdentity?: { id: string; app_metadata?: Record<string, unknown> | null };
    error?: string;
  }>;
  updateAuthIdentities(data: {
    id: string;
    app_metadata: Record<string, unknown>;
  }): Promise<unknown>;
};
type CustomerModule = {
  updateCustomers(id: string, data: Record<string, unknown>): Promise<unknown>;
};

/**
 * First sign-in of an account migrated from the old catalog (AG-32 phase C). Tienda calls
 * it only after a normal sign-in fails. If the old catalog accepts the email and password,
 * the same password is saved in Medusa and linked to the imported customer; then the app
 * signs in normally. The answer never reveals whether an email exists.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body ?? {}) as { email?: unknown; password?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email.includes("@") || password.length < 6 || password.length > 200) {
    res.json({ migrated: false });
    return;
  }
  const client = String(req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "");
  if (!allowAttempt(`email:${email}`) || !allowAttempt(`client:${client}`, 20)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Demasiados intentos. Espera unos minutos.",
    );
  }
  if (!legacyAuthConfig()) {
    res.json({ migrated: false });
    return;
  }
  const customer = await legacyCustomer(req.scope, email);
  if (!customer || (await hasEmailIdentity(req.scope, email))) {
    res.json({ migrated: false });
    return;
  }
  if (!(await verifyLegacyPassword(email, password))) {
    res.json({ migrated: false });
    return;
  }
  const auth = req.scope.resolve(Modules.AUTH) as unknown as AuthModule;
  const registered = await auth.register("emailpass", { body: { email, password } });
  if (!registered.success || !registered.authIdentity) {
    res.json({ migrated: false });
    return;
  }
  await auth.updateAuthIdentities({
    id: registered.authIdentity.id,
    app_metadata: { ...(registered.authIdentity.app_metadata ?? {}), customer_id: customer.id },
  });
  await (req.scope.resolve(Modules.CUSTOMER) as unknown as CustomerModule).updateCustomers(
    customer.id,
    {
      has_account: true,
      metadata: { ...(customer.metadata ?? {}), legacy_migrated_at: new Date().toISOString() },
    },
  );
  res.json({ migrated: true });
}

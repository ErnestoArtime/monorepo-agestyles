import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { approveSellerWorkflow, createSellerAccountWorkflow } from "@mercurjs/core/workflows";
import { SellerStatus } from "@mercurjs/types";

export default async function createOfficialSeller({ container }: ExecArgs) {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
  if (
    process.env.AGESTYLES_COMMERCE_ENV !== "production" ||
    databaseUrl.host !== "127.0.0.1:15473" ||
    databaseUrl.username !== "agestyles_production" ||
    databaseUrl.pathname !== "/agestyles_commerce"
  ) {
    throw new Error("Este comando requiere la base de producción de AgeStyles.");
  }

  const email = process.env.AGESTYLES_OFFICIAL_OWNER_EMAIL?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Configura AGESTYLES_OFFICIAL_OWNER_EMAIL con el correo del titular.");
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data: sellers } = await query.graph({
    entity: "seller",
    fields: ["id", "name", "email", "external_id", "status"],
    filters: { email },
  });
  if (sellers.length) {
    const [seller] = sellers;
    if (sellers.length !== 1 || seller.external_id !== "agestyles-official") {
      throw new Error("El correo ya está asociado a otra tienda.");
    }
    if (seller.status === SellerStatus.PENDING_APPROVAL) {
      await approveSellerWorkflow(container).run({ input: { seller_id: seller.id } });
    } else if (seller.status !== SellerStatus.OPEN) {
      throw new Error("El estado actual de la tienda requiere revisión en Mercur.");
    }
    console.log(seller.id);
    return;
  }

  const password = process.env.AGESTYLES_OFFICIAL_OWNER_PASSWORD;
  if (!password || password.length < 16) {
    throw new Error("Configura una contraseña del titular de al menos 16 caracteres.");
  }
  const auth = container.resolve(Modules.AUTH);
  const registration = await auth.register("emailpass", { body: { email, password } });
  if (!registration.success || !registration.authIdentity?.id) {
    throw new Error(
      "No se pudo registrar al titular. Comprueba si el correo ya tiene una identidad.",
    );
  }

  const { result: seller } = await createSellerAccountWorkflow(container).run({
    input: {
      auth_identity_id: registration.authIdentity.id,
      member_email: email,
      first_name: "AgeStyles",
      last_name: "Oficial",
      seller: { name: "AgeStyles", email, currency_code: "usd", external_id: "agestyles-official" },
    },
  });
  await approveSellerWorkflow(container).run({ input: { seller_id: seller.id } });
  console.log(seller.id);
}

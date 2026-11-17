import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  linkProductsToSalesChannelWorkflow,
  updateProductCategoriesWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows";

/**
 * Publishes the official store's products that already have an offer, links them to
 * the default sales channel and activates their categories (and ancestors). Products
 * without an offer and empty categories stay hidden. Idempotent.
 *
 * Without AGESTYLES_OFFICIAL_PUBLISH_APPLY=true it only reports what it would do.
 */
export default async function publishOfficialCatalog({ container }: ExecArgs) {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
  if (
    process.env.AGESTYLES_COMMERCE_ENV !== "production" ||
    databaseUrl.host !== "127.0.0.1:15473" ||
    databaseUrl.username !== "agestyles_production" ||
    databaseUrl.pathname !== "/agestyles_commerce"
  ) {
    throw new Error("Este comando requiere la base de producción de AgeStyles.");
  }
  const apply = process.env.AGESTYLES_OFFICIAL_PUBLISH_APPLY === "true";
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data: sellers } = await query.graph({
    entity: "seller",
    fields: ["id", "status"],
    filters: { external_id: "agestyles-official" },
  });
  const seller = sellers[0] as { id: string; status: string } | undefined;
  if (sellers.length !== 1 || seller?.status !== "open") {
    throw new Error("La tienda oficial debe existir y estar abierta.");
  }
  const { data: channels } = await query.graph({
    entity: "sales_channel",
    fields: ["id"],
    filters: { name: "Default Sales Channel" },
  });
  const channelId = (channels[0] as { id: string } | undefined)?.id;
  if (!channelId) throw new Error("Falta el canal de venta por defecto.");

  const { data: offers } = await query.graph({
    entity: "offer",
    fields: ["id", "variant_id"],
    filters: { seller_id: seller.id },
  });
  const variantIds = [...new Set((offers as { variant_id: string }[]).map((o) => o.variant_id))];
  if (!variantIds.length) throw new Error("La tienda oficial no tiene ofertas.");

  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: ["id", "product_id"],
    filters: { id: variantIds },
  });
  const productIds = [...new Set((variants as { product_id: string }[]).map((v) => v.product_id))];
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "status", "sales_channels.id", "categories.id"],
    filters: { id: productIds },
  });
  const rows = products as {
    id: string;
    status: string;
    sales_channels?: { id: string }[];
    categories?: { id: string }[];
  }[];
  const toPublish = rows.filter((p) => p.status !== "published").map((p) => p.id);
  const toLink = rows
    .filter((p) => !p.sales_channels?.some((c) => c.id === channelId))
    .map((p) => p.id);

  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id", "is_active", "parent_category_id"],
  });
  const byId = new Map(
    (categories as { id: string; is_active: boolean; parent_category_id: string | null }[]).map(
      (c) => [c.id, c],
    ),
  );
  const wanted = new Set<string>();
  for (const product of rows) {
    for (const { id } of product.categories ?? []) {
      let current = byId.get(id);
      while (current && !wanted.has(current.id)) {
        wanted.add(current.id);
        current = current.parent_category_id ? byId.get(current.parent_category_id) : undefined;
      }
    }
  }
  const toActivate = [...wanted].filter((id) => !byId.get(id)?.is_active);

  const report = {
    mode: apply ? "apply" : "dry-run",
    products_with_offers: rows.length,
    products_to_publish: toPublish.length,
    products_to_link_channel: toLink.length,
    categories_used: wanted.size,
    categories_to_activate: toActivate.length,
  };
  if (!apply) {
    console.log(JSON.stringify(report));
    return;
  }

  if (toLink.length) {
    await linkProductsToSalesChannelWorkflow(container).run({
      input: { id: channelId, add: toLink },
    });
  }
  for (const id of toActivate) {
    await updateProductCategoriesWorkflow(container).run({
      input: { selector: { id }, update: { is_active: true } },
    });
  }
  if (toPublish.length) {
    await updateProductsWorkflow(container).run({
      input: { selector: { id: toPublish }, update: { status: "published" } },
    });
  }
  console.log(JSON.stringify(report));
}

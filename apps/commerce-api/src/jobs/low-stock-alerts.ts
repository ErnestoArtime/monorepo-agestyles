import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { notifySellerMembers, queryGraph } from "../lib/notifications";

const PAGE = 200;
const DEFAULT_THRESHOLD = 3;

type Level = { stocked_quantity?: number | null; reserved_quantity?: number | null };
type Item = {
  id: string;
  sku?: string | null;
  title?: string | null;
  location_levels?: Level[];
  variants?: { title?: string | null; product?: { title?: string | null } | null }[];
};

/** ISO week label (e.g. 2026-W47): at most one alert per product per week while it stays low. */
function weekKey(date: Date): string {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((day.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const available = (item: Item) =>
  (item.location_levels ?? []).reduce(
    (sum, level) =>
      sum + Number(level.stocked_quantity ?? 0) - Number(level.reserved_quantity ?? 0),
    0,
  );

async function loadItems(container: MedusaContainer, ids: string[]): Promise<Item[]> {
  const query = queryGraph(container);
  const base = [
    "id",
    "sku",
    "title",
    "location_levels.stocked_quantity",
    "location_levels.reserved_quantity",
  ];
  try {
    const { data } = await query.graph({
      entity: "inventory_item",
      fields: [...base, "variants.title", "variants.product.title"],
      filters: { id: ids },
    });
    return data as unknown as Item[];
  } catch {
    const { data } = await query.graph({
      entity: "inventory_item",
      fields: base,
      filters: { id: ids },
    });
    return data as unknown as Item[];
  }
}

/**
 * Product name for each inventory item. Mercur keeps one inventory item per offer, linked
 * through `inventory_item_link`; the item's own title is the variant's («Default»).
 */
async function productTitles(
  container: MedusaContainer,
  sellerIds: string[],
): Promise<Map<string, string>> {
  const titles = new Map<string, string>();
  if (!sellerIds.length) return titles;
  const { data } = await queryGraph(container).graph({
    entity: "offer",
    fields: ["product.title", "inventory_item_link.inventory_item_id"],
    filters: { seller_id: sellerIds },
  });
  for (const offer of data as {
    product?: { title?: string | null } | null;
    inventory_item_link?: { inventory_item_id?: string | null }[] | null;
  }[]) {
    const title = offer.product?.title;
    if (!title) continue;
    for (const link of offer.inventory_item_link ?? [])
      if (link.inventory_item_id) titles.set(link.inventory_item_id, title);
  }
  return titles;
}

function label(item: Item, titles: Map<string, string>): string | undefined {
  const product =
    titles.get(item.id) ?? item.variants?.find((variant) => variant.product?.title)?.product?.title;
  return (
    product ??
    (item.title && item.title !== "Default" ? item.title : undefined) ??
    item.sku ??
    undefined
  );
}

/**
 * Looks for stock at or under the threshold (AGESTYLES_LOW_STOCK_THRESHOLD, default 3) and
 * tells the owner, administration and inventory roles of the store that owns each item.
 */
export default async function lowStockAlerts(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const threshold = Number(process.env.AGESTYLES_LOW_STOCK_THRESHOLD ?? DEFAULT_THRESHOLD);
  if (!Number.isFinite(threshold) || threshold < 0) return;
  try {
    await container.resolve(Modules.LOCKING).execute(
      "agestyles-notifications:low-stock",
      async () => {
        const query = queryGraph(container);
        const week = weekKey(new Date());
        let alerts = 0;
        for (let skip = 0; ; skip += PAGE) {
          const { data: links } = await query.graph({
            entity: "inventory_item_seller",
            fields: ["inventory_item_id", "seller_id"],
            pagination: { take: PAGE, skip },
          });
          if (links.length === 0) break;
          const sellerByItem = new Map(
            (links as { inventory_item_id: string; seller_id: string }[]).map((link) => [
              link.inventory_item_id,
              link.seller_id,
            ]),
          );
          const titles = await productTitles(container, [...new Set(sellerByItem.values())]);
          for (const item of await loadItems(container, [...sellerByItem.keys()])) {
            const units = available(item);
            const sellerId = sellerByItem.get(item.id);
            if (!sellerId || units > threshold) continue;
            await notifySellerMembers(container, {
              event_code: "seller_low_stock",
              seller_id: sellerId,
              params: { product: label(item, titles), available: Math.max(units, 0) },
              key: ["low_stock", item.id, week],
            });
            alerts += 1;
          }
          if (links.length < PAGE) break;
        }
        if (alerts > 0) logger.info(`Low stock check: ${alerts} items at or under ${threshold}`);
      },
      { timeout: 1 },
    );
  } catch (error) {
    logger.warn(
      `Low stock check skipped: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

export const config = { name: "agestyles-low-stock-alerts", schedule: "*/30 * * * *" };

import { buildWhatsAppOrderUrl, listSellerContacts } from "@agestyles/api-client/seller-contacts";
import type { StoreClient } from "@agestyles/api-client/store";

/**
 * Per-seller "consult my order" WhatsApp links for the confirmation screen.
 * Built from the cart right before completion so guests get them too; kept in
 * memory only, so a reload of the confirmation screen simply shows no buttons.
 */
export type SellerOrderSnapshot = {
  sellerId: string;
  currencyCode: string;
  email?: string | null;
  lines: { title: string; variant?: string | null; quantity: number; unitPrice?: number | null }[];
};

export type SellerWhatsAppLink = { sellerId: string; sellerName: string; url: string };

const linksByGroup = new Map<string, SellerWhatsAppLink[]>();

type CartWithOffers = {
  email?: string | null;
  currency_code: string;
  items?: {
    title?: string | null;
    product_title?: string | null;
    variant_title?: string | null;
    quantity: number;
    unit_price?: number | null;
    offer?: { seller_id?: string | null } | null;
  }[];
};

/** Reads the cart lines grouped by seller. Returns [] instead of failing checkout. */
export async function snapshotCartBySeller(
  client: StoreClient,
  cartId: string,
): Promise<SellerOrderSnapshot[]> {
  try {
    const { cart } = await client.fetch<{ cart: CartWithOffers }>(`/store/carts/${cartId}`, {
      query: { fields: "email,currency_code,*items,*items.offer" },
    });
    const bySeller = new Map<string, SellerOrderSnapshot>();
    for (const item of cart.items ?? []) {
      const sellerId = item.offer?.seller_id;
      if (!sellerId) continue;
      const entry = bySeller.get(sellerId) ?? {
        sellerId,
        currencyCode: cart.currency_code,
        email: cart.email,
        lines: [],
      };
      entry.lines.push({
        title: item.product_title || item.title || "Producto",
        variant: item.variant_title,
        quantity: item.quantity,
        unitPrice: item.unit_price,
      });
      bySeller.set(sellerId, entry);
    }
    return [...bySeller.values()];
  } catch {
    return [];
  }
}

/** Resolves seller numbers and stores the links for the order group. Never throws. */
export async function rememberOrderWhatsAppLinks(
  client: StoreClient,
  groupId: string,
  snapshots: SellerOrderSnapshot[],
): Promise<void> {
  if (!snapshots.length) return;
  try {
    const contacts = await listSellerContacts(
      client,
      snapshots.map((snapshot) => snapshot.sellerId),
    );
    const links: SellerWhatsAppLink[] = [];
    for (const snapshot of snapshots) {
      const contact = contacts[snapshot.sellerId];
      if (!contact?.whatsappPhone) continue;
      const total = snapshot.lines.reduce(
        (sum, line) => sum + (line.unitPrice ?? 0) * line.quantity,
        0,
      );
      const url = buildWhatsAppOrderUrl({
        phone: contact.whatsappPhone,
        sellerName: contact.name,
        orderReference: groupId,
        currencyCode: snapshot.currencyCode,
        total: total > 0 ? total : null,
        email: snapshot.email,
        lines: snapshot.lines,
      });
      if (url) links.push({ sellerId: snapshot.sellerId, sellerName: contact.name, url });
    }
    linksByGroup.set(groupId, links);
  } catch {
    // Contact lookup is optional; the order is already placed.
  }
}

export function orderWhatsAppLinks(groupId: string | undefined): SellerWhatsAppLink[] {
  return groupId ? (linksByGroup.get(groupId) ?? []) : [];
}

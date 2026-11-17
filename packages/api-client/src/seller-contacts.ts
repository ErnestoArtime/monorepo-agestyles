import type { StoreClient } from "./transport";

export { buildWhatsAppOrderUrl, type WhatsAppOrder } from "@agestyles/domain/whatsapp";

export type SellerContact = { id: string; name: string; whatsappPhone: string | null };

/**
 * Public contact data sellers chose to publish. The WhatsApp number lives in
 * `seller.metadata.whatsapp_phone` because the Store API exposes metadata but not `phone`.
 */
export async function listSellerContacts(
  client: StoreClient,
  sellerIds: string[],
): Promise<Record<string, SellerContact>> {
  const ids = [...new Set(sellerIds.filter(Boolean))];
  if (!ids.length) return {};
  const result = await client.fetch<{
    sellers: { id: string; name: string; metadata?: Record<string, unknown> | null }[];
  }>("/store/sellers", { query: { id: ids, fields: "id,name,metadata", limit: ids.length } });
  return Object.fromEntries(
    result.sellers.map((seller) => {
      const phone = seller.metadata?.whatsapp_phone;
      return [
        seller.id,
        {
          id: seller.id,
          name: seller.name,
          whatsappPhone: typeof phone === "string" ? phone : null,
        },
      ];
    }),
  );
}

type StockLevel = {
  location_id: string;
  stocked_quantity: number;
  reserved_quantity: number;
};

export type ShippingLine = {
  quantity: number;
  offer?: {
    seller_id: string;
    inventory_item_link?: { inventory_item_id: string; required_quantity: number }[];
    inventory_items?: {
      id: string;
      requires_shipping: boolean;
      location_levels?: StockLevel[];
    }[];
  } | null;
};

/** Keep the upstream shortage flag unless this seller's stock can be confirmed. */
export function confirmsSellerShippingStock(
  lines: ShippingLine[],
  sellerId: string,
  locationId: string,
): boolean {
  if (lines.some((line) => !line.offer?.seller_id)) return false;
  const sellerLines = lines.filter((line) => line.offer?.seller_id === sellerId);
  if (!sellerLines.length) return false;

  const remaining = new Map<string, number>();
  for (const line of sellerLines) {
    const { offer } = line;
    const quantity = Number(line.quantity);
    if (!offer?.inventory_items || !Number.isInteger(quantity) || quantity < 1) return false;
    for (const item of offer.inventory_items) {
      if (item.requires_shipping === false) continue;
      const level = item.location_levels?.find((level) => level.location_id === locationId);
      const units = Number(
        offer.inventory_item_link?.find((link) => link.inventory_item_id === item.id)
          ?.required_quantity,
      );
      if (!level || item.requires_shipping !== true || !Number.isInteger(units) || units < 1) {
        return false;
      }
      const available =
        remaining.get(item.id) ?? Number(level.stocked_quantity) - Number(level.reserved_quantity);
      const next = available - units * quantity;
      if (!Number.isFinite(next) || next < 0) return false;
      remaining.set(item.id, next);
    }
  }
  return true;
}

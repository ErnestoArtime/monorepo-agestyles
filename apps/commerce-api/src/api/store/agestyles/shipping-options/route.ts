import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { listSellerShippingOptionsForCartWorkflow } from "@mercurjs/core/workflows";
import {
  confirmsSellerShippingStock,
  type ShippingLine,
} from "../../../../lib/seller-shipping-stock";

type StoreRequest = MedusaRequest & {
  publishable_key_context?: { sales_channel_ids: string[] };
};

type ShippingOptionProjection = {
  insufficient_inventory?: boolean;
  service_zone?: { fulfillment_set?: { location?: { id?: string } } };
};

type CartLine = Omit<ShippingLine, "offer"> & {
  offer?: (NonNullable<ShippingLine["offer"]> & { id: string }) | null;
};

type InventoryLink = { offer_id: string; inventory_item_id: string; required_quantity: number };

export async function GET(req: StoreRequest, res: MedusaResponse) {
  const cartId = req.query.cart_id;
  if (typeof cartId !== "string" || !/^cart_[a-z0-9]+$/i.test(cartId)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Indica un carrito válido.");
  }
  const channelIds = req.publishable_key_context?.sales_channel_ids;
  if (!channelIds?.length) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Se requiere un canal de venta válido.");
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data: carts } = await query.graph({
    entity: "cart",
    fields: [
      "sales_channel_id",
      "items.quantity",
      "items.offer.id",
      "items.offer.seller_id",
      "items.offer.inventory_items.id",
      "items.offer.inventory_items.requires_shipping",
      "items.offer.inventory_items.location_levels.location_id",
      "items.offer.inventory_items.location_levels.stocked_quantity",
      "items.offer.inventory_items.location_levels.reserved_quantity",
    ],
    filters: { id: cartId },
  });
  const cart = carts[0] as { sales_channel_id: string | null; items?: CartLine[] } | undefined;
  if (!cart?.sales_channel_id || !channelIds.includes(cart.sales_channel_id)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "No se encontró el carrito.");
  }
  const { result } = await listSellerShippingOptionsForCartWorkflow(req.scope).run({
    input: { cart_id: cartId, is_return: false },
  });
  const cartLines = cart.items ?? [];
  const offerIds = [...new Set(cartLines.flatMap(({ offer }) => (offer ? [offer.id] : [])))];
  const hasShortage = Object.values(result).some((options) =>
    options.some((option) => (option as ShippingOptionProjection).insufficient_inventory),
  );
  const linksByOffer = new Map<string, InventoryLink[]>();
  if (hasShortage && offerIds.length) {
    // Graph omits the link's extra columns when traversing cart → line → offer.
    const { data } = await query.graph({
      entity: "offer_inventory_item",
      fields: ["offer_id", "inventory_item_id", "required_quantity"],
      filters: { offer_id: offerIds },
    });
    for (const link of data as InventoryLink[]) {
      const links = linksByOffer.get(link.offer_id) ?? [];
      links.push(link);
      linksByOffer.set(link.offer_id, links);
    }
  }
  const lines: ShippingLine[] = cartLines.map(({ quantity, offer }) => ({
    quantity,
    offer: offer && { ...offer, inventory_item_link: linksByOffer.get(offer.id) },
  }));
  const shippingOptions = Object.fromEntries(
    Object.entries(result).map(([sellerId, options]) => [
      sellerId,
      options.map((option) => {
        // Mercur projects these fields at runtime, beyond the Medusa shipping DTO.
        const projected = option as typeof option & ShippingOptionProjection;
        const locationId = projected.service_zone?.fulfillment_set?.location?.id;
        if (
          !projected.insufficient_inventory ||
          !locationId ||
          !confirmsSellerShippingStock(lines, sellerId, locationId)
        ) {
          return option;
        }
        return { ...option, insufficient_inventory: false };
      }),
    ]),
  );
  res.setHeader("cache-control", "private, no-store");
  res.json({ shipping_options: shippingOptions });
}

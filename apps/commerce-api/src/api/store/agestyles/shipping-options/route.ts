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
      "items.offer.seller_id",
      "items.offer.inventory_item_link.inventory_item_id",
      "items.offer.inventory_item_link.required_quantity",
      "items.offer.inventory_items.id",
      "items.offer.inventory_items.requires_shipping",
      "items.offer.inventory_items.location_levels.location_id",
      "items.offer.inventory_items.location_levels.stocked_quantity",
      "items.offer.inventory_items.location_levels.reserved_quantity",
    ],
    filters: { id: cartId },
  });
  const cart = carts[0] as { sales_channel_id: string | null; items?: ShippingLine[] } | undefined;
  if (!cart?.sales_channel_id || !channelIds.includes(cart.sales_channel_id)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "No se encontró el carrito.");
  }
  const lines = cart.items ?? [];

  const { result } = await listSellerShippingOptionsForCartWorkflow(req.scope).run({
    input: { cart_id: cartId, is_return: false },
  });
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

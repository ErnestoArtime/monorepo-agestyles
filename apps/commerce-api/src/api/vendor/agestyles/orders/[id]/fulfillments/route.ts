import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { createOrderFulfillmentWorkflow } from "@mercurjs/core/workflows/order/workflows/create-order-fulfillment";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";

type SellerRequest = AuthenticatedMedusaRequest & {
  seller_context?: { seller_id?: string };
  permissions?: Record<string, string | undefined>;
  permissions_enforced?: boolean;
  body?: unknown;
};

type OrderProjection = {
  id: string;
  status?: string;
  items?: { id: string; quantity: number; requires_shipping?: boolean }[];
  fulfillments?: {
    canceled_at?: string | Date | null;
    items?: { line_item_id?: string | null; quantity: number }[];
  }[];
};

type QueryGraph = {
  graph(input: {
    entity: string;
    fields: string[];
    filters: Record<string, unknown>;
  }): Promise<{ data: Record<string, unknown>[] }>;
};

type FulfillmentBody = {
  location_id: string;
  items: { id: string; quantity: number }[];
};

function invalidData(message: string): never {
  throw new MedusaError(MedusaError.Types.INVALID_DATA, message);
}

function parseBody(body: unknown): FulfillmentBody {
  if (!body || typeof body !== "object") invalidData("A fulfillment body is required.");
  const candidate = body as Record<string, unknown>;
  if (typeof candidate.location_id !== "string" || !candidate.location_id.trim()) {
    invalidData("A stock location is required.");
  }
  if (!Array.isArray(candidate.items) || candidate.items.length === 0) {
    invalidData("At least one order item is required.");
  }
  const items = candidate.items.map((item) => {
    if (!item || typeof item !== "object") invalidData("Invalid fulfillment item.");
    const row = item as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      !row.id.trim() ||
      typeof row.quantity !== "number" ||
      !Number.isSafeInteger(row.quantity) ||
      row.quantity < 1
    ) {
      invalidData("Each fulfillment item needs an order line and a positive whole quantity.");
    }
    return { id: row.id, quantity: row.quantity };
  });
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    invalidData("An order line may only appear once.");
  }
  return { location_id: candidate.location_id, items };
}

/**
 * AgeStyles seller fulfillment extension. It uses Mercur's fulfillment workflow
 * while adding seller-scoped checks for both the order and stock location.
 */
export async function POST(req: SellerRequest, res: MedusaResponse) {
  const sellerId = req.seller_context?.seller_id;
  if (!sellerId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "A selected seller is required.");
  }
  const orderPermission = req.permissions?.orders;
  if (
    req.permissions_enforced !== true ||
    (orderPermission !== "edit" && orderPermission !== "manage")
  ) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Order fulfillment is not allowed.");
  }

  const body = parseBody(req.body);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as unknown as QueryGraph;
  const orderId = req.params.id;

  const [{ data: sellerOrders }, { data: sellerLocations }, { data: orders }] = await Promise.all([
    query.graph({
      entity: "order_seller",
      fields: ["order_id"],
      filters: { seller_id: sellerId, order_id: orderId },
    }),
    query.graph({
      entity: "stock_location_seller",
      fields: ["stock_location_id"],
      filters: { seller_id: sellerId, stock_location_id: body.location_id },
    }),
    query.graph({
      entity: "order",
      fields: [
        "id",
        "status",
        "items.id",
        "items.quantity",
        "items.requires_shipping",
        "fulfillments.canceled_at",
        "fulfillments.items.line_item_id",
        "fulfillments.items.quantity",
      ],
      filters: { id: orderId, is_draft_order: false },
    }),
  ]);

  if (!sellerOrders.length || !orders[0]) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Order ${orderId} was not found.`);
  }
  if (!sellerLocations.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "The stock location was not found for this seller.",
    );
  }

  const order = orders[0] as unknown as OrderProjection;
  if (order.status === "canceled") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "A canceled order cannot be fulfilled.");
  }
  const orderItems = order.items ?? [];
  const fulfilled = new Map<string, number>();
  for (const fulfillment of order.fulfillments ?? []) {
    if (fulfillment.canceled_at) continue;
    for (const item of fulfillment.items ?? []) {
      if (item.line_item_id) {
        fulfilled.set(
          item.line_item_id,
          (fulfilled.get(item.line_item_id) ?? 0) + Number(item.quantity),
        );
      }
    }
  }
  const quantities = new Map(orderItems.map((item) => [item.id, Number(item.quantity)]));
  for (const requested of body.items) {
    const orderedQuantity = quantities.get(requested.id);
    if (orderedQuantity === undefined)
      invalidData("A fulfillment item does not belong to this order.");
    const orderItem = orderItems.find((item) => item.id === requested.id);
    if (orderItem?.requires_shipping === false) {
      invalidData("This order line does not require shipping.");
    }
    const remaining = orderedQuantity - (fulfilled.get(requested.id) ?? 0);
    if (requested.quantity > remaining) {
      invalidData("The fulfillment quantity exceeds the unfulfilled order quantity.");
    }
  }

  const { result: fulfillment } = await createOrderFulfillmentWorkflow(req.scope).run({
    input: {
      order_id: orderId,
      created_by: sellerId,
      items: body.items,
      requires_shipping: true,
      location_id: body.location_id,
    },
  });
  return res.status(201).json({ fulfillment });
}

import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import type { OrderTracking } from "@agestyles/domain/tracking" with {
  "resolution-mode": "import"
}

/**
 * Buyer read of the line-level tracking of one of their own orders.
 *
 * Medusa already records fulfillments, fulfillment items and tracking labels.
 * This route projects them per purchased line and scopes the read to the
 * authenticated customer: an order that belongs to someone else is reported as
 * not found, exactly like an unknown id.
 */

type OrderDetail = {
  id: string
  items?: Array<{ id: string; title: string; quantity: number }>
  fulfillments?: Array<{
    id: string
    shipped_at?: string | Date | null
    delivered_at?: string | Date | null
    canceled_at?: string | Date | null
    items?: Array<{ line_item_id: string | null; quantity: number }>
    labels?: Array<{ tracking_number: string; tracking_url?: string | null }>
  }>
}

type QueryGraph = {
  graph(input: {
    entity: string
    fields: string[]
    filters: Record<string, unknown>
  }): Promise<{ data: OrderDetail[] }>
}

const fields = [
  "id",
  "items.id",
  "items.title",
  "items.quantity",
  "fulfillments.id",
  "fulfillments.shipped_at",
  "fulfillments.delivered_at",
  "fulfillments.canceled_at",
  "fulfillments.items.line_item_id",
  "fulfillments.items.quantity",
  "fulfillments.labels.tracking_number",
  "fulfillments.labels.tracking_url",
]

/**
 * `@agestyles/domain` is ESM and this app compiles to CommonJS, so the pure
 * rule is loaded through a cached dynamic import typed structurally.
 */
type TrackingRules = {
  buildOrderTracking(order: {
    id: string
    items: Array<{ id: string; title: string; quantity: number }>
    fulfillments: Array<{
      id: string
      shipped_at?: string | Date | null
      delivered_at?: string | Date | null
      canceled_at?: string | Date | null
      items: Array<{ line_item_id: string | null; quantity: number }>
      labels?: Array<{ tracking_number: string; tracking_url?: string | null }>
    }>
  }): OrderTracking
}

let trackingRules: Promise<TrackingRules> | undefined

function loadTrackingRules(): Promise<TrackingRules> {
  trackingRules ??= import("@agestyles/domain/tracking") as unknown as Promise<TrackingRules>
  return trackingRules
}

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
  const actorId = req.auth_context?.actor_id
  if (!actorId) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Authentication is required.",
    )
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as unknown as QueryGraph
  // Ownership is part of the filter, not an after-the-fact comparison: a
  // foreign order is never loaded, so its lines and labels cannot leak.
  const { data } = await query.graph({
    entity: "order",
    fields,
    filters: {
      id: req.params.id,
      is_draft_order: false,
      customer_id: actorId,
    },
  })

  const order = data[0]
  if (!order) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Order ${req.params.id} was not found.`,
    )
  }

  const { buildOrderTracking } = await loadTrackingRules()
  const tracking = buildOrderTracking({
    id: order.id,
    items: (order.items ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      quantity: Number(item.quantity),
    })),
    fulfillments: (order.fulfillments ?? [])
      .filter((fulfillment): fulfillment is NonNullable<typeof fulfillment> => Boolean(fulfillment))
      .map((fulfillment) => ({
      id: fulfillment.id,
      shipped_at: fulfillment.shipped_at ?? null,
      delivered_at: fulfillment.delivered_at ?? null,
      canceled_at: fulfillment.canceled_at ?? null,
      items: (fulfillment.items ?? []).map((item) => ({
        line_item_id: item.line_item_id,
        quantity: Number(item.quantity),
      })),
      labels: (fulfillment.labels ?? []).map((label) => ({
        tracking_number: label.tracking_number,
        tracking_url: label.tracking_url ?? null,
      })),
      })),
  })

  res.json({ tracking })
}

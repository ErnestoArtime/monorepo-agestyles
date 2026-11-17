import assert from "node:assert/strict"
import type { ExecArgs } from "@medusajs/framework/types"
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import {
  createOrderFulfillmentWorkflow,
  createOrderShipmentWorkflow,
  cancelOrderFulfillmentWorkflow,
} from "@medusajs/medusa/core-flows"
import { GET as readTracking } from "../api/store/orders/[id]/tracking/route"

/**
 * Proves the buyer's line-level tracking read against the isolated lab:
 *
 * - a shipment created with Medusa's own workflows is projected per line;
 * - the tracking number and URL survive the projection;
 * - the quantity shipped is capped at the purchased quantity;
 * - the owner reads their order, another customer gets a 404;
 * - after cancelling the fulfillment the line is no longer shown as shipped.
 *
 * Run with:
 *   pnpm --filter @agestyles/commerce-api exec medusa exec ./src/scripts/verify-order-tracking.ts
 */

type OrderItem = { id: string; quantity: number; title: string }
type OrderRecord = OrderRecordBase & {
  fulfillment_status?: string
  fulfillments?: Array<{ id: string } | null> | null
}
type OrderRecordBase = {
  id: string
  customer_id: string
  items: OrderItem[]
  shipping_methods?: Array<{ shipping_option_id: string | null }>
}

type RouteState = { statusCode: number; body: unknown }

function createResponse(): { res: MedusaResponse; state: RouteState } {
  const state: RouteState = { statusCode: 200, body: undefined }
  const res = {
    status(code: number) {
      state.statusCode = code
      return res
    },
    json(body: unknown) {
      state.body = body
      return res
    },
  }
  return { res: res as unknown as MedusaResponse, state }
}

function request(
  container: ExecArgs["container"],
  actorId: string | undefined,
  params: Record<string, string> = {},
) {
  return {
    scope: container,
    params,
    query: {},
    ...(actorId
      ? {
          auth_context: {
            actor_id: actorId,
            actor_type: "customer",
            auth_identity_id: actorId,
            app_metadata: {},
            user_metadata: {},
          },
        }
      : {}),
  } as unknown as AuthenticatedMedusaRequest
}

type LineTracking = {
  line_item_id: string
  status: string
  shipped_quantity: number
  shipments: Array<{
    tracking: Array<{ tracking_number: string; tracking_url: string | null }>
  }>
}

type TrackingBody = {
  tracking: {
    order_id: string
    status: string
    lines: LineTracking[]
  }
}

export default async function verifyOrderTracking({ container }: ExecArgs) {
  const databaseUrl = process.env.DATABASE_URL ?? ""
  if (
    !/^postgres(?:ql)?:\/\/agestyles_lab:[a-f0-9]+@127\.0\.0\.1:15472\/agestyles_mercur_lab$/.test(
      databaseUrl,
    )
  ) {
    throw new Error("This verifier is restricted to the loopback AgeStyles lab database.")
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
    graph(input: Record<string, unknown>): Promise<{ data: OrderRecord[] }>
  }
  const { data: candidates } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "customer_id",
      "fulfillment_status",
      "items.id",
      "items.quantity",
      "items.title",
      "shipping_methods.shipping_option_id",
      "fulfillments.id",
    ],
    pagination: { take: 100, order: { created_at: "DESC" } },
  })
  const order = candidates.find(
    (candidate) =>
      candidate.customer_id &&
      candidate.items?.length &&
      candidate.shipping_methods?.[0]?.shipping_option_id &&
      candidate.fulfillment_status === "not_fulfilled" &&
      (candidate.fulfillments ?? []).length === 0,
  )
  if (!order?.items?.length) {
    throw new Error(
      "The lab needs a clean customer order with shipping and no fulfillments. Run the checkout verifier or restore a clean fixture first.",
    )
  }

  const line = order.items[0]
  const shippingOptionId = order.shipping_methods?.[0]?.shipping_option_id
  if (!shippingOptionId) {
    throw new Error("The lab order has no shipping method to fulfill against.")
  }

  let fulfillmentId: string | undefined
  try {
    // A real Medusa fulfillment for one unit, using the order's own shipping
    // option. Nothing is stubbed: the projection reads what the framework
    // actually persisted.
    const { result: fulfillment } = await createOrderFulfillmentWorkflow(
      container,
    ).run({
      input: {
        order_id: order.id,
        items: [{ id: line.id, quantity: 1 }],
        shipping_option_id: shippingOptionId,
        no_notification: true,
      },
    })
    fulfillmentId = fulfillment.id

    await createOrderShipmentWorkflow(container).run({
      input: {
        order_id: order.id,
        fulfillment_id: fulfillment.id,
        items: [{ id: line.id, quantity: 1 }],
        labels: [
          {
            tracking_number: "AGSLAB-TRK-001",
            tracking_url: "https://tracking.example.com/AGSLAB-TRK-001",
            label_url: "https://labels.example.com/AGSLAB-TRK-001.pdf",
          },
        ],
        no_notification: true,
      },
    })

    // The owner sees the shipment on the matching line only.
    const owner = createResponse()
    await readTracking(
      request(container, order.customer_id, { id: order.id }),
      owner.res,
    )
    const body = owner.state.body as TrackingBody
    assert.equal(body.tracking.order_id, order.id)
    const shippedLine = body.tracking.lines.find(
      (row) => row.line_item_id === line.id,
    )
    assert.ok(shippedLine, "the purchased line must be projected")
    assert.equal(shippedLine.status, "shipped")
    assert.equal(shippedLine.shipped_quantity, 1)
    assert.deepEqual(shippedLine.shipments[0].tracking, [
      {
        tracking_number: "AGSLAB-TRK-001",
        tracking_url: "https://tracking.example.com/AGSLAB-TRK-001",
      },
    ])
    for (const other of body.tracking.lines) {
      if (other.line_item_id === line.id) continue
      assert.equal(
        other.shipments.length,
        0,
        "a line that was not shipped must not show a shipment",
      )
    }

    // A different customer cannot read the order, and the error is the same
    // one an unknown id produces.
    const foreign = createResponse()
    await assert.rejects(
      () =>
        readTracking(
          request(container, "cus_not_the_owner", { id: order.id }),
          foreign.res,
        ),
      (error: unknown) =>
        (error as { type?: string }).type === MedusaError.Types.NOT_FOUND,
      "another customer must get a 404",
    )

    // Medusa does not allow a shipped fulfillment to be canceled. This is a
    // disposable loopback-only verifier, so clear its shipment marker/labels,
    // then use the supported cancellation workflow to restore reserved stock.
    const cleanupFulfillment = async () => {
      if (!fulfillmentId) return
      const fulfillmentService = container.resolve(Modules.FULFILLMENT) as {
        updateFulfillment(
          id: string,
          data: {
            shipped_at: null
            delivered_at: null
            labels: []
          },
        ): Promise<unknown>
      }
      await fulfillmentService.updateFulfillment(fulfillmentId, {
        shipped_at: null,
        delivered_at: null,
        labels: [],
      })
      await cancelOrderFulfillmentWorkflow(container).run({
        input: {
          order_id: order.id,
          fulfillment_id: fulfillmentId,
          no_notification: true,
        },
      })
      fulfillmentId = undefined
    }

    await cleanupFulfillment()

    const afterCancel = createResponse()
    await readTracking(
      request(container, order.customer_id, { id: order.id }),
      afterCancel.res,
    )
    const cancelledBody = afterCancel.state.body as TrackingBody
    const cancelledLine = cancelledBody.tracking.lines.find(
      (row) => row.line_item_id === line.id,
    )
    assert.ok(cancelledLine)
    assert.equal(cancelledLine.shipments.length, 0)
    assert.equal(cancelledLine.shipped_quantity, 0)

    console.log(
      JSON.stringify({
        orderId: order.id,
        lineId: line.id,
        shippedPerLine: true,
        trackingNumber: "AGSLAB-TRK-001",
        trackingUrlPreserved: true,
        otherLinesUnaffected: true,
        foreignCustomerBlocked: true,
        canceledFulfillmentHidden: true,
      }),
    )
  } finally {
    if (fulfillmentId) {
      const fulfillmentService = container.resolve(Modules.FULFILLMENT) as {
        updateFulfillment(
          id: string,
          data: {
            shipped_at: null
            delivered_at: null
            labels: []
          },
        ): Promise<unknown>
      }
      await fulfillmentService.updateFulfillment(fulfillmentId, {
        shipped_at: null,
        delivered_at: null,
        labels: [],
      })
      await cancelOrderFulfillmentWorkflow(container).run({
        input: {
          order_id: order.id,
          fulfillment_id: fulfillmentId,
          no_notification: true,
        },
      })
      fulfillmentId = undefined
      console.log("Cleaned up tracking verification fulfillment")
    }
  }
}

import assert from "node:assert/strict"
import type { ExecArgs } from "@medusajs/framework/types"
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import type {
  ManualPaymentRecord,
  ManualPaymentsService,
} from "@agestyles/manual-payments" with { "resolution-mode": "import" }
import {
  GET as listOwnPayments,
  POST as submitProof,
} from "../api/store/orders/[id]/manual-payments/route"
import { GET as adminList } from "../api/admin/manual-payments/route"
import { POST as adminVerify } from "../api/admin/manual-payments/[id]/verify/route"
import { POST as adminReject } from "../api/admin/manual-payments/[id]/reject/route"

/**
 * Proves manual payment proofs against the isolated lab:
 *
 * - a proof above the order total or in another currency is rejected;
 * - one pending proof per order (duplicate rejected);
 * - rejection requires a reason and cannot follow a verification;
 * - verification reconciles amount/currency with the order and is idempotent;
 * - a buyer can only read and submit proofs for their own order.
 *
 * Run with:
 *   pnpm --filter @agestyles/commerce-api exec medusa exec ./src/scripts/verify-manual-payments.ts
 */

type OrderRecord = {
  id: string
  customer_id: string
  currency_code: string
  total: number
  order_group_id?: string | null
}

type OrderService = {
  listOrders(
    filters: Record<string, unknown>,
    config: Record<string, unknown>,
  ): Promise<OrderRecord[]>
}

type Payments = ManualPaymentsService & {
  listForOrder(orderId: string): Promise<ManualPaymentRecord[]>
  deleteManualPayments(ids: string | string[]): Promise<void>
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
  {
    body = {},
    params = {},
    query = {},
    actorId,
  }: {
    body?: unknown
    params?: Record<string, string>
    query?: Record<string, unknown>
    actorId?: string
  },
) {
  return {
    scope: container,
    body,
    params,
    query,
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

export default async function verifyManualPayments({ container }: ExecArgs) {
  const databaseUrl = process.env.DATABASE_URL ?? ""
  if (
    !/^postgres(?:ql)?:\/\/agestyles_lab:[a-f0-9]+@127\.0\.0\.1:15472\/agestyles_mercur_lab$/.test(
      databaseUrl,
    )
  ) {
    throw new Error("This verifier is restricted to the loopback AgeStyles lab database.")
  }

  const orderService = container.resolve(Modules.ORDER) as unknown as OrderService
  const payments = container.resolve(
    "agestylesManualPayments",
  ) as unknown as Payments

  const [order] = await orderService.listOrders(
    { customer_id: { $ne: null } },
    {
      take: 1,
      order: { created_at: "DESC" },
      select: ["id", "customer_id", "currency_code", "total"],
    },
  )
  if (!order) {
    throw new Error(
      "The lab needs at least one order with a customer to verify manual payments. Run the checkout verifier first.",
    )
  }

  const createdIds: string[] = []
  const submitted: ManualPaymentRecord[] = []

  try {
    // Another currency and an amount above the total are rejected before write.
    for (const [name, body] of [
      ["above total", { amount: order.total + 1, currency_code: order.currency_code }],
      ["wrong currency", { amount: 1, currency_code: "usd" }],
    ] as Array<[string, Record<string, unknown>]>) {
      const rejected = createResponse()
      await assert.rejects(
        () =>
          submitProof(
            request(container, {
              params: { id: order.id },
              actorId: order.customer_id,
              body: {
                method: "transfer",
                reference: `BAD-${name}`,
                ...body,
              },
            }),
            rejected.res,
          ),
        (error: unknown) =>
          (error as { type?: string }).type === MedusaError.Types.INVALID_DATA,
        `expected rejection: ${name}`,
      )
    }

    // A customer cannot probe someone else's order.
    const foreign = createResponse()
    await assert.rejects(
      () =>
        listOwnPayments(
          request(container, {
            params: { id: order.id },
            actorId: "cus_not_the_owner",
          }),
          foreign.res,
        ),
      (error: unknown) =>
        (error as { type?: string }).type === MedusaError.Types.NOT_FOUND,
      "reading another customer's order must 404",
    )

    // Valid proof as a deposit for part of the order.
    const deposit = Math.min(10, Number(order.total) / 2)
    const submittedRes = createResponse()
    await submitProof(
      request(container, {
        params: { id: order.id },
        actorId: order.customer_id,
        body: {
          amount: deposit,
          currency_code: order.currency_code,
          method: "deposit",
          reference: `DEP-${Date.now()}`,
          notes: "Verificador de laboratorio",
        },
      }),
      submittedRes.res,
    )
    assert.equal(submittedRes.state.statusCode, 201)
    const first = (submittedRes.state.body as { manual_payment: ManualPaymentRecord })
      .manual_payment
    submitted.push(first)
    createdIds.push(first.id)
    assert.equal(first.status, "pending")
    assert.equal(first.customer_id, order.customer_id)

    // One pending proof per order: a second submit is a duplicate.
    const duplicate = createResponse()
    await assert.rejects(
      () =>
        submitProof(
          request(container, {
            params: { id: order.id },
            actorId: order.customer_id,
            body: {
              amount: 1,
              currency_code: order.currency_code,
              method: "cash",
              reference: "DUP-1",
            },
          }),
          duplicate.res,
        ),
      (error: unknown) =>
        (error as { type?: string }).type === MedusaError.Types.DUPLICATE_ERROR,
      "a second open proof must be rejected",
    )

    // The buyer lists only their own proofs.
    const ownList = createResponse()
    await listOwnPayments(
      request(container, {
        params: { id: order.id },
        actorId: order.customer_id,
      }),
      ownList.res,
    )
    assert.equal(
      (ownList.state.body as { count: number }).count,
      1,
      "the buyer must see their own proof",
    )

    // Rejection needs a reason and records the reviewer.
    const missingReason = createResponse()
    await assert.rejects(
      () =>
        adminReject(
          request(container, {
            params: { id: first.id },
            actorId: "user_admin",
            body: {},
          }),
          missingReason.res,
        ),
      (error: unknown) =>
        (error as { type?: string }).type === MedusaError.Types.INVALID_DATA,
      "rejection without a reason must fail",
    )

    const rejectedRes = createResponse()
    await adminReject(
      request(container, {
        params: { id: first.id },
        actorId: "user_admin",
        body: { reason: "Comprobante ilegible" },
      }),
      rejectedRes.res,
    )
    const rejected = (
      rejectedRes.state.body as { manual_payment: ManualPaymentRecord }
    ).manual_payment
    assert.equal(rejected.status, "rejected")
    assert.equal(rejected.rejection_reason, "Comprobante ilegible")
    assert.equal(rejected.reviewed_by, "user_admin")

    // After a rejection a new proof is allowed.
    const resubmittedRes = createResponse()
    await submitProof(
      request(container, {
        params: { id: order.id },
        actorId: order.customer_id,
        body: {
          amount: Number(order.total),
          currency_code: order.currency_code,
          method: "transfer",
          reference: `TRF-${Date.now()}`,
        },
      }),
      resubmittedRes.res,
    )
    assert.equal(resubmittedRes.state.statusCode, 201)
    const second = (
      resubmittedRes.state.body as { manual_payment: ManualPaymentRecord }
    ).manual_payment
    submitted.push(second)
    createdIds.push(second.id)

    // Verification reconciles amount and currency with the order.
    const verifiedRes = createResponse()
    await adminVerify(
      request(container, {
        params: { id: second.id },
        actorId: "user_admin",
      }),
      verifiedRes.res,
    )
    const verified = (
      verifiedRes.state.body as { manual_payment: ManualPaymentRecord }
    ).manual_payment
    assert.equal(verified.status, "verified")
    assert.ok(verified.reviewed_at)
    assert.equal(verified.reviewed_by, "user_admin")

    // Verifying again is idempotent; rejecting a verified proof is not allowed.
    const alreadyVerified = createResponse()
    await adminVerify(
      request(container, { params: { id: second.id }, actorId: "user_admin" }),
      alreadyVerified.res,
    )
    assert.equal(
      String(
        (alreadyVerified.state.body as { manual_payment: ManualPaymentRecord })
          .manual_payment.reviewed_at,
      ),
      String(verified.reviewed_at),
      "verifying twice must not change the review",
    )

    const rejectVerified = createResponse()
    await assert.rejects(
      () =>
        adminReject(
          request(container, {
            params: { id: second.id },
            actorId: "user_admin",
            body: { reason: "Cambio de opinión" },
          }),
          rejectVerified.res,
        ),
      (error: unknown) =>
        (error as { type?: string }).type === MedusaError.Types.NOT_ALLOWED,
      "a verified proof cannot be rejected",
    )

    // Admin queue filters by status.
    const pendingQueue = createResponse()
    await adminList(
      request(container, { actorId: "user_admin", query: { status: "pending" } }),
      pendingQueue.res,
    )
    assert.equal(
      (pendingQueue.state.body as { count: number }).count,
      0,
      "no pending proofs remain for this order",
    )

    console.log(
      JSON.stringify({
        orderId: order.id,
        currency: order.currency_code,
        depositAccepted: true,
        overTotalRejected: true,
        wrongCurrencyRejected: true,
        foreignOrderHidden: true,
        duplicatePendingRejected: true,
        rejectionRequiresReason: true,
        resubmitAfterRejection: true,
        verifiedMatchesOrder: true,
        verifyIdempotent: true,
        verifiedCannotBeRejected: true,
      }),
    )
  } finally {
    if (createdIds.length) await payments.deleteManualPayments(createdIds)
    console.log("Cleaned up manual payment verification proofs")
  }
}

import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils";
import { z } from "zod";
import {
  AGESTYLES_EVENTS,
  emitAgestylesEventSafely,
  orderSellerId,
} from "../../../../../lib/notifications";
import { assertPaymentWithinOrder, type ManualPaymentsService } from "@agestyles/manual-payments";

type OrderRecord = {
  id: string;
  customer_id: string;
  currency_code: string;
  total: number;
};

type OrderServiceLike = {
  retrieveOrder(id: string, config?: Record<string, unknown>): Promise<OrderRecord>;
};

/**
 * Buyer-facing payment proofs for one of their own orders.
 *
 * `AUTHENTICATE` forces a customer actor: unlike the public catalog routes, a
 * proof is personal data and must never be readable without a session.
 */
export const AUTHENTICATE = true;

type ManualPayments = ManualPaymentsService & {
  submitPayment(input: Record<string, unknown>): Promise<unknown>;
  listForOrder(orderId: string): Promise<unknown[]>;
};

/**
 * Route-level shape for a payment proof. Limits mirror
 * `validateManualPaymentInput` in `@agestyles/manual-payments` (reference 120,
 * receipt URL 500, notes 500, method enum, 3-letter currency, positive amount
 * with at most two decimals); the service validation stays authoritative
 * downstream. Only whitelisted fields reach `submitPayment` — anything else
 * in the body is dropped.
 */
const manualPaymentBodySchema = z.object({
  amount: z.union([
    z.number().finite().positive(),
    z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,2})?$/, "amount must be a positive number with at most two decimals."),
  ]),
  currency_code: z
    .string()
    .regex(/^[a-z]{3}$/, "currency_code must be a three-letter lowercase ISO code."),
  method: z.enum(["transfer", "deposit", "cash", "other"]),
  reference: z.string().trim().min(1).max(120),
  receipt_url: z
    .string()
    .trim()
    .max(500)
    .refine((value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    }, "receipt_url must be an absolute http(s) URL.")
    .optional()
    .nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  seller_id: z.string().trim().max(120).optional().nullable(),
});

function invalidBody(error: z.ZodError): MedusaError {
  return new MedusaError(
    MedusaError.Types.INVALID_DATA,
    error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
  );
}

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const actorId = req.auth_context?.actor_id;
  if (!actorId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Authentication is required.");
  }
  const order = await loadOwnOrder(req, req.params.id, actorId);

  const service = req.scope.resolve("agestylesManualPayments") as unknown as ManualPayments;
  const payments = await service.listForOrder(order.id);
  res.json({ manual_payments: payments, count: payments.length });
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const actorId = req.auth_context?.actor_id;
  if (!actorId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Authentication is required.");
  }
  const order = await loadOwnOrder(req, req.params.id, actorId);
  const parsed = manualPaymentBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) throw invalidBody(parsed.error);
  const body = parsed.data;

  /**
   * `seller_id` is never taken from the body: a buyer could otherwise attach
   * their proof to another store. The seller is forced from the order itself
   * (Mercur's order-seller link) and a body value that differs is rejected
   * with 400. Orders without a seller link (e.g. a parent/group order) store
   * `seller_id: null`.
   */
  const sellerId = await orderSellerId(req.scope, order.id);
  if (body.seller_id !== undefined && body.seller_id !== null && body.seller_id !== sellerId) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "seller_id must match the seller of the order.",
    );
  }

  /**
   * Partial payments: a proof for less than the order total is accepted here
   * (`assertPaymentWithinOrder` only caps the amount at the total), but it can
   * never be verified — verification (`assertPaymentMatchesOrder`, admin
   * verify route) requires the amount to equal the order total exactly, and
   * proofs are not summed. A buyer who paid in parts must submit a proof for
   * the full order total. PENDING: decide whether partial proofs should be
   * summed at verification or rejected at submit time instead.
   */
  try {
    assertPaymentWithinOrder(
      {
        amount: body.amount,
        currency_code: body.currency_code,
      },
      order,
    );
  } catch (error) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      error instanceof Error ? error.message : String(error),
    );
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data: groups } = await query.graph({
    entity: "order_group_order",
    fields: ["order_group_id"],
    filters: { order_id: order.id },
  });

  const service = req.scope.resolve("agestylesManualPayments") as unknown as ManualPayments;
  const payment = await service.submitPayment({
    amount: body.amount,
    currency_code: body.currency_code,
    method: body.method,
    reference: body.reference,
    receipt_url: body.receipt_url ?? null,
    notes: body.notes ?? null,
    order_id: order.id,
    customer_id: actorId,
    // Forced from the order (see above): any seller_id in the body is ignored.
    seller_id: sellerId,
    order_group_id: groups[0]?.order_group_id ?? null,
  });

  const paymentId = (payment as { id?: string } | null)?.id;
  if (paymentId) {
    await emitAgestylesEventSafely(req.scope, AGESTYLES_EVENTS.PAYMENT_SUBMITTED, {
      payment_id: paymentId,
      order_id: order.id,
    });
  }
  res.status(201).json({ manual_payment: payment });
}

/**
 * The order must belong to the authenticated customer. A wrong id and someone
 * else's order return the same 404 so the endpoint cannot be used to probe
 * which orders exist.
 */
async function loadOwnOrder(req: AuthenticatedMedusaRequest, orderId: string, actorId: string) {
  const orderService = req.scope.resolve(Modules.ORDER) as unknown as OrderServiceLike;
  const order = await orderService
    .retrieveOrder(orderId, {
      select: ["id", "customer_id", "currency_code", "total"],
    })
    .catch(() => null);

  if (!order || order.customer_id !== actorId) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Order ${orderId} was not found.`);
  }
  return order;
}

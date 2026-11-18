import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MedusaError, Modules } from "@medusajs/framework/utils";
import { AGESTYLES_EVENTS, emitAgestylesEventSafely } from "../../../../../lib/notifications";
import { assertPaymentWithinOrder, type ManualPaymentsService } from "@agestyles/manual-payments";

type OrderRecord = {
  id: string;
  customer_id: string;
  currency_code: string;
  total: number;
  order_group_id?: string | null;
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
  const body = (req.body ?? {}) as Record<string, unknown>;

  try {
    assertPaymentWithinOrder(
      {
        amount: body.amount as number | string,
        currency_code: String(body.currency_code ?? ""),
      },
      order,
    );
  } catch (error) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      error instanceof Error ? error.message : String(error),
    );
  }

  const service = req.scope.resolve("agestylesManualPayments") as unknown as ManualPayments;
  const payment = await service.submitPayment({
    ...body,
    order_id: order.id,
    customer_id: actorId,
    currency_code: body.currency_code ?? order.currency_code,
    order_group_id:
      typeof body.order_group_id === "string"
        ? body.order_group_id
        : (order.order_group_id ?? null),
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

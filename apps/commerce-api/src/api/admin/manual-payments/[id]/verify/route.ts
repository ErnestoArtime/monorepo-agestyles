import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MedusaError, Modules } from "@medusajs/framework/utils";
import { AGESTYLES_EVENTS, emitAgestylesEventSafely } from "../../../../../lib/notifications";
import {
  assertPaymentMatchesOrder,
  type ManualPaymentsService,
  type ManualPaymentRecord,
} from "@agestyles/manual-payments";

type ManualPayments = ManualPaymentsService & {
  retrievePayment(id: string): Promise<ManualPaymentRecord>;
  verifyPayment(id: string, reviewedBy: string): Promise<ManualPaymentRecord>;
};

type OrderServiceLike = {
  retrieveOrder(
    id: string,
    config?: Record<string, unknown>,
  ): Promise<{ id: string; total: number; currency_code: string }>;
};

/**
 * Verifying is the moment the money is reconciled: the proof amount and
 * currency must match the order, otherwise the administrator would confirm a
 * payment that does not exist. The check is repeated here, not only at submit
 * time, because the order could have changed between both moments.
 *
 * Partial payments: a proof for less than the order total is accepted at
 * submit time (`assertPaymentWithinOrder` only caps the amount at the total),
 * but it can never be verified — `assertPaymentMatchesOrder` below requires
 * the amount to equal the order total exactly, and proofs are not summed.
 * A buyer who paid in parts must submit a proof for the full order total.
 * PENDING: decide whether partial proofs should be summed at verification
 * or rejected at submit time instead.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve("agestylesManualPayments") as unknown as ManualPayments;
  const payment = await service.retrievePayment(req.params.id);

  const orderService = req.scope.resolve(Modules.ORDER) as unknown as OrderServiceLike;
  const order = await orderService
    .retrieveOrder(payment.order_id, {
      select: ["id", "total", "currency_code"],
    })
    .catch(() => null);
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Order ${payment.order_id} was not found.`);
  }

  try {
    assertPaymentMatchesOrder(payment, order);
  } catch (error) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      error instanceof Error ? error.message : String(error),
    );
  }

  const verified = await service.verifyPayment(payment.id, req.auth_context.actor_id);
  await emitAgestylesEventSafely(req.scope, AGESTYLES_EVENTS.PAYMENT_VERIFIED, {
    payment_id: payment.id,
    order_id: payment.order_id,
  });
  res.json({ manual_payment: verified });
}

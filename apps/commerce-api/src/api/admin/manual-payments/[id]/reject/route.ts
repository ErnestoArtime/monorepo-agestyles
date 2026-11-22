import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { z } from "zod";
import { AGESTYLES_EVENTS, emitAgestylesEventSafely } from "../../../../../lib/notifications";
import type { ManualPaymentsService, ManualPaymentRecord } from "@agestyles/manual-payments";

type ManualPayments = ManualPaymentsService & {
  rejectPayment(id: string, reason: string, reviewedBy: string): Promise<ManualPaymentRecord>;
};

/**
 * Route-level shape for a rejection. The 3–240 character range mirrors
 * `validateRejectionReason` in `@agestyles/manual-payments`; the service
 * validation stays authoritative downstream.
 */
const rejectBodySchema = z.object({
  reason: z.string().trim().min(3).max(240),
});

/** Rejecting requires a reason: the buyer must know why the proof failed. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parsed = rejectBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
    );
  }
  const body = parsed.data;

  const service = req.scope.resolve("agestylesManualPayments") as unknown as ManualPayments;
  const rejected = await service.rejectPayment(
    req.params.id,
    body.reason,
    req.auth_context.actor_id,
  );
  await emitAgestylesEventSafely(req.scope, AGESTYLES_EVENTS.PAYMENT_REJECTED, {
    payment_id: rejected.id,
    order_id: rejected.order_id,
  });
  res.json({ manual_payment: rejected });
}

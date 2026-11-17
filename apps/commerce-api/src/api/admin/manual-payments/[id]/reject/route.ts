import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import type {
  ManualPaymentsService,
  ManualPaymentRecord,
} from "@agestyles/manual-payments"

type ManualPayments = ManualPaymentsService & {
  rejectPayment(
    id: string,
    reason: string,
    reviewedBy: string,
  ): Promise<ManualPaymentRecord>
}

/** Rejecting requires a reason: the buyer must know why the proof failed. */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
  const body = (req.body ?? {}) as Record<string, unknown>
  if (typeof body.reason !== "string") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "A rejection reason is required.",
    )
  }

  const service = req.scope.resolve(
    "agestylesManualPayments",
  ) as unknown as ManualPayments
  const rejected = await service.rejectPayment(
    req.params.id,
    body.reason,
    req.auth_context.actor_id,
  )
  res.json({ manual_payment: rejected })
}

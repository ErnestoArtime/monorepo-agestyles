import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import type { ManualPaymentsService } from "@agestyles/manual-payments" with {
  "resolution-mode": "import"
}

type ManualPayments = ManualPaymentsService & {
  listByStatus(status?: "pending" | "verified" | "rejected"): Promise<unknown[]>
}

const STATUSES = ["pending", "verified", "rejected"] as const

/**
 * Manual proof queue for administrators. `/admin/*` already requires an
 * authenticated user, so no extra middleware is registered here.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
  const raw = (req.query ?? {}).status
  let status: (typeof STATUSES)[number] | undefined
  if (raw !== undefined) {
    if (typeof raw !== "string" || !STATUSES.includes(raw as never)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "status must be pending, verified or rejected.",
      )
    }
    status = raw as (typeof STATUSES)[number]
  }

  const service = req.scope.resolve(
    "agestylesManualPayments",
  ) as unknown as ManualPayments
  const payments = await service.listByStatus(status)
  res.json({ manual_payments: payments, count: payments.length })
}

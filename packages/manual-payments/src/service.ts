import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import ManualPayment from "./models/manual-payment"
import {
  ManualPaymentValidationError,
  validateManualPaymentInput,
  validateRejectionReason,
  type ManualPaymentInput,
  type ManualPaymentMethod,
} from "./validation"

export type ManualPaymentStatus = "pending" | "verified" | "rejected"

export type ManualPaymentRecord = {
  id: string
  order_id: string
  order_group_id: string | null
  customer_id: string
  seller_id: string | null
  amount: number
  currency_code: string
  method: ManualPaymentMethod
  reference: string
  receipt_url: string | null
  notes: string | null
  status: ManualPaymentStatus
  reviewed_by: string | null
  reviewed_at: Date | string | null
  rejection_reason: string | null
  created_at: Date | string
  updated_at: Date | string
}

function invalid(message: string): never {
  throw new MedusaError(MedusaError.Types.INVALID_DATA, message)
}

function notFound(message: string): never {
  throw new MedusaError(MedusaError.Types.NOT_FOUND, message)
}

function notAllowed(message: string): never {
  throw new MedusaError(MedusaError.Types.NOT_ALLOWED, message)
}

/**
 * Manual payment proofs.
 *
 * The order total and currency remain Medusa's. This service only stores what
 * the buyer claims to have paid and the administrator's decision, so a retry
 * or a double click can never create two open proofs for the same order.
 */
class ManualPaymentsService extends MedusaService({ ManualPayment }) {
  async submitPayment(raw: unknown): Promise<ManualPaymentRecord> {
    const input = this.runValidation(() => validateManualPaymentInput(raw))

    const pending = await this.listManualPayments({
      order_id: input.order_id,
      seller_id: input.seller_id,
      status: "pending",
    })
    if (pending.length) {
      throw new MedusaError(
        MedusaError.Types.DUPLICATE_ERROR,
        `Order ${input.order_id} already has a pending payment proof.`,
      )
    }

    const created = await this.createManualPayments(
      input as unknown as Record<string, unknown>,
    )
    return created as unknown as ManualPaymentRecord
  }

  /** Idempotent: verifying a verified proof returns it unchanged. */
  async verifyPayment(
    paymentId: string,
    reviewedBy: string,
    reviewedAt: Date = new Date(),
  ): Promise<ManualPaymentRecord> {
    const payment = await this.retrievePayment(paymentId)
    if (payment.status === "verified") return payment
    if (payment.status === "rejected") {
      notAllowed(`Payment proof ${paymentId} was rejected and cannot be verified.`)
    }
    const reviewer = this.runValidation(() => {
      if (typeof reviewedBy !== "string" || !reviewedBy.trim()) {
        throw new ManualPaymentValidationError("reviewedBy is required.")
      }
      return reviewedBy.trim()
    })

    const updated = await this.updateManualPayments({
      id: paymentId,
      status: "verified",
      reviewed_by: reviewer,
      reviewed_at: reviewedAt,
      rejection_reason: null,
    })
    return updated as unknown as ManualPaymentRecord
  }

  /** Idempotent: rejecting a rejected proof returns it unchanged. */
  async rejectPayment(
    paymentId: string,
    reason: string,
    reviewedBy: string,
    reviewedAt: Date = new Date(),
  ): Promise<ManualPaymentRecord> {
    const payment = await this.retrievePayment(paymentId)
    if (payment.status === "rejected") return payment
    if (payment.status === "verified") {
      notAllowed(`Payment proof ${paymentId} was verified and cannot be rejected.`)
    }
    const normalized = this.runValidation(() => ({
      reason: validateRejectionReason(reason),
      reviewer:
        typeof reviewedBy === "string" && reviewedBy.trim()
          ? reviewedBy.trim()
          : (() => {
              throw new ManualPaymentValidationError("reviewedBy is required.")
            })(),
    }))

    const updated = await this.updateManualPayments({
      id: paymentId,
      status: "rejected",
      reviewed_by: normalized.reviewer,
      reviewed_at: reviewedAt,
      rejection_reason: normalized.reason,
    })
    return updated as unknown as ManualPaymentRecord
  }

  async retrievePayment(paymentId: string): Promise<ManualPaymentRecord> {
    const payment = await this.retrieveManualPayment(paymentId).catch(() => null)
    if (!payment) notFound(`Payment proof ${paymentId} was not found.`)
    return payment as unknown as ManualPaymentRecord
  }

  async listForOrder(orderId: string): Promise<ManualPaymentRecord[]> {
    const payments = await this.listManualPayments(
      { order_id: orderId },
      { order: { created_at: "DESC" } },
    )
    return payments as unknown as ManualPaymentRecord[]
  }

  async listByStatus(
    status?: ManualPaymentStatus,
  ): Promise<ManualPaymentRecord[]> {
    const payments = await this.listManualPayments(
      status ? { status } : {},
      { order: { created_at: "ASC" } },
    )
    return payments as unknown as ManualPaymentRecord[]
  }

  private runValidation<T>(fn: () => T): T {
    try {
      return fn()
    } catch (error) {
      if (error instanceof ManualPaymentValidationError) {
        invalid(error.message)
      }
      throw error
    }
  }
}

export type { ManualPaymentInput }
export default ManualPaymentsService

import { Module } from "@medusajs/framework/utils"
import ManualPaymentsService from "./service"

export const AGESTYLES_MANUAL_PAYMENTS_MODULE = "agestylesManualPayments"

export { ManualPaymentsService }
export {
  assertPaymentMatchesOrder,
  assertPaymentWithinOrder,
  MANUAL_PAYMENT_METHODS,
  ManualPaymentValidationError,
  validateAmount,
  validateCurrency,
  validateManualPaymentInput,
  validatePaymentMethod,
  validateRejectionReason,
} from "./validation"
export type {
  ManualPaymentInput,
  ManualPaymentMethod,
} from "./validation"
export type {
  ManualPaymentRecord,
  ManualPaymentStatus,
} from "./service"

export default Module(AGESTYLES_MANUAL_PAYMENTS_MODULE, {
  service: ManualPaymentsService,
})

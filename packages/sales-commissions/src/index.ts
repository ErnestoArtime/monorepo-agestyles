import { Module } from "@medusajs/framework/utils";
import SalesCommissionsService from "./service";

export const AGESTYLES_SALES_COMMISSIONS_MODULE = "agestylesSalesCommissions";

export { SalesCommissionsService };
export {
  CommissionValidationError,
  commissionForLine,
  ENTRY_KINDS,
  ledgerBalance,
  normalizeAgentCode,
  parseRuleInput,
  PAYMENT_METHODS,
  resolveRule,
  roundMoney,
  RULE_KINDS,
  unitsToNextThreshold,
  validateWithdrawal,
} from "./rules";
export type {
  CommissionLine,
  CommissionRule,
  CommissionRuleInput,
  EntryKind,
  LineCommission,
  PaymentMethod,
  RuleKind,
} from "./rules";

export default Module(AGESTYLES_SALES_COMMISSIONS_MODULE, {
  service: SalesCommissionsService,
});

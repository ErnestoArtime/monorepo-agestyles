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
  parseAgentSaleInput,
  parseRuleInput,
  PAYMENT_METHODS,
  resolveRule,
  roundMoney,
  RULE_KINDS,
  unitsToNextThreshold,
  validateWithdrawal,
} from "./rules";
export {
  buildSalesReport,
  MAX_REPORT_DAYS,
  parseSalesFilters,
  salesServiceFilters,
  salesToCsv,
} from "./reports";
export type { SaleRecord, SalesFilters, SalesReport } from "./reports";
export type {
  AgentSaleInput,
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

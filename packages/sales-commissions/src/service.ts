import { MedusaService } from "@medusajs/framework/utils";
import { AgentSale, CommissionEntry, CommissionRule, SalesAgent, Withdrawal } from "./models";

class SalesCommissionsService extends MedusaService({
  SalesAgent,
  CommissionRule,
  AgentSale,
  CommissionEntry,
  CommissionWithdrawal: Withdrawal,
}) {}

export default SalesCommissionsService;

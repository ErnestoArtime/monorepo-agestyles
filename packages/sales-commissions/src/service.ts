import { MedusaService } from "@medusajs/framework/utils";
import AgentSale from "./models/agent-sale";
import CommissionEntry from "./models/commission-entry";
import CommissionRule from "./models/commission-rule";
import Withdrawal from "./models/commission-withdrawal";
import SalesAgent from "./models/sales-agent";

class SalesCommissionsService extends MedusaService({
  SalesAgent,
  CommissionRule,
  AgentSale,
  CommissionEntry,
  CommissionWithdrawal: Withdrawal,
}) {}

export default SalesCommissionsService;

import { model } from "@medusajs/framework/utils";

const CommissionEntry = model
  .define("agestyles_commission_entry", {
    id: model.id({ prefix: "centry" }).primaryKey(),
    seller_id: model.text(),
    agent_id: model.text(),
    kind: model.enum(["earned", "reversed", "withdrawn"]),
    amount: model.bigNumber(),
    currency_code: model.text(),
    sale_id: model.text().nullable(),
    withdrawal_id: model.text().nullable(),
    product_id: model.text().nullable(),
    units: model.number().nullable(),
  })
  .indexes([
    {
      name: "IDX_agestyles_commission_entry_agent",
      on: ["agent_id", "created_at"],
      where: "deleted_at IS NULL",
    },
  ]);

export default CommissionEntry;

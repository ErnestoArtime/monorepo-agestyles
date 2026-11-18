import { model } from "@medusajs/framework/utils";

const CommissionRule = model
  .define("agestyles_commission_rule", {
    id: model.id({ prefix: "crule" }).primaryKey(),
    seller_id: model.text(),
    product_id: model.text().nullable(),
    kind: model.enum(["percent", "fixed"]),
    value: model.bigNumber(),
    unit_threshold: model.number().nullable(),
  })
  .indexes([
    {
      name: "IDX_agestyles_commission_rule_seller",
      on: ["seller_id"],
      where: "deleted_at IS NULL",
    },
  ]);

export default CommissionRule;

import { model } from "@medusajs/framework/utils";

const SalesAgent = model
  .define("agestyles_sales_agent", {
    id: model.id({ prefix: "sagent" }).primaryKey(),
    seller_id: model.text(),
    member_id: model.text(),
    member_email: model.text().nullable(),
    code: model.text(),
    active: model.boolean().default(true),
  })
  .indexes([
    {
      name: "IDX_agestyles_sales_agent_code",
      on: ["code"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agestyles_sales_agent_seller_member",
      on: ["seller_id", "member_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ]);

export default SalesAgent;

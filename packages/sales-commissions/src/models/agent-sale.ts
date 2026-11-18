import { model } from "@medusajs/framework/utils";

const AgentSale = model
  .define("agestyles_agent_sale", {
    id: model.id({ prefix: "asale" }).primaryKey(),
    seller_id: model.text(),
    agent_id: model.text(),
    source: model.enum(["manual", "online"]),
    order_id: model.text().nullable(),
    payment_method: model.enum(["cash", "transfer", "online"]),
    status: model.enum(["pending", "paid", "reversed"]),
    currency_code: model.text(),
    total: model.bigNumber(),
    lines: model.json(),
    note: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_agestyles_agent_sale_seller_created",
      on: ["seller_id", "created_at"],
      where: "deleted_at IS NULL",
    },
    { name: "IDX_agestyles_agent_sale_agent", on: ["agent_id"], where: "deleted_at IS NULL" },
  ]);

export default AgentSale;

import { model } from "@medusajs/framework/utils";

/** A store member flagged as sales agent. Mercur roles are a fixed enum, so this is an AgeStyles flag. */
export const SalesAgent = model
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

/** Store-wide (product_id null) or per-product commission rule. */
export const CommissionRule = model
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

/** A sale attributed to an agent: registered by the agent or placed online with the agent's code. */
export const AgentSale = model
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

/** Append-only ledger of an agent's balance. */
export const CommissionEntry = model
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

/** Cash withdrawal requested by the agent and confirmed by the store. */
export const Withdrawal = model
  .define("agestyles_commission_withdrawal", {
    id: model.id({ prefix: "cwdraw" }).primaryKey(),
    seller_id: model.text(),
    agent_id: model.text(),
    amount: model.bigNumber(),
    currency_code: model.text(),
    status: model.enum(["requested", "paid", "rejected"]),
    confirmed_by: model.text().nullable(),
    confirmed_at: model.dateTime().nullable(),
    note: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_agestyles_commission_withdrawal_seller",
      on: ["seller_id", "status"],
      where: "deleted_at IS NULL",
    },
  ]);

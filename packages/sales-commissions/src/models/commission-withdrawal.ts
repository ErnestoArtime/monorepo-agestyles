import { model } from "@medusajs/framework/utils";

const Withdrawal = model
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

export default Withdrawal;

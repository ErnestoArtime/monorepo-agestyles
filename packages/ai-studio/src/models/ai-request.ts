import { model } from "@medusajs/framework/utils";

/**
 * One AI Studio call, kept for audit and the monthly quota. Failed calls count too,
 * because a provider may charge for them. Images are never stored here.
 */
const AiRequest = model
  .define("agestyles_ai_request", {
    id: model.id({ prefix: "aireq" }).primaryKey(),
    seller_id: model.text(),
    member_id: model.text(),
    kind: model.enum(["describe", "remove_background"]),
    // `pending` is the quota reservation taken before calling a provider.
    status: model.enum(["pending", "ok", "failed"]),
    provider: model.text().nullable(),
    model: model.text().nullable(),
    error: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_agestyles_ai_request_seller_created",
      on: ["seller_id", "created_at"],
      where: "deleted_at IS NULL",
    },
  ]);

export default AiRequest;

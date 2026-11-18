import type { MedusaResponse } from "@medusajs/framework/http";
import {
  backgroundRemoverUrl,
  monthlyLimit,
  resolveAiActor,
  textProviders,
  usedThisMonth,
  type AiStudioRequest,
} from "../../../../lib/ai-studio";

/** What AI Studio can do for this member and store right now. Never exposes keys. */
export async function GET(req: AiStudioRequest, res: MedusaResponse) {
  const actor = await resolveAiActor(req);
  const providers = textProviders();
  res.json({
    allowed: actor.allowed,
    describe: providers.length > 0,
    remove_background: !!backgroundRemoverUrl() && !!process.env.AGESTYLES_MEDIA_DIR,
    providers: providers.map((provider) => provider.name),
    used: await usedThisMonth(req, actor.sellerId),
    limit: monthlyLimit(),
  });
}

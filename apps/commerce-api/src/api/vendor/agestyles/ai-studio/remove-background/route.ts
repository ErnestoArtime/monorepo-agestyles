import type { MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { z } from "zod";
import {
  backgroundRemoverUrl,
  finishAiRequest,
  readOwnMedia,
  requireAiAccess,
  reserveAiRequest,
  saveDerivedImage,
  type AiStudioRequest,
} from "../../../../../lib/ai-studio";

/**
 * Route-level shape for background removal. `readOwnMedia` still checks that
 * the URL is one of our own uploads; this schema only rejects a missing,
 * mistyped or absurdly long `image_url` with 400 before quota is reserved.
 */
const removeBackgroundBodySchema = z.object({
  image_url: z.string().trim().min(1).max(2048),
});

function invalidBody(error: z.ZodError): MedusaError {
  return new MedusaError(
    MedusaError.Types.INVALID_DATA,
    error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
  );
}

/**
 * Removes the background of an uploaded photo with the self-hosted service and stores the
 * result as a new public file. The original stays untouched; the seller compares both and
 * decides which one to use.
 */
export async function POST(req: AiStudioRequest, res: MedusaResponse) {
  const actor = await requireAiAccess(req);
  const parsed = removeBackgroundBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) throw invalidBody(parsed.error);
  const imageUrl = parsed.data.image_url;
  const service = backgroundRemoverUrl();
  if (!service) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Background removal is not configured.");
  }
  const photo = await readOwnMedia(req, imageUrl);
  const requestId = await reserveAiRequest(req, actor, "remove_background");
  try {
    const response = await fetch(`${service.replace(/\/+$/, "")}/remove`, {
      method: "POST",
      headers: { "content-type": photo.mimeType },
      body: new Uint8Array(photo.bytes),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error(`remover_http_${response.status}`);
    const png = Buffer.from(await response.arrayBuffer());
    const file = await saveDerivedImage(req, png);
    await finishAiRequest(req, requestId, { status: "ok", provider: "local" });
    res.json({ original_url: imageUrl, url: file.url });
  } catch (error) {
    await finishAiRequest(req, requestId, {
      status: "failed",
      provider: "local",
      error: (error as Error).message,
    });
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "The background could not be removed from this photo.",
    );
  }
}

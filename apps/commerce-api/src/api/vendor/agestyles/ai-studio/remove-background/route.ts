import type { MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import {
  backgroundRemoverUrl,
  logAiRequest,
  readOwnMedia,
  requireAiAccess,
  saveDerivedImage,
  type AiStudioRequest,
} from "../../../../../lib/ai-studio";

/**
 * Removes the background of an uploaded photo with the self-hosted service and stores the
 * result as a new public file. The original stays untouched; the seller compares both and
 * decides which one to use.
 */
export async function POST(req: AiStudioRequest, res: MedusaResponse) {
  const actor = await requireAiAccess(req);
  const service = backgroundRemoverUrl();
  if (!service) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Background removal is not configured.");
  }
  const photo = await readOwnMedia((req.body as { image_url?: string } | undefined)?.image_url);
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
    await logAiRequest(req, {
      ...actor,
      kind: "remove_background",
      status: "ok",
      provider: "local",
    });
    res.json({ original_url: (req.body as { image_url: string }).image_url, url: file.url });
  } catch (error) {
    await logAiRequest(req, {
      ...actor,
      kind: "remove_background",
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

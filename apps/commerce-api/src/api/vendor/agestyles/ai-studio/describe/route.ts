import type { MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { describeProduct, type CopyTone } from "@agestyles/ai-studio";
import {
  finishAiRequest,
  readOwnMedia,
  requireAiAccess,
  reserveAiRequest,
  textProviders,
  toMedusaError,
  type AiStudioRequest,
} from "../../../../../lib/ai-studio";

type Body = {
  title?: string;
  brand?: string;
  category?: string;
  notes?: string;
  tone?: CopyTone;
  image_url?: string;
};

/** Title and description draft from the sheet and, optionally, an uploaded photo. */
export async function POST(req: AiStudioRequest, res: MedusaResponse) {
  const actor = await requireAiAccess(req);
  const body = (req.body ?? {}) as Body;
  const providers = textProviders();
  if (!providers.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "AI Studio text provider is not configured.",
    );
  }
  const photo = body.image_url ? await readOwnMedia(req, body.image_url) : null;
  const requestId = await reserveAiRequest(req, actor, "describe");
  try {
    const result = await describeProduct(
      {
        title: body.title ?? "",
        brand: body.brand,
        category: body.category,
        notes: body.notes,
        tone: body.tone,
        image: photo
          ? { mimeType: photo.mimeType, base64: photo.bytes.toString("base64") }
          : undefined,
      },
      providers,
      (url, init) => fetch(url, init),
    );
    await finishAiRequest(req, requestId, {
      status: "ok",
      provider: result.provider,
      model: result.model,
    });
    res.json({
      draft: { title: result.title, description: result.description },
      provider: result.provider,
      used_image: result.usedImage,
    });
  } catch (error) {
    await finishAiRequest(req, requestId, {
      status: "failed",
      error: (error as { attempts?: string[] }).attempts?.join(",") ?? (error as Error).message,
    });
    throw toMedusaError(error);
  }
}

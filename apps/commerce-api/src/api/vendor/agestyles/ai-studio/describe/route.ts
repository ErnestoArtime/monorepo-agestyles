import type { MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { z } from "zod";
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

/**
 * Route-level shape for AI Studio drafts. Limits mirror
 * `validateDescribeInput` in `@agestyles/ai-studio` (title 120, brand/category
 * 60, notes 600) so an oversized or mistyped body is rejected with 400 before
 * it reserves monthly quota or reaches a provider. The service validation
 * stays authoritative downstream.
 */
const describeBodySchema = z.object({
  title: z.string().trim().min(1).max(120),
  brand: z.string().trim().max(60).optional(),
  category: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(600).optional(),
  tone: z.enum(["commercial", "technical", "direct"]).optional(),
  image_url: z.string().trim().max(2048).optional(),
});

function invalidBody(error: z.ZodError): MedusaError {
  return new MedusaError(
    MedusaError.Types.INVALID_DATA,
    error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
  );
}

/** Title and description draft from the sheet and, optionally, an uploaded photo. */
export async function POST(req: AiStudioRequest, res: MedusaResponse) {
  const actor = await requireAiAccess(req);
  const parsed = describeBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) throw invalidBody(parsed.error);
  const body = parsed.data as {
    title: string;
    brand?: string;
    category?: string;
    notes?: string;
    tone?: CopyTone;
    image_url?: string;
  };
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
        title: body.title,
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

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { z } from "zod";
import {
  AGESTYLES_PRODUCT_EVENTS_MODULE,
  type ProductEventsService,
  type RecordedProductEvent,
} from "@agestyles/product-events";

/**
 * Anonymous product and store events (AG-59).
 *
 * Public on purpose: visitors are not logged in. The body is the only
 * thing the client can influence, and it is validated twice — here with
 * zod and again in the service — so no personal data, IP, user agent or
 * client timestamp can reach the table. The server time is the event time.
 */

const eventBodySchema = z
  .object({
    product_id: z.string().trim().min(1).max(120).nullable().optional(),
    seller_id: z.string().trim().min(1).max(120),
    type: z.enum(["product_view", "store_view", "product_click", "add_to_cart_click"]),
    surface: z.enum(["vitrina", "tienda-web", "tienda-app"]),
    session_id: z
      .string()
      .regex(/^[A-Za-z0-9_-]{8,64}$/, "session_id must be an anonymous id of 8-64 characters."),
  })
  .superRefine((body, ctx) => {
    if (body.type === "store_view" && body.product_id) {
      ctx.addIssue({
        code: "custom",
        path: ["product_id"],
        message: "store_view must not carry a product_id.",
      });
    }
    if (body.type !== "store_view" && !body.product_id) {
      ctx.addIssue({
        code: "custom",
        path: ["product_id"],
        message: "product_id is required for this event type.",
      });
    }
  });

/**
 * In-memory per-IP bucket: 60 events a minute. The same approach as the
 * rest of the API's limits today (see the security audit: Redis-backed
 * limits are still pending); enough to stop a script from flooding the
 * table, and a 429 never breaks the page — the clients ignore failures.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
const buckets = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: MedusaRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > MAX_PER_WINDOW;
}

function invalidBody(error: z.ZodError): MedusaError {
  return new MedusaError(
    MedusaError.Types.INVALID_DATA,
    error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
  );
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (rateLimited(clientIp(req))) {
    // Plain 429, not a MedusaError: the repo never uses a rate-limit error
    // type, and the clients ignore tracking failures anyway.
    res.setHeader("retry-after", "60");
    res.status(429).json({ message: "Demasiados eventos. Inténtalo más tarde." });
    return;
  }
  const parsed = eventBodySchema.safeParse(req.body);
  if (!parsed.success) throw invalidBody(parsed.error);
  const service = req.scope.resolve(
    AGESTYLES_PRODUCT_EVENTS_MODULE,
  ) as unknown as ProductEventsService;
  const recorded: RecordedProductEvent = await service.recordEvent({
    product_id: parsed.data.product_id ?? null,
    seller_id: parsed.data.seller_id,
    type: parsed.data.type,
    surface: parsed.data.surface,
    session_id: parsed.data.session_id,
  });
  res.status(recorded.deduped ? 200 : 201).json({
    event: {
      id: recorded.event.id,
      product_id: recorded.event.product_id,
      seller_id: recorded.event.seller_id,
      type: recorded.event.type,
      surface: recorded.event.surface,
      created_at: recorded.event.created_at,
    },
    deduped: recorded.deduped,
  });
}

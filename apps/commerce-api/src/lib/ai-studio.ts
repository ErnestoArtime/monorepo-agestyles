import { readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http";
import { MedusaError, Modules } from "@medusajs/framework/utils";
import {
  AGESTYLES_AI_STUDIO_MODULE,
  AiStudioError,
  monthStartUtc,
  providerChain,
  type AiStudioService,
} from "@agestyles/ai-studio";

export type AiStudioRequest = AuthenticatedMedusaRequest & {
  seller_context?: { seller_id?: string };
};

type SellerMembership = {
  member_id: string;
  seller_id: string;
  role_id: string | null;
  is_owner: boolean;
};
type SellerModule = {
  listSellerMembers(filters: { seller_id: string; member_id: string }): Promise<SellerMembership[]>;
};

const ADMINISTRATION_ROLE = "role_seller_administration";
const MEDIA_NAME = /^[0-9]+-[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\.(jpe?g|png|webp)$/;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export function aiStudioService(req: AiStudioRequest) {
  return req.scope.resolve<AiStudioService>(AGESTYLES_AI_STUDIO_MODULE);
}

/** The pilot keeps AI Studio for the store owner and store administration (decided 18 nov 2026). */
export async function resolveAiActor(req: AiStudioRequest) {
  const sellerId = req.seller_context?.seller_id;
  const memberId = req.auth_context?.actor_id;
  if (!sellerId || !memberId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "A selected seller is required.");
  }
  const seller = req.scope.resolve<SellerModule>("seller");
  const [membership] = await seller.listSellerMembers({ seller_id: sellerId, member_id: memberId });
  if (!membership || membership.seller_id !== sellerId || membership.member_id !== memberId) {
    throw new MedusaError(MedusaError.Types.FORBIDDEN, "You are not a member of this store.");
  }
  return {
    sellerId,
    memberId,
    allowed: membership.is_owner || membership.role_id === ADMINISTRATION_ROLE,
  };
}

export function monthlyLimit() {
  const value = Number(process.env.AGESTYLES_AI_MONTHLY_LIMIT ?? 100);
  return Number.isInteger(value) && value >= 0 ? value : 100;
}

export async function usedThisMonth(req: AiStudioRequest, sellerId: string) {
  const [, count] = await aiStudioService(req).listAndCountAiRequests(
    { seller_id: sellerId, created_at: { $gte: monthStartUtc() } },
    { take: 1 },
  );
  return count;
}

/** Owner/administration check plus the monthly quota (failed calls count too). */
export async function requireAiAccess(req: AiStudioRequest) {
  const actor = await resolveAiActor(req);
  if (!actor.allowed) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "AI Studio is available to the store owner and administration.",
    );
  }
  if ((await usedThisMonth(req, actor.sellerId)) >= monthlyLimit()) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Monthly AI Studio quota reached.");
  }
  return actor;
}

export function textProviders() {
  return providerChain(process.env);
}

export function backgroundRemoverUrl() {
  return process.env.AGESTYLES_BACKGROUND_REMOVER_URL?.trim() || "";
}

/**
 * Reads a photo the store already uploaded to our own media volume. Only URLs under
 * AGESTYLES_MEDIA_URL are accepted, so the API never fetches arbitrary addresses.
 */
export async function readOwnMedia(url: unknown): Promise<{ mimeType: string; bytes: Buffer }> {
  const base = process.env.AGESTYLES_MEDIA_URL?.replace(/\/+$/, "");
  const dir = process.env.AGESTYLES_MEDIA_DIR;
  if (!base || !dir) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Product media storage is not configured.",
    );
  }
  if (typeof url !== "string" || !url.startsWith(`${base}/`)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "The photo must be one uploaded to AgeStyles.",
    );
  }
  const name = url.slice(base.length + 1);
  if (!MEDIA_NAME.test(name) || basename(name) !== name) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Unsupported photo address.");
  }
  const path = join(dir, name);
  const info = await stat(path).catch(() => null);
  if (!info?.isFile() || info.size > MAX_IMAGE_BYTES) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Photo not found.");
  }
  const extension = name.split(".").pop()!.toLowerCase();
  const mimeType =
    extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
  return { mimeType, bytes: await readFile(path) };
}

export async function saveDerivedImage(req: AiStudioRequest, png: Buffer) {
  const files = req.scope.resolve(Modules.FILE) as unknown as {
    createFiles(data: {
      filename: string;
      mimeType: string;
      content: string;
      access: "public";
    }): Promise<{ id: string; url: string }>;
  };
  return files.createFiles({
    filename: "sin-fondo.png",
    mimeType: "image/png",
    content: png.toString("base64"),
    access: "public",
  });
}

export async function logAiRequest(
  req: AiStudioRequest,
  entry: {
    sellerId: string;
    memberId: string;
    kind: "describe" | "remove_background";
    status: "ok" | "failed";
    provider?: string | null;
    model?: string | null;
    error?: string | null;
  },
) {
  await aiStudioService(req).createAiRequests({
    seller_id: entry.sellerId,
    member_id: entry.memberId,
    kind: entry.kind,
    status: entry.status,
    provider: entry.provider ?? null,
    model: entry.model ?? null,
    error: entry.error?.slice(0, 500) ?? null,
  });
}

export function toMedusaError(error: unknown): MedusaError {
  if (error instanceof MedusaError) return error;
  if (error instanceof AiStudioError) {
    return new MedusaError(
      error.code === "invalid_input"
        ? MedusaError.Types.INVALID_DATA
        : MedusaError.Types.NOT_ALLOWED,
      error.code === "not_configured"
        ? "AI Studio text provider is not configured."
        : error.code === "providers_failed"
          ? "No AI provider could prepare a draft right now."
          : error.message,
    );
  }
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "AI Studio failed.");
}

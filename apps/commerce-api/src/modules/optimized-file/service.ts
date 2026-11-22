import { LocalFileService } from "@medusajs/file-local";
import type { FileTypes } from "@medusajs/framework/types";
import { MedusaError } from "@medusajs/framework/utils";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { optimizeImage, VARIANT_WIDTHS, variantKey, webpName } from "../../lib/image-optimizer";

/** Same decoding as Medusa's local provider: base64, or a binary string. */
function decode(content: string) {
  const base64 = Buffer.from(content, "base64");
  return base64.toString("base64") === content ? base64 : Buffer.from(content, "binary");
}

/** Server-side allowlist: only real image content, verified with sharp. */
const ALLOWED_IMAGE_FORMATS = new Set(["jpeg", "png", "webp", "avif", "tiff"]);
/** Per-file limit for public uploads through this provider. */
const MAX_FILE_BYTES = 8 * 1024 * 1024;

/**
 * Verify the bytes are really one of the allowed image formats. The declared
 * `mimeType` is client-controlled and is never trusted: sharp reads the
 * actual file header, so a renamed executable or script is rejected here.
 */
async function assertAllowedImage(content: Buffer): Promise<void> {
  if (content.length > MAX_FILE_BYTES) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "The file exceeds the 8 MB limit.");
  }
  let format: string | undefined;
  try {
    const metadata = await sharp(content, { failOn: "error" }).metadata();
    // libvips reports AVIF as HEIF with AV1 compression.
    format =
      metadata.format === "heif" && metadata.compression === "av1" ? "avif" : metadata.format;
  } catch {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Only JPEG, PNG, WebP, AVIF or TIFF images are allowed.",
    );
  }
  if (!format || !ALLOWED_IMAGE_FORMATS.has(format)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Only JPEG, PNG, WebP, AVIF or TIFF images are allowed.",
    );
  }
}

/**
 * Medusa's local file provider (public `LocalFileService` of @medusajs/file-local) with
 * image optimisation on upload (AG-36): public photos are stored as WebP (≤1600 px) with
 * 400 and 800 px variants next to them. Public uploads are allowlisted on the server:
 * only images verified by content with sharp (jpeg/png/webp/avif/tiff, ≤8 MB) are
 * accepted; anything else is rejected instead of being stored unchanged.
 * Private uploads keep the plain provider behaviour.
 *
 * LIMITATION: this allowlist only covers the local provider. In S3 mode
 * (medusa-config.ts, `AGESTYLES_FILE_STORAGE_PROVIDER=s3`) uploads go
 * straight to `@medusajs/medusa/file-s3` with no validation, so the same
 * content check and size limit must be applied there (or uploads restricted
 * to this provider) before S3 mode can be considered covered.
 * Registered in medusa-config instead of the plain provider.
 */
export class OptimizedLocalFileService extends LocalFileService {
  static identifier = "optimized-local";

  async upload(file: FileTypes.ProviderUploadFileDTO): Promise<FileTypes.ProviderFileResultDTO> {
    if (file?.access !== "public") return super.upload(file);
    const content = decode(file.content);
    await assertAllowedImage(content);
    let optimized;
    try {
      optimized = await optimizeImage(content);
    } catch {
      // sharp already verified the bytes, so this should not happen; fail
      // closed rather than storing an unprocessed file.
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "The image could not be processed.");
    }
    const result = await super.upload({
      ...file,
      filename: webpName(file.filename),
      mimeType: "image/webp",
      content: optimized.main.toString("base64"),
    });
    const dir = path.resolve(this.uploadDir_);
    await Promise.all(
      optimized.variants.map(({ width, content }) => {
        const target = path.resolve(dir, variantKey(result.key, width));
        if (path.dirname(target) !== path.dirname(path.resolve(dir, result.key))) return null;
        return fs.writeFile(target, content);
      }),
    );
    return result;
  }

  async delete(
    files: FileTypes.ProviderDeleteFileDTO | FileTypes.ProviderDeleteFileDTO[],
  ): Promise<void> {
    await super.delete(files);
    const list = Array.isArray(files) ? files : [files];
    const dir = path.resolve(this.uploadDir_);
    await Promise.all(
      list.flatMap((file) =>
        VARIANT_WIDTHS.map((width) => {
          const target = path.resolve(dir, variantKey(file.fileKey, width));
          return target.startsWith(dir + path.sep) ? fs.rm(target, { force: true }) : null;
        }),
      ),
    );
  }
}

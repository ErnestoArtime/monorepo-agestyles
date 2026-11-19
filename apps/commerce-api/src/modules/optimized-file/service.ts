import { LocalFileService } from "@medusajs/file-local";
import type { FileTypes } from "@medusajs/framework/types";
import fs from "node:fs/promises";
import path from "node:path";
import {
  isOptimizable,
  optimizeImage,
  VARIANT_WIDTHS,
  variantKey,
  webpName,
} from "../../lib/image-optimizer";

/** Same decoding as Medusa's local provider: base64, or a binary string. */
function decode(content: string) {
  const base64 = Buffer.from(content, "base64");
  return base64.toString("base64") === content ? base64 : Buffer.from(content, "binary");
}

/**
 * Medusa's local file provider (public `LocalFileService` of @medusajs/file-local) with
 * image optimisation on upload (AG-36): public photos are stored as WebP (≤1600 px) with
 * 400 and 800 px variants next to them. Anything else (or a photo sharp cannot read) is
 * stored unchanged, as before. Registered in medusa-config instead of the plain provider.
 */
export class OptimizedLocalFileService extends LocalFileService {
  static identifier = "optimized-local";

  async upload(file: FileTypes.ProviderUploadFileDTO): Promise<FileTypes.ProviderFileResultDTO> {
    if (file?.access !== "public" || !isOptimizable(file.mimeType)) return super.upload(file);
    let optimized;
    try {
      optimized = await optimizeImage(decode(file.content));
    } catch {
      // Not a readable image: keep the original, as the plain provider would.
      return super.upload(file);
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

import sharp from "sharp";

/**
 * Image optimisation for uploads (AG-36). Buyers often connect over slow mobile links, so
 * every photo is stored as WebP, oriented, without metadata, at most 1600 px on the long
 * side, plus 400 and 800 px variants for cards and phones. Tienda asks for the variant that
 * fits (`mediaVariant` in buyer-experience).
 */
export const MAIN_EDGE = 1600;
export const VARIANT_WIDTHS = [400, 800] as const;
const OPTIMIZABLE = /^image\/(jpeg|jpg|png|webp|avif|tiff)$/i;

export type OptimizedImage = {
  main: Buffer;
  variants: { width: number; content: Buffer }[];
  width: number;
  height: number;
};

export function isOptimizable(mimeType: string | undefined) {
  return Boolean(mimeType && OPTIMIZABLE.test(mimeType));
}

/** `1700000000-foto.jpg` → `foto.webp` base; variants add `__w400` before the extension. */
export function webpName(filename: string) {
  return filename.replace(/\.[a-z0-9]+$/i, "") + ".webp";
}

export function variantKey(key: string, width: number) {
  return key.replace(/\.[a-z0-9]+$/i, "") + `__w${width}.webp`;
}

export async function optimizeImage(input: Buffer): Promise<OptimizedImage> {
  // `rotate()` applies the EXIF orientation; metadata is dropped by default.
  const base = sharp(input, { failOn: "error", limitInputPixels: 60_000_000 }).rotate();
  const main = await base
    .clone()
    .resize({ width: MAIN_EDGE, height: MAIN_EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80, effort: 4 })
    .toBuffer({ resolveWithObject: true });
  const variants = await Promise.all(
    VARIANT_WIDTHS.map(async (width) => ({
      width,
      content: await base
        .clone()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: width <= 400 ? 72 : 76, effort: 4 })
        .toBuffer(),
    })),
  );
  return { main: main.data, variants, width: main.info.width, height: main.info.height };
}

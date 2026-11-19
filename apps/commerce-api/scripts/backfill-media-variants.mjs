// AG-36: WebP size variants for photos uploaded before upload optimisation existed.
// Run inside the Commerce API container (it has sharp and the media volume):
//   docker exec <api> node scripts/backfill-media-variants.mjs [--dry-run]
// Idempotent: existing variants are kept. Originals are never modified (their URLs are
// stored in products and cached by browsers for a year).
import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const dir = process.env.AGESTYLES_MEDIA_DIR;
if (!dir?.startsWith("/")) throw new Error("AGESTYLES_MEDIA_DIR is required.");
const dryRun = process.argv.includes("--dry-run");
const ORIGINAL = /^[0-9]+-[a-zA-Z0-9_][a-zA-Z0-9_.-]*\.(webp|jpe?g|png|avif)$/i;
const exists = (file) =>
  stat(file).then(
    () => true,
    () => false,
  );

let created = 0;
let skipped = 0;
let failed = 0;
let before = 0;
let after = 0;
for (const name of await readdir(dir)) {
  if (!ORIGINAL.test(name) || /__w\d+\.webp$/i.test(name)) continue;
  const source = path.join(dir, name);
  const base = source.replace(/\.[a-z0-9]+$/i, "");
  const widths = /\.webp$/i.test(name) ? [400, 800] : [400, 800, 1600];
  try {
    const input = sharp(source, { failOn: "error" }).rotate();
    for (const width of widths) {
      const target = `${base}__w${width}.webp`;
      if (await exists(target)) {
        skipped += 1;
        continue;
      }
      const output = await input
        .clone()
        .resize({
          width,
          height: width === 1600 ? 1600 : undefined,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: width <= 400 ? 72 : width <= 800 ? 76 : 80, effort: 4 })
        .toBuffer();
      if (width === 400) {
        before += (await stat(source)).size;
        after += output.length;
      }
      if (!dryRun) await writeFile(target, output);
      created += 1;
    }
  } catch (error) {
    failed += 1;
    console.error("No se pudo procesar", name, error instanceof Error ? error.message : error);
  }
}
console.log(
  `${dryRun ? "[prueba] " : ""}variantes creadas: ${created}, ya existían: ${skipped}, fallos: ${failed}. ` +
    `Tarjetas: ${Math.round(before / 1024)} KB en originales → ${Math.round(after / 1024)} KB en 400 px.`,
);

import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { optimizeImage, variantKey, webpName } from "../src/lib/image-optimizer.ts";

test("names: WebP main and __w variants next to it", () => {
  assert.equal(webpName("foto.JPG"), "foto.webp");
  assert.equal(variantKey("1763500000000-foto.webp", 400), "1763500000000-foto__w400.webp");
});

test("a large rotated JPEG becomes a smaller WebP within 1600 px, with 400/800 variants", async () => {
  const input = await sharp({
    create: { width: 4000, height: 3000, channels: 3, background: { r: 200, g: 120, b: 60 } },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="4000" height="3000"><rect x="300" y="300" width="1800" height="1200" fill="#1f5fbf"/><circle cx="3000" cy="2000" r="700" fill="#fff"/></svg>`,
        ),
      },
    ])
    .withMetadata({ orientation: 6 })
    .jpeg({ quality: 95 })
    .toBuffer();
  const result = await optimizeImage(input);
  const main = await sharp(result.main).metadata();
  assert.equal(main.format, "webp");
  // Orientation 6 means rotated 90°: portrait after applying it.
  assert.equal(main.width, 1200);
  assert.equal(main.height, 1600);
  assert.equal(main.orientation, undefined);
  assert.ok(result.main.length < input.length / 5, `${result.main.length} vs ${input.length}`);
  const widths = await Promise.all(
    result.variants.map(async (v) => (await sharp(v.content).metadata()).width),
  );
  assert.deepEqual(widths, [400, 800]);
});

test("a small image is not enlarged", async () => {
  const input = await sharp({
    create: { width: 300, height: 200, channels: 4, background: "#00000000" },
  })
    .png()
    .toBuffer();
  const result = await optimizeImage(input);
  const main = await sharp(result.main).metadata();
  assert.equal(main.width, 300);
  assert.equal(main.hasAlpha, true);
  assert.equal((await sharp(result.variants[0].content).metadata()).width, 300);
});

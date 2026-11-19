/**
 * Image sizes served by the Commerce API media (AG-36). Every photo stored in AgeStyles'
 * media has WebP variants next to it: `<name>__w400.webp` and `<name>__w800.webp`, and new
 * uploads are themselves WebP of at most 1600 px. Older originals (JPEG/PNG) also get a
 * `__w1600.webp`. Photos hosted elsewhere are returned unchanged.
 */
export type MediaWidth = 400 | 800 | 1600;

const OWN_MEDIA =
  /^(https:\/\/[^/?#]+\/agestyles-product-media\/[0-9]+-[a-zA-Z0-9_][a-zA-Z0-9_.-]*?)\.(webp|jpe?g|png|avif)$/i;

export function mediaVariant(
  url: string | null | undefined,
  width: MediaWidth,
): string | undefined {
  if (!url) return undefined;
  const match = OWN_MEDIA.exec(url);
  if (!match || /__w\d+$/.test(match[1]!)) return url;
  // New uploads are already an optimised WebP of at most 1600 px.
  if (width === 1600 && match[2]!.toLowerCase() === "webp") return url;
  return `${match[1]}__w${width}.webp`;
}

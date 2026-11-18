import type { MetadataRoute } from "next";
import { getCatalog, getSellerDirectory } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.SITE_URL || "https://catalogo.eav-labs.com";
  const [{ products }, sellers] = await Promise.all([getCatalog(), getSellerDirectory()]);
  return [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/tiendas`, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/novedades`, changeFrequency: "daily", priority: 0.8 },
    ...sellers
      .filter((seller) => seller.handle)
      .map((seller) => ({
        url: `${siteUrl}/tiendas/${seller.handle}`,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ...products
      .filter((product) => product.handle)
      .map((product) => ({
        url: `${siteUrl}/productos/${product.handle}`,
        lastModified: product.updated_at ? new Date(product.updated_at) : undefined,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
  ];
}

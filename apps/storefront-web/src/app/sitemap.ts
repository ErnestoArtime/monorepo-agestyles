import type { MetadataRoute } from "next"
import { getCatalog } from "@/lib/catalog"

export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.SITE_URL || "https://catalogo.eav-labs.com"
  const { products } = await getCatalog()
  return [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    ...products
      .filter((product) => product.handle)
      .map((product) => ({
        url: `${siteUrl}/productos/${product.handle}`,
        lastModified: product.updated_at ? new Date(product.updated_at) : undefined,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
  ]
}

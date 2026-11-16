import Medusa from "@medusajs/js-sdk"
import type { HttpTypes } from "@medusajs/types"
import { listStoreOffers, listStoreProducts } from "@agestyles/api-client/store"

const backendUrl = process.env.MEDUSA_BACKEND_URL || process.env.NEXT_PUBLIC_MEDUSA_URL
const publishableKey = process.env.MEDUSA_PUBLISHABLE_API_KEY || process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY

const sdk = backendUrl
  ? new Medusa({ baseUrl: backendUrl, publishableKey })
  : undefined

export async function getCatalog(query?: string) {
  if (!sdk) return { products: [] as HttpTypes.StoreProduct[], offers: [], error: "La tienda se está preparando." }

  try {
    const { regions } = await sdk.store.region.list()
    const region = regions[0]
    if (!region) return { products: [] as HttpTypes.StoreProduct[], offers: [], error: "No hay una región de compra disponible." }

    const result = await listStoreProducts(sdk.client, {
      regionId: region.id,
      limit: 48,
      query,
    })
    const { offers } = await listStoreOffers(sdk.client, { limit: 100 })
    return { products: result.products, offers, currency: region.currency_code, error: undefined }
  } catch {
    return { products: [] as HttpTypes.StoreProduct[], offers: [], error: "No pudimos cargar el catálogo. Inténtalo de nuevo en unos minutos." }
  }
}
export async function getProductByHandle(handle: string) {
  if (!sdk) return undefined
  try {
    const { regions } = await sdk.store.region.list()
    const region = regions[0]
    if (!region) return undefined
    const { products } = await listStoreProducts(sdk.client, { regionId: region.id, handle, limit: 1 })
    const product = products[0]
    if (!product) return undefined
    const { offers } = await listStoreOffers(sdk.client, { productId: product.id })
    return { product, offers, currency: region.currency_code }
  } catch {
    return undefined
  }
}

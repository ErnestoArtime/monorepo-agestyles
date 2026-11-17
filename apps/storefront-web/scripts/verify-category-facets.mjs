import Medusa from "@medusajs/js-sdk"

const baseUrl = process.env.MEDUSA_BACKEND_URL || process.env.EXPO_PUBLIC_MEDUSA_URL
const publishableKey = process.env.MEDUSA_PUBLISHABLE_API_KEY || process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY

if (!baseUrl || !publishableKey) {
  throw new Error("Define MEDUSA_BACKEND_URL and MEDUSA_PUBLISHABLE_API_KEY (o las variables EXPO_PUBLIC de la app móvil).")
}

const sdk = new Medusa({ baseUrl, publishableKey })
const [{ regions }, categoryPage] = await Promise.all([
  sdk.store.region.list(),
  sdk.client.fetch("/store/product-categories", {
    query: { limit: 100, fields: "id,name,handle,rank,parent_category_id,products.id" },
  }),
])
const region = regions[0]
if (!region) throw new Error("La API no publicó ninguna región de compra.")

const activeCategories = categoryPage.product_categories.filter((category) => (category.products?.length ?? 0) > 0)
if (!activeCategories.length) throw new Error("No hay categorías con productos para comprobar.")

const results = []
for (const category of activeCategories) {
  const page = await sdk.store.product.list({
    region_id: region.id,
    category_id: category.id,
    limit: 100,
    fields: "id,title,*categories",
  })
  if (page.count < 1 || page.products.length < 1) {
    throw new Error(`El filtro '${category.handle}' no devolvió productos aunque la categoría aparece activa.`)
  }
  const wrongCategory = page.products.find((product) => !product.categories?.some((item) => item.id === category.id))
  if (wrongCategory) throw new Error(`El filtro '${category.handle}' incluyó el producto ${wrongCategory.id} de otra categoría.`)

  const title = page.products[0].title.trim()
  const searchTerm = title.split(/\s+/).find((word) => word.length >= 3)
  if (searchTerm) {
    const combined = await sdk.store.product.list({
      region_id: region.id,
      category_id: category.id,
      q: searchTerm,
      limit: 100,
      fields: "id,title,*categories",
    })
    if (combined.products.some((product) => !product.categories?.some((item) => item.id === category.id))) {
      throw new Error(`La combinación de búsqueda y categoría '${category.handle}' devolvió productos fuera de la categoría.`)
    }
  }
  results.push({ handle: category.handle, products: page.count, combinedSearchChecked: Boolean(searchTerm) })
}

console.log(JSON.stringify({ region: region.id, checkedCategories: results.length, results }, null, 2))

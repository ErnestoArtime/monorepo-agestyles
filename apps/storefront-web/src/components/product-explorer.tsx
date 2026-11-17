"use client"

import Image from "next/image"
import Link from "next/link"
import { Icon } from "@agestyles/icons"
import { useMemo, useState } from "react"
import type { HttpTypes } from "@medusajs/types"
import type { PublicProductCategory } from "@/lib/catalog"
import { formatPrice, productPrice } from "@/lib/catalog-format"

export function ProductExplorer({ products, categories = [], selectedCategory, searchTerm = "", bestPrices = {}, page = 1, totalProducts = products.length, totalPages = 1 }: { products: HttpTypes.StoreProduct[]; categories?: PublicProductCategory[]; selectedCategory?: string; searchTerm?: string; bestPrices?: Record<string, { amount: number; currency: string }>; page?: number; totalProducts?: number; totalPages?: number }) {
  const getPrice = (product: HttpTypes.StoreProduct) => bestPrices[product.id] || productPrice(product)
  const [sort, setSort] = useState("featured")
  const visible = useMemo(() => {
    const items = [...products]
    if (sort === "name") items.sort((a, b) => a.title.localeCompare(b.title, "es"))
    if (sort === "price-asc") items.sort((a, b) => (getPrice(a)?.amount ?? Infinity) - (getPrice(b)?.amount ?? Infinity))
    if (sort === "price-desc") items.sort((a, b) => (getPrice(b)?.amount ?? 0) - (getPrice(a)?.amount ?? 0))
    return items
  }, [bestPrices, products, sort])
  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams()
    if (searchTerm) params.set("q", searchTerm)
    if (selectedCategory) params.set("category", selectedCategory)
    params.set("page", String(nextPage))
    return `/?${params.toString()}#catalogo`
  }
  const firstResult = totalProducts === 0 ? 0 : (page - 1) * 48 + 1
  const lastResult = Math.min(page * 48, totalProducts)

  return <>
    <nav className="category-chips" aria-label="Filtrar por categoría">
      <Link href={`/${searchTerm ? `?q=${encodeURIComponent(searchTerm)}` : ""}#catalogo`} className={!selectedCategory ? "chip is-active" : "chip"} aria-current={!selectedCategory ? "page" : undefined}>Todo</Link>
      {categories.map((category) => {
        const params = new URLSearchParams({ category: category.handle })
        if (searchTerm) params.set("q", searchTerm)
        return <Link key={category.id} href={`/?${params.toString()}#catalogo`} className={selectedCategory === category.handle ? "chip is-active" : "chip"} aria-current={selectedCategory === category.handle ? "page" : undefined}>{category.name}</Link>
      })}
    </nav>
    <div className="catalog-tools">
      <form className="search-box" action="/" method="get"><span>⌕</span><input name="q" aria-label="Buscar productos" placeholder="¿Qué estás buscando?" defaultValue={searchTerm} />{selectedCategory && <input type="hidden" name="category" value={selectedCategory} />}<button type="submit" aria-label="Buscar">Buscar</button></form>
      <label className="sort-button">Ordenar <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Recomendados</option><option value="name">Nombre A–Z</option><option value="price-asc">Menor precio</option><option value="price-desc">Mayor precio</option></select></label>
    </div>
    <p className="results-count">Mostrando {firstResult}–{lastResult} de {totalProducts} {totalProducts === 1 ? "producto" : "productos"}{searchTerm ? ` para “${searchTerm}”` : " disponibles actualmente"}</p>
    {visible.length ? <div className="product-grid">{visible.map((product, index) => {
      const price = getPrice(product)
      const handle = product.handle || product.id
      return <article className="product-card" key={product.id}>
        <Link className="product-image" href={`/productos/${handle}`}>
          {product.thumbnail ? <Image src={product.thumbnail} alt={product.title} fill unoptimized sizes="(max-width: 650px) 50vw, (max-width: 1000px) 33vw, 25vw" /> : <div className="image-placeholder">AGESTYLES</div>}
          {index < 2 && <span className="product-tag">DESTACADO</span>}
          <span className="heart" aria-hidden="true"><Icon name="heart" size={19} /></span>
        </Link>
        <div className="product-meta"><span>{product.categories?.[0]?.name || "AGESTYLES SELECTION"}</span><span>↗</span></div>
        <Link href={`/productos/${handle}`} className="product-title">{product.title}</Link>
        <div className="product-foot"><span>{price ? formatPrice(price.amount, price.currency) : "Consultar"}</span><Link href={`/productos/${handle}#tiendas`}>Comparar tiendas <Icon name="arrowRight" size={12} /></Link></div>
      </article>
    })}</div> : <div className="empty-state"><span>⌕</span><h3>No encontramos productos</h3><p>Prueba con otra búsqueda o selecciona una categoría distinta.</p></div>}
    {totalPages > 1 && <nav className="catalog-pagination" aria-label="Paginación del catálogo">
      {page > 1 ? <Link href={pageHref(page - 1)}>Anterior</Link> : <span aria-disabled="true">Anterior</span>}
      <span aria-current="page">Página {page} de {totalPages}</span>
      {page < totalPages ? <Link href={pageHref(page + 1)}>Siguiente</Link> : <span aria-disabled="true">Siguiente</span>}
    </nav>}
  </>
}

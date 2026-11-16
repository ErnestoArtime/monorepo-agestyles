"use client"

import Image from "next/image"
import Link from "next/link"
import { Icon } from "@agestyles/icons"
import { useMemo, useState } from "react"
import type { HttpTypes } from "@medusajs/types"
import { formatPrice, productPrice } from "@/lib/catalog-format"

export function ProductExplorer({ products, searchTerm = "", bestPrices = {} }: { products: HttpTypes.StoreProduct[]; searchTerm?: string; bestPrices?: Record<string, { amount: number; currency: string }> }) {
  const getPrice = (product: HttpTypes.StoreProduct) => bestPrices[product.id] || productPrice(product)
  const categories = useMemo(() => ["Todo", ...new Set(products.flatMap((product) => product.categories?.map((category) => category.name) || []))], [products])
  const [category, setCategory] = useState("Todo")
  const [sort, setSort] = useState("featured")
  const visible = useMemo(() => {
    let items = category === "Todo" ? [...products] : products.filter((product) => product.categories?.some((item) => item.name === category))
    if (sort === "name") items.sort((a, b) => a.title.localeCompare(b.title, "es"))
    if (sort === "price-asc") items.sort((a, b) => (getPrice(a)?.amount ?? Infinity) - (getPrice(b)?.amount ?? Infinity))
    if (sort === "price-desc") items.sort((a, b) => (getPrice(b)?.amount ?? 0) - (getPrice(a)?.amount ?? 0))
    return items
  }, [bestPrices, category, products, sort])

  return <>
    <div className="category-chips" aria-label="Filtrar por categoría">
      {categories.map((name) => <button key={name} className={category === name ? "chip is-active" : "chip"} onClick={() => setCategory(name)}>{name}</button>)}
    </div>
    <div className="catalog-tools">
      <form className="search-box" action="/" method="get"><span>⌕</span><input name="q" aria-label="Buscar productos" placeholder="¿Qué estás buscando?" defaultValue={searchTerm} /><button type="submit" aria-label="Buscar">Buscar</button></form>
      <label className="sort-button">Ordenar <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Recomendados</option><option value="name">Nombre A–Z</option><option value="price-asc">Menor precio</option><option value="price-desc">Mayor precio</option></select></label>
    </div>
    <p className="results-count">{visible.length} {visible.length === 1 ? "producto" : "productos"}{searchTerm ? ` para “${searchTerm}”` : " disponibles actualmente"}</p>
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
  </>
}

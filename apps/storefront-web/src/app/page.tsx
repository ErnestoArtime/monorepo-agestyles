import Image from "next/image"
import Link from "next/link"
import type { Metadata } from "next"
import { Icon } from "@agestyles/icons"
import { getCatalog } from "@/lib/catalog"
import { lowestOfferPrices } from "@/lib/catalog-format"
import { ProductExplorer } from "@/components/product-explorer"

export const revalidate = 300
export const metadata: Metadata = { alternates: { canonical: "/" } }

export default async function StorefrontHome({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams
  const { products, offers, currency = "eur", error } = await getCatalog(q.trim() || undefined)
  const featured = products.slice(0, 4)
  const catalog = products.slice(0, 48)
  const buyerAppUrl = process.env.BUYER_APP_URL || "https://tienda.eav-labs.com"
  const sellers = [...offers.reduce((map, offer) => {
    if (!offer.seller?.id || !offer.seller.name) return map
    const seller = map.get(offer.seller.id) || { id: offer.seller.id, name: offer.seller.name, products: new Set<string>() }
    seller.products.add(offer.product_id)
    map.set(offer.seller.id, seller)
    return map
  }, new Map<string, { id: string; name: string; products: Set<string> }>()).values()].sort((a, b) => b.products.size - a.products.size).slice(0, 4)

  return (
    <main>
      <div className="topline">UNA NUEVA FORMA DE DESCUBRIR · BETA DE PRUEBA</div>
      <header className="site-header">
        <Link href="/" className="brand" aria-label="AgeStyles inicio"><Image src="/agestyles-mark.svg" alt="" width={34} height={34} priority /><span>AgeStyles</span></Link>
        <nav className="main-nav" aria-label="Navegación principal"><a href="#catalogo" className="active">Catálogo</a><a href="#novedades">Novedades</a><a href="#tiendas">Tiendas</a></nav>
        <div className="header-actions"><a href="#buscar" aria-label="Buscar"><Icon name="search" size={19} /></a><a href="#favoritos" aria-label="Favoritos"><Icon name="heart" size={19} /></a><a className="bag" href={buyerAppUrl}><Icon name="shoppingBag" size={15} /> Comprar en la app <Icon name="arrowRight" size={13} /></a></div>
      </header>

      <section className="hero wrap" id="novedades">
        <div className="hero-copy"><p className="eyebrow">TU PRÓXIMO FAVORITO ESTÁ AQUÍ</p><h1>Lo que buscas.<br /><em>Más opciones.</em></h1><p className="hero-intro">Explora productos de distintas tiendas, compara opciones y elige lo que va contigo.</p><a className="button button-dark" href="#catalogo">Descubrir productos <Icon name="arrowRight" size={14} /></a><div className="hero-note"><span className="note-dot" /> Una selección de tiendas, en un solo lugar</div></div>
        <div className="hero-art" aria-label="Selección de productos AgeStyles"><div className="art-label">AGESTYLES / SELECCIÓN 01</div>{featured[0]?.thumbnail ? <Image src={featured[0].thumbnail} alt={featured[0].title} fill priority unoptimized sizes="(max-width: 760px) 90vw, 48vw" className="hero-product" /> : <div className="art-placeholder"><span>A</span></div>}<div className="art-caption"><span>01 — NUEVOS DESCUBRIMIENTOS</span><span>Explora la selección <Icon name="arrowRight" size={12} /></span></div></div>
      </section>

      <section className="category-band" aria-label="Explora categorías"><div className="wrap category-inner"><div><p className="eyebrow">ENCUENTRA TU CAMINO</p><h2>Explora por categoría</h2><p>Elige una categoría y descubre lo que hay en ella.</p></div><a className="text-link" href="#catalogo">Ver categorías <span>↓</span></a></div></section>

      <section className="wrap products-section" id="catalogo"><div className="section-heading"><div><p className="eyebrow">EL CATÁLOGO AGESTYLES</p><h2>{q ? `Resultados para “${q}”` : "Encuentra algo especial"}</h2><p>Explora productos y compara las opciones de las tiendas.</p></div><a className="text-link" href="#catalogo">Ver todo el catálogo <span>↗</span></a></div><div id="buscar">{error ? <div className="empty-state"><span>◌</span><h3>Estamos preparando el catálogo</h3><p>{error}</p></div> : <ProductExplorer products={catalog} searchTerm={q} bestPrices={lowestOfferPrices(offers, currency)} />}</div></section>

      <section className="compare-strip" id="comparar"><div className="wrap compare-inner"><div><p className="eyebrow">COMPRA CON CONFIANZA</p><h2>Compara antes de elegir.</h2><p>Descubre las opciones de cada tienda y encuentra la que mejor encaja contigo.</p></div><a className="button button-outline" href="#catalogo">Explorar productos <Icon name="arrowRight" size={14} /></a></div></section>

      <section className="wrap stores-section" id="tiendas"><div className="section-heading"><div><p className="eyebrow">MARCAS Y COMERCIOS</p><h2>Conoce las tiendas</h2><p>Descubre quién está detrás de cada producto.</p></div><a className="text-link" href="#catalogo">Comparar productos <span>↗</span></a></div>{sellers.length ? <div className="store-grid">{sellers.map((seller, index) => <article className="store-card" key={seller.id}><span className="store-index">0{index + 1}</span><div className="store-avatar">{seller.name.slice(0, 1)}</div><h3>{seller.name}</h3><p>{seller.products.size} {seller.products.size === 1 ? "producto" : "productos"} con ofertas</p><span className="store-arrow">AGESTYLES SELLER ↗</span></article>)}</div> : <div className="stores-empty"><span>AS</span><p>Las tiendas se mostrarán cuando publiquen ofertas.</p></div>}</section>

      <footer className="site-footer"><div className="wrap footer-main"><Link href="/" className="brand"><Image src="/agestyles-mark.svg" alt="" width={28} height={28} /><span>AgeStyles</span></Link><p>Descubre. Compara. Elige.</p><a href="mailto:hola@agestyles.com">Hablemos <Icon name="arrowRight" size={12} /></a></div><div className="wrap footer-bottom"><span>© 2026 AgeStyles</span><span>Experiencia beta · Productos y pedidos de prueba</span><a href={buyerAppUrl}>Conocer la app de compra <Icon name="arrowRight" size={12} /></a></div></footer>
    </main>
  )
}

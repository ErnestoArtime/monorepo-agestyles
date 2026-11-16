import Image from "next/image"
import Link from "next/link"
import { Icon } from "@agestyles/icons"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getProductByHandle } from "@/lib/catalog"
import { formatPrice, productPrice } from "@/lib/catalog-format"

type PageProps = { params: Promise<{ handle: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params
  const data = await getProductByHandle(handle)
  if (!data) return { title: "Producto no encontrado" }
  return {
    title: data.product.title,
    description: data.product.description || `Descubre ${data.product.title}, compara tiendas y encuentra su mejor opción en AgeStyles.`,
    openGraph: { images: data.product.thumbnail ? [data.product.thumbnail] : [] },
    alternates: { canonical: `/productos/${data.product.handle || handle}` },
  }
}

export default async function ProductPage({ params }: PageProps) {
  const { handle } = await params
  const data = await getProductByHandle(handle)
  if (!data) notFound()
  const { product, offers, currency } = data
  const buyerAppUrl = process.env.BUYER_APP_URL || "https://tienda.eav-labs.com"
  const sellers = new Map<string, { name: string; prices: number[]; sizes: Set<string>; offers: number }>()
  for (const offer of offers) {
    const sellerId = offer.seller?.id || offer.seller_id
    const sellerName = offer.seller?.name || "Tienda AgeStyles"
    const current = sellers.get(sellerId) || { name: sellerName, prices: [], sizes: new Set<string>(), offers: 0 }
    for (const price of offer.prices || []) if (price.currency_code.toLowerCase() === currency.toLowerCase()) current.prices.push(price.amount)
    if (offer.product_variant?.title) current.sizes.add(offer.product_variant.title)
    current.offers += 1
    sellers.set(sellerId, current)
  }
  const choices = [...sellers.entries()].map(([id, seller]) => ({ id, ...seller, price: seller.prices.length ? Math.min(...seller.prices) : undefined })).sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
  const bestOfferPrice = choices.find((seller) => seller.price != null)?.price
  const basePrice = bestOfferPrice != null ? { amount: bestOfferPrice, currency } : productPrice(product)

  return <main className="product-page">
    <header className="site-header"><Link href="/" className="brand"><Image src="/agestyles-mark.svg" alt="" width={34} height={34} /><span>AgeStyles</span></Link><nav className="main-nav"><Link href="/#catalogo">Catálogo</Link><Link href="/#tiendas">Tiendas</Link></nav><a className="bag" href={buyerAppUrl}>Abrir app de compra ↗</a></header>
    <div className="wrap breadcrumbs"><Link href="/">Inicio</Link><span>/</span><Link href="/#catalogo">Catálogo</Link><span>/</span><span>{product.title}</span></div>
    <section className="wrap detail-layout">
      <div className="detail-image">{product.thumbnail ? <Image src={product.thumbnail} alt={product.title} fill priority unoptimized sizes="(max-width: 760px) 100vw, 55vw" /> : <div className="image-placeholder">AGESTYLES</div>}</div>
      <div className="detail-copy"><p className="eyebrow">{product.categories?.[0]?.name || "AGESTYLES SELECTION"}</p><h1>{product.title}</h1><p className="detail-description">{product.description || "Descubre este producto y revisa las opciones disponibles en las tiendas AgeStyles."}</p>
        {basePrice && <p className="detail-base-price">Desde {formatPrice(basePrice.amount, basePrice.currency)}</p>}
        <a className="button button-dark" href="#tiendas">Comparar tiendas <Icon name="arrowDown" size={14} /></a>
        <p className="detail-note">La disponibilidad y el precio final dependen de la tienda y la variante elegida.</p>
      </div>
    </section>
    <section className="wrap seller-section" id="tiendas"><div className="section-heading"><div><p className="eyebrow">COMPARA TUS OPCIONES</p><h2>Disponible en {choices.length} {choices.length === 1 ? "tienda" : "tiendas"}</h2><p>Compara precios por tienda y elige la opción que prefieras.</p></div><span className="seller-count">{offers.length} opciones disponibles</span></div>
      {choices.length ? <div className="seller-list">{choices.map((seller, index) => <article className="seller-row" key={seller.id}><div className="seller-avatar">{seller.name.charAt(0)}</div><div className="seller-info"><h3>{seller.name}</h3><p>{seller.sizes.size ? `${seller.sizes.size} variantes disponibles` : "Ver variantes disponibles"}</p></div><div className="seller-prices">{seller.price != null ? <><span className="seller-from">Desde</span><strong>{formatPrice(seller.price, currency)}</strong></> : <strong>Consultar precio</strong>}</div><span className={index === 0 ? "seller-badge best" : "seller-badge"}>{index === 0 ? "Mejor precio" : "Tienda verificada"}</span></article>)}</div> : <div className="empty-state"><h3>Opciones de tiendas en preparación</h3><p>Este producto todavía no tiene ofertas publicadas.</p></div>}
      <p className="beta-notice">Experiencia beta: las opciones y pedidos actuales son de prueba.</p>
    </section>
    <footer className="site-footer"><div className="wrap footer-bottom"><span>© 2026 AgeStyles</span><Link href="/">Volver al catálogo ↗</Link></div></footer>
  </main>
}

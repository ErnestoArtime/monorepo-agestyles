import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Icon } from "@agestyles/icons";
import { ProductExplorer } from "@/components/product-explorer";
import { getSellerCatalog } from "@/lib/catalog";
import { lowestOfferPrices } from "@/lib/catalog-format";

export const revalidate = 300;

type PageProps = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  const data = await getSellerCatalog(handle);
  if (!data) return { title: "Tienda no disponible | AgeStyles" };
  const { seller } = data;
  return {
    title: `${seller.name} | Tiendas`,
    description:
      seller.description || `Descubre los productos y ofertas de ${seller.name} en AgeStyles.`,
    alternates: { canonical: `/tiendas/${seller.handle}` },
    openGraph: {
      title: `${seller.name} | AgeStyles`,
      description: seller.description || `Explora la selección de ${seller.name} en AgeStyles.`,
      ...(seller.banner ? { images: [seller.banner] } : {}),
    },
  };
}

export default async function StorePage({ params }: PageProps) {
  const { handle } = await params;
  const data = await getSellerCatalog(handle);
  if (!data) notFound();

  const { seller, products, offers, currency } = data;
  const buyerAppUrl = process.env.BUYER_APP_URL || "https://tienda.eav-labs.com";
  const sortedProducts = [...products].sort((a, b) => a.title.localeCompare(b.title, "es"));

  return (
    <main className="seller-store-page">
      <div className="topline">AGESTYLES · TIENDA OFICIAL</div>
      <header className="site-header">
        <Link href="/" className="brand" aria-label="AgeStyles inicio">
          <Image src="/agestyles-mark.svg" alt="" width={34} height={34} priority />
          <span>AgeStyles</span>
        </Link>
        <nav className="main-nav" aria-label="Navegación principal">
          <Link href="/#catalogo">Catálogo</Link>
          <Link href="/tiendas" className="active">
            Tiendas
          </Link>
        </nav>
        <a className="bag" href={buyerAppUrl}>
          Comprar en la app <Icon name="arrowRight" size={13} />
        </a>
      </header>

      <div className="wrap breadcrumbs">
        <Link href="/">Inicio</Link>
        <span>/</span>
        <Link href="/tiendas">Tiendas</Link>
        <span>/</span>
        <span>{seller.name}</span>
      </div>

      <section className="wrap seller-store-hero">
        <div className="seller-store-banner">
          {seller.banner ? (
            <Image
              src={seller.banner}
              alt=""
              fill
              priority
              unoptimized
              sizes="(max-width: 760px) 100vw, 1200px"
            />
          ) : (
            <div className="seller-store-banner-placeholder">AGESTYLES / VENDEDOR</div>
          )}
        </div>
        <div className="seller-store-intro">
          <div className="seller-store-logo">
            {seller.logo ? (
              <Image src={seller.logo} alt="" width={68} height={68} unoptimized />
            ) : (
              <span>{seller.name.charAt(0)}</span>
            )}
          </div>
          <div className="seller-store-copy">
            <p className="eyebrow">TIENDA EN AGESTYLES</p>
            <h1>{seller.name}</h1>
            <p>{seller.description || "Descubre la selección de esta tienda en AgeStyles."}</p>
          </div>
          <div className="seller-store-stats">
            <span>
              <strong>{products.length}</strong> productos
            </span>
            <span>
              <strong>{offers.length}</strong> ofertas
            </span>
          </div>
        </div>
      </section>

      <section className="wrap seller-store-catalog" aria-label={`Productos de ${seller.name}`}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">LA SELECCIÓN DE {seller.name.toLocaleUpperCase("es")}</p>
            <h2>Explora sus productos</h2>
            <p>Compara variantes y ofertas de esta tienda.</p>
          </div>
          <Link className="text-link" href="/tiendas">
            Ver todas las tiendas <span>↗</span>
          </Link>
        </div>
        {sortedProducts.length ? (
          <ProductExplorer
            products={sortedProducts}
            bestPrices={lowestOfferPrices(offers, currency)}
          />
        ) : (
          <div className="empty-state">
            <h3>Esta tienda está preparando su catálogo.</h3>
            <p>Vuelve pronto para descubrir sus productos.</p>
          </div>
        )}
        <p className="beta-notice">Experiencia beta: productos y ofertas de prueba.</p>
      </section>

      <footer className="site-footer">
        <div className="wrap footer-main">
          <Link href="/" className="brand">
            <Image src="/agestyles-mark.svg" alt="" width={28} height={28} />
            <span>AgeStyles</span>
          </Link>
          <p>Descubre. Compara. Elige.</p>
          <Link href="/tiendas">
            Todas las tiendas <Icon name="arrowRight" size={12} />
          </Link>
        </div>
        <div className="wrap footer-bottom">
          <span>© 2026 AgeStyles</span>
          <span>Experiencia beta · Productos y pedidos de prueba</span>
          <a href={buyerAppUrl}>
            Conocer la app de compra <Icon name="arrowRight" size={12} />
          </a>
        </div>
      </footer>
    </main>
  );
}

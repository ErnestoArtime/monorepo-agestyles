import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProductExplorer } from "@/components/product-explorer";
import { StoreViewTracker } from "@/components/product-events-tracker";
import { StoreInfoCard } from "@/components/store-info-card";
import { getPublicStoreConfig, getSellerCatalog, getStoreInfo } from "@/lib/catalog";
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
  const storeInfo = await getStoreInfo(seller.handle);
  const storeConfig = await getPublicStoreConfig();
  const apiConfig = storeConfig
    ? { apiUrl: storeConfig.apiUrl, publishableKey: storeConfig.publishableKey }
    : null;
  const sortedProducts = [...products].sort((a, b) => a.title.localeCompare(b.title, "es"));

  return (
    <main className="seller-store-page">
      <StoreViewTracker config={apiConfig} sellerId={seller.id} />
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

      {storeInfo ? <StoreInfoCard info={storeInfo} /> : null}

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
            sellerId={seller.id}
            apiConfig={apiConfig}
          />
        ) : (
          <div className="empty-state">
            <h3>Esta tienda está preparando su catálogo.</h3>
            <p>Vuelve pronto para descubrir sus productos.</p>
          </div>
        )}
        <p className="beta-notice">
          AgeStyles está en fase piloto. Los pedidos son reales; si algo falla, avísanos.
        </p>
      </section>
    </main>
  );
}

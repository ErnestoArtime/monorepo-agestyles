import Link from "next/link";
import { Icon } from "@agestyles/icons";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicStoreConfig, getQuickViewData } from "@/lib/catalog";
import { formatPrice } from "@/lib/catalog-format";
import { groupBySeller } from "@/lib/quick-view-model";
import { ProductComparisonBar, ProductComparisonToggle } from "@/components/product-comparison";
import { ProductStoreLink, ProductViewTracker } from "@/components/product-events-tracker";
import { ProductGallery } from "@/components/product-gallery";
import { PurchasePanel } from "@/components/purchase-panel";
import { formatCupEquivalent } from "@agestyles/api-client/exchange-rate";

type PageProps = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  const data = await getQuickViewData(handle);
  if (!data) return { title: "Producto no encontrado" };
  return {
    title: data.product.title,
    description:
      data.product.description ||
      `Descubre ${data.product.title}, compara tiendas y encuentra su mejor opción en AgeStyles.`,
    openGraph: { images: data.product.thumbnail ? [data.product.thumbnail] : [] },
    alternates: { canonical: `/productos/${data.product.handle || handle}` },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { handle } = await params;
  const data = await getQuickViewData(handle);
  if (!data) notFound();
  const { product, offers, currency, cupRate } = data;
  const buyerAppUrl = process.env.BUYER_APP_URL || "https://tienda.eav-labs.com";
  const storeConfig = await getPublicStoreConfig();
  const apiConfig = storeConfig
    ? { apiUrl: storeConfig.apiUrl, publishableKey: storeConfig.publishableKey }
    : null;
  const sellers = groupBySeller(offers);
  const bestPrice = sellers.find((seller) => seller.inStock)?.fromAmount ?? sellers[0]?.fromAmount;
  const images = product.images.length
    ? product.images
    : product.thumbnail
      ? [product.thumbnail]
      : [];

  return (
    <main className="product-page">
      <ProductViewTracker
        config={apiConfig}
        productId={product.id}
        sellerIds={sellers.map((seller) => seller.id)}
      />
      <div className="wrap breadcrumbs">
        <Link href="/">Inicio</Link>
        <span>/</span>
        <Link href="/#catalogo">Catálogos</Link>
        {product.category ? (
          <>
            <span>/</span>
            <span>{product.category}</span>
          </>
        ) : null}
        <span>/</span>
        <span>{product.title}</span>
      </div>
      <section className="wrap detail-layout">
        <ProductGallery images={images} alt={product.title} priority />
        <div className="detail-copy">
          <p className="eyebrow">{product.category || "SELECCIÓN AGESTYLES"}</p>
          <h1>{product.title}</h1>
          <PurchasePanel data={data} buyerAppUrl={buyerAppUrl} />
          <p className="detail-note">
            La disponibilidad y el precio final dependen de la tienda y la variante elegida.
          </p>
          <div className="detail-secondary">
            {sellers.length > 1 ? (
              <a className="text-link" href="#tiendas">
                Comparar las {sellers.length} tiendas <Icon name="arrowDown" size={13} />
              </a>
            ) : null}
            <ProductComparisonToggle productId={product.id} />
          </div>
        </div>
      </section>

      <section className="wrap detail-info" aria-label="Detalles del producto">
        <div>
          <h2>Descripción</h2>
          <p className="detail-description">
            {product.description ||
              "Este producto todavía no tiene una descripción. Revisa las opciones disponibles en las tiendas AgeStyles."}
          </p>
        </div>
        {product.specs.length ? (
          <div>
            <h2>Características</h2>
            <dl className="spec-list">
              {product.specs.map((spec) => (
                <div key={spec.label}>
                  <dt>{spec.label}</dt>
                  <dd>{spec.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </section>

      <section className="wrap seller-section" id="tiendas">
        <ProductComparisonBar />
        <div className="section-heading">
          <div>
            <p className="eyebrow">DÓNDE COMPRARLO</p>
            <h2>
              Disponible en {sellers.length} {sellers.length === 1 ? "tienda" : "tiendas"}
            </h2>
            <p>
              Precio y variantes de cada tienda. Elige la que prefieras arriba y agrégala al
              carrito.
            </p>
          </div>
          <span className="seller-count">{offers.length} opciones disponibles</span>
        </div>
        {sellers.length ? (
          <div className="seller-list">
            {sellers.map((seller) => (
              <article className="seller-row" key={seller.id}>
                <div className="seller-avatar">{seller.name.charAt(0)}</div>
                <div className="seller-info">
                  <h3>
                    {seller.handle ? (
                      <ProductStoreLink
                        config={apiConfig}
                        href={`/tiendas/${seller.handle}`}
                        productId={product.id}
                        sellerId={seller.id}
                      >
                        {seller.name}
                      </ProductStoreLink>
                    ) : (
                      seller.name
                    )}
                  </h3>
                  <p>
                    {seller.variants.length === 1
                      ? seller.variants[0].title
                      : `${seller.variants.length} variantes: ${seller.variants.map((variant) => variant.title).join(", ")}`}
                  </p>
                </div>
                <div className="seller-prices">
                  <span className="seller-from">Desde</span>
                  <strong>{formatPrice(seller.fromAmount, currency)}</strong>
                  {formatCupEquivalent(seller.fromAmount, currency, cupRate) && (
                    <span className="seller-cup">
                      {formatCupEquivalent(seller.fromAmount, currency, cupRate)}
                    </span>
                  )}
                </div>
                <span
                  className={
                    seller.fromAmount === bestPrice && seller.inStock
                      ? "seller-badge best"
                      : "seller-badge"
                  }
                >
                  {!seller.inStock
                    ? "Agotado"
                    : seller.fromAmount === bestPrice
                      ? "Mejor precio"
                      : "Tienda verificada"}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>Opciones de tiendas en preparación</h3>
            <p>Este producto todavía no tiene ofertas publicadas.</p>
          </div>
        )}
        <p className="beta-notice">
          AgeStyles está en fase piloto. Los pedidos son reales; si algo falla, avísanos.
        </p>
      </section>
    </main>
  );
}

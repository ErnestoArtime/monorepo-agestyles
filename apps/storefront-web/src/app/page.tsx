import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@agestyles/icons";
import { getCatalog, getSellerDirectory } from "@/lib/catalog";
import { lowestOfferPrices } from "@/lib/catalog-format";
import { ProductExplorer } from "@/components/product-explorer";

export const revalidate = 300;
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function StorefrontHome({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  const { q = "", category = "", page: requestedPage = "1" } = await searchParams;
  const page = /^\d+$/.test(requestedPage) ? Math.max(1, Number(requestedPage)) : 1;
  const [
    {
      products,
      offers,
      categories,
      selectedCategory,
      currency = "eur",
      error,
      page: currentPage,
      totalProducts,
      totalPages,
    },
    allSellers,
  ] = await Promise.all([
    getCatalog(q.trim() || undefined, category || undefined, page),
    getSellerDirectory(),
  ]);
  const featured = products.slice(0, 4);
  const catalog = products.slice(0, 48);
  const sellers = [...allSellers].sort((a, b) => b.productCount - a.productCount).slice(0, 4);

  return (
    <main>
      <section className="hero wrap" id="novedades">
        <div className="hero-copy">
          <p className="eyebrow">TU PRÓXIMO FAVORITO ESTÁ AQUÍ</p>
          <h1>
            Lo que buscas.
            <br />
            <em>Más opciones.</em>
          </h1>
          <p className="hero-intro">
            Explora productos de distintas tiendas, compara opciones y elige lo que va contigo.
          </p>
          <a className="button button-dark" href="#catalogo">
            Descubrir productos <Icon name="arrowRight" size={14} />
          </a>
          <div className="hero-note">
            <span className="note-dot" /> Una selección de tiendas, en un solo lugar
          </div>
        </div>
        <div className="hero-art" aria-label="Selección de productos AgeStyles">
          <div className="art-label">AGESTYLES / SELECCIÓN 01</div>
          {featured[0]?.thumbnail ? (
            <Image
              src={featured[0].thumbnail}
              alt={featured[0].title}
              fill
              priority
              unoptimized
              sizes="(max-width: 760px) 90vw, 48vw"
              className="hero-product"
            />
          ) : (
            <div className="art-placeholder">
              <span>A</span>
            </div>
          )}
          <div className="art-caption">
            <span>01 — NUEVOS DESCUBRIMIENTOS</span>
            <span>
              Explora la selección <Icon name="arrowRight" size={12} />
            </span>
          </div>
        </div>
      </section>

      <section className="category-band" aria-label="Explora categorías">
        <div className="wrap category-inner">
          <div>
            <p className="eyebrow">ENCUENTRA TU CAMINO</p>
            <h2>Explora por categoría</h2>
            <p>Elige una categoría y descubre lo que hay en ella.</p>
          </div>
          <a className="text-link" href="#catalogo">
            Ver categorías <span>↓</span>
          </a>
        </div>
      </section>

      <section className="wrap products-section" id="catalogo">
        <div className="section-heading">
          <div>
            <p className="eyebrow">EL CATÁLOGO AGESTYLES</p>
            <h2>
              {selectedCategory
                ? selectedCategory.name
                : q
                  ? `Resultados para “${q}”`
                  : "Encuentra algo especial"}
            </h2>
            <p>Mira cada producto de un vistazo, elige tienda y variante y agrégalo al carrito.</p>
          </div>
          <Link className="text-link" href="/">
            Ver todo el catálogo <span>↗</span>
          </Link>
        </div>
        <div id="buscar">
          {error ? (
            <div className="empty-state">
              <span>◌</span>
              <h3>Estamos preparando el catálogo</h3>
              <p>{error}</p>
            </div>
          ) : (
            <ProductExplorer
              products={catalog}
              categories={categories}
              selectedCategory={selectedCategory?.handle}
              searchTerm={q}
              bestPrices={lowestOfferPrices(offers, currency)}
              page={currentPage}
              totalProducts={totalProducts}
              totalPages={totalPages}
            />
          )}
        </div>
      </section>

      <section className="wrap stores-section" id="tiendas">
        <div className="section-heading">
          <div>
            <p className="eyebrow">MARCAS Y COMERCIOS</p>
            <h2>Conoce las tiendas</h2>
            <p>Descubre quién está detrás de cada producto.</p>
          </div>
          <Link className="text-link" href="/tiendas">
            Ver todas las tiendas <span>↗</span>
          </Link>
        </div>
        {sellers.length ? (
          <div className="store-grid">
            {sellers.map((seller, index) => (
              <Link className="store-card" href={`/tiendas/${seller.handle}`} key={seller.id}>
                <span className="store-index">0{index + 1}</span>
                <div className="store-avatar">
                  {seller.logo ? (
                    <Image src={seller.logo} alt="" width={38} height={38} unoptimized />
                  ) : (
                    seller.name.slice(0, 1)
                  )}
                </div>
                <h3>{seller.name}</h3>
                <p>
                  {seller.productCount} {seller.productCount === 1 ? "producto" : "productos"} ·{" "}
                  {seller.offerCount} ofertas
                </p>
                <span className="store-arrow">Explorar tienda ↗</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="stores-empty">
            <span>AS</span>
            <p>Las tiendas se mostrarán cuando publiquen ofertas.</p>
          </div>
        )}
      </section>
    </main>
  );
}

import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getCatalog } from "@/lib/catalog";
import { listedAt, lowestOfferPrices } from "@/lib/catalog-format";
import { ProductExplorer } from "@/components/product-explorer";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Novedades",
  description: "Los productos que acaban de llegar a las tiendas de AgeStyles.",
  alternates: { canonical: "/novedades" },
};

const NEWS_LIMIT = 24;

/**
 * Newest products first (legacy page `/novedades`). Products migrated from the legacy
 * catalog use their original publication date when it was preserved (AG-18).
 */
export default async function NewsPage() {
  const { products, offers, categories, currency = "usd", error } = await getCatalog();
  const newest = [...products].sort((a, b) => listedAt(b) - listedAt(a)).slice(0, NEWS_LIMIT);

  return (
    <main>
      <header className="site-header">
        <Link href="/" className="brand" aria-label="AgeStyles inicio">
          <Image src="/agestyles-mark.svg" alt="" width={34} height={34} priority />
          <span>AgeStyles</span>
        </Link>
        <nav className="main-nav" aria-label="Navegación principal">
          <Link href="/#catalogo">Catálogo</Link>
          <Link href="/novedades" className="active" aria-current="page">
            Novedades
          </Link>
          <Link href="/tiendas">Tiendas</Link>
        </nav>
        <Link className="bag" href="/#catalogo">
          Volver al catálogo
        </Link>
      </header>

      <section className="wrap products-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">AGESTYLES · NOVEDADES</p>
            <h1>Lo último en llegar</h1>
            <p>Los productos más recientes de las tiendas, primero lo más nuevo.</p>
          </div>
        </div>
        {error ? (
          <div className="empty-state">
            <span>◌</span>
            <h3>Estamos preparando el catálogo</h3>
            <p>{error}</p>
          </div>
        ) : (
          <ProductExplorer
            products={newest}
            categories={categories}
            bestPrices={lowestOfferPrices(offers, currency)}
            totalProducts={newest.length}
          />
        )}
      </section>
    </main>
  );
}

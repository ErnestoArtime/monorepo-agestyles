import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@agestyles/icons";
import { getSellerDirectory } from "@/lib/catalog";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Tiendas",
  description: "Conoce las tiendas de AgeStyles y descubre sus productos y ofertas.",
  alternates: { canonical: "/tiendas" },
};

export default async function StoresPage() {
  const sellers = await getSellerDirectory();

  return (
    <main className="stores-directory-page">
      <section className="wrap stores-directory-intro">
        <div className="breadcrumbs">
          <Link href="/">Inicio</Link>
          <span>/</span>
          <span>Tiendas</span>
        </div>
        <p className="eyebrow">MARCAS Y COMERCIOS</p>
        <h1>Un lugar para cada descubrimiento.</h1>
        <p className="stores-directory-lede">
          Conoce a las tiendas que forman AgeStyles y explora lo que cada una tiene para ti.
        </p>
        <span className="stores-directory-count">
          {sellers.length} {sellers.length === 1 ? "tienda" : "tiendas"} para descubrir
        </span>
      </section>

      <section className="wrap stores-directory-section" aria-label="Tiendas disponibles">
        {sellers.length ? (
          <div className="stores-directory-grid">
            {sellers.map((seller, index) => (
              <Link
                className="stores-directory-card"
                href={`/tiendas/${seller.handle}`}
                key={seller.id}
              >
                <div className="stores-directory-banner">
                  {seller.banner ? (
                    <Image
                      src={seller.banner}
                      alt=""
                      fill
                      unoptimized
                      sizes="(max-width: 680px) 100vw, 50vw"
                    />
                  ) : (
                    <span>AGESTYLES / TIENDA {String(index + 1).padStart(2, "0")}</span>
                  )}
                </div>
                <div className="stores-directory-card-body">
                  <div className="stores-directory-logo">
                    {seller.logo ? (
                      <Image src={seller.logo} alt="" width={48} height={48} unoptimized />
                    ) : (
                      <span>{seller.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="stores-directory-card-copy">
                    <span className="store-index">{String(index + 1).padStart(2, "0")}</span>
                    <h2>{seller.name}</h2>
                    <p>
                      {seller.description || "Descubre la selección de esta tienda en AgeStyles."}
                    </p>
                    <div className="stores-directory-stats">
                      <span>
                        {seller.productCount} {seller.productCount === 1 ? "producto" : "productos"}
                      </span>
                      <span>
                        {seller.offerCount} {seller.offerCount === 1 ? "oferta" : "ofertas"}
                      </span>
                    </div>
                    <span className="store-arrow">
                      Explorar tienda <Icon name="arrowRight" size={12} />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h2>Las tiendas se están preparando.</h2>
            <p>Volveremos a mostrar el directorio en cuanto haya tiendas disponibles.</p>
          </div>
        )}
      </section>
    </main>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@agestyles/icons";

export const metadata: Metadata = { title: "Página no encontrada · AgeStyles" };

/** Unknown address: Spanish page inside the site's header and footer, never Next's default. */
export default function NotFound() {
  return (
    <main className="comparison-page">
      <section className="wrap comparison-content">
        <div className="comparison-heading">
          <p className="eyebrow">AGESTYLES · 404</p>
          <h1>Esta página no existe</h1>
          <p>Puede que el enlace esté mal escrito o que el producto ya no esté disponible.</p>
        </div>
        <Link className="button button-dark comparison-back" href="/#catalogo">
          <Icon name="arrowLeft" size={14} /> Ver el catálogo
        </Link>
      </section>
    </main>
  );
}

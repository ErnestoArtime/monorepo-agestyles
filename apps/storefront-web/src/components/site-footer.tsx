import Image from "next/image";
import Link from "next/link";
import { Icon } from "@agestyles/icons";

export function SiteFooter({ buyerAppUrl }: { buyerAppUrl: string }) {
  return (
    <footer className="site-footer">
      <div className="wrap footer-main">
        <Link href="/" className="brand">
          <Image src="/agestyles-mark.svg" alt="" width={28} height={28} />
          <span>AgeStyles</span>
        </Link>
        <p>Descubre. Compara. Elige.</p>
        <a href="mailto:hola@agestyles.com">
          Hablemos <Icon name="arrowRight" size={12} />
        </a>
      </div>
      <nav className="wrap footer-links" aria-label="Enlaces del pie">
        <Link href="/#catalogo">Catálogos</Link>
        <Link href="/novedades">Novedades</Link>
        <Link href="/tiendas">Tiendas</Link>
        <Link href="/comparar">Comparar productos</Link>
      </nav>
      <div className="wrap footer-bottom">
        <span>© 2026 AgeStyles</span>
        <span>AgeStyles en fase piloto</span>
        <a href={buyerAppUrl}>
          Conocer la app de compra <Icon name="arrowRight" size={12} />
        </a>
      </div>
    </footer>
  );
}

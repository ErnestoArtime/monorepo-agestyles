import type { Metadata } from "next"
import "./styles.css"
import "./seller-pages.css"

const siteUrl = process.env.SITE_URL || "https://catalogo.eav-labs.com"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "AgeStyles — Descubre, compara y elige", template: "%s | AgeStyles" },
  description: "Descubre productos de distintas tiendas, compara sus opciones y encuentra lo que buscas en AgeStyles.",
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: "AgeStyles",
    title: "AgeStyles — Descubre, compara y elige",
    description: "Productos de distintas tiendas en un solo lugar.",
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>
}

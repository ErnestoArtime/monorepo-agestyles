import type { Metadata } from "next";
import "./styles.css";
import "./seller-pages.css";
import "./site-chrome.css";
import { CartDrawer } from "@/components/cart-drawer";
import { CartProvider } from "@/components/cart-provider";
import { QuickViewProvider } from "@/components/quick-view";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPublicStoreConfig } from "@/lib/catalog";

const siteUrl = process.env.SITE_URL || "https://catalogo.eav-labs.com";

export const revalidate = 300;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "AgeStyles — Descubre, compara y elige", template: "%s | AgeStyles" },
  description:
    "Descubre productos de distintas tiendas, compara sus opciones y encuentra lo que buscas en AgeStyles.",
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: "AgeStyles",
    title: "AgeStyles — Descubre, compara y elige",
    description: "Productos de distintas tiendas en un solo lugar.",
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const buyerAppUrl = process.env.BUYER_APP_URL || "https://tienda.eav-labs.com";
  const config = await getPublicStoreConfig();
  return (
    <html lang="es">
      <body>
        <CartProvider config={config} buyerAppUrl={buyerAppUrl}>
          <QuickViewProvider buyerAppUrl={buyerAppUrl}>
            <SiteHeader />
            {children}
            <SiteFooter buyerAppUrl={buyerAppUrl} />
          </QuickViewProvider>
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}

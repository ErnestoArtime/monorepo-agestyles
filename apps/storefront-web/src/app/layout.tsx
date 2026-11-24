import type { Metadata } from "next";
import "./styles.css";
import "./seller-pages.css";
import "./site-chrome.css";
import { CartDrawer } from "@/components/cart-drawer";
import { CartProvider } from "@/components/cart-provider";
import { CookieBanner } from "@/components/cookie-banner";
import { GoogleAnalytics } from "@/components/google-analytics";
import { QuickViewProvider } from "@/components/quick-view";
import { WebVitalsReporter } from "@/components/web-vitals-reporter";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getMaintenance, getPublicStoreConfig } from "@/lib/catalog";

const siteUrl = process.env.SITE_URL || "https://catalogo.eav-labs.com";
/**
 * Search Console verification (AG-59, Fase 3): the code comes from the
 * GOOGLE_SITE_VERIFICATION variable, which Ernesto sets when he creates the
 * property in Search Console. No real code is invented here, so without the
 * variable the tag is simply not rendered.
 */
const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION || undefined;

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
  ...(googleSiteVerification ? { verification: { google: googleSiteVerification } } : {}),
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const buyerAppUrl = process.env.BUYER_APP_URL || "https://tienda.eav-labs.com";
  const [config, maintenance] = await Promise.all([getPublicStoreConfig(), getMaintenance()]);
  if (maintenance?.enabled) {
    return (
      <html lang="es">
        <body>
          <main className="comparison-page">
            <section className="wrap comparison-content">
              <div className="comparison-heading">
                <p className="eyebrow">AGESTYLES · MANTENIMIENTO</p>
                <h1>{maintenance.title}</h1>
                <p>{maintenance.message}</p>
                {maintenance.back_at ? <p>Volvemos {maintenance.back_at}.</p> : null}
              </div>
            </section>
          </main>
        </body>
      </html>
    );
  }
  return (
    <html lang="es">
      <body>
        <GoogleAnalytics />
        <WebVitalsReporter />
        <CartProvider config={config} buyerAppUrl={buyerAppUrl}>
          <QuickViewProvider buyerAppUrl={buyerAppUrl}>
            <SiteHeader />
            {children}
            <SiteFooter buyerAppUrl={buyerAppUrl} />
          </QuickViewProvider>
          <CartDrawer />
        </CartProvider>
        <CookieBanner />
      </body>
    </html>
  );
}

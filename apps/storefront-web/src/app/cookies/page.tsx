import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de cookies",
  description:
    "Qué cookies y datos guardados en tu navegador o app usa AgeStyles y cómo borrarlos.",
  alternates: { canonical: "/cookies" },
};

/**
 * Cookie policy (AG-59, Fase 1). Only what the apps actually store today:
 * cart id, an anonymous session id for view/click events, and app
 * preferences. No third-party cookies today; Google Analytics cookies
 * only arrive when GA4 is activated, after consent.
 */
export default function CookiesPage() {
  return (
    <main className="wrap legal-page">
      <p className="eyebrow">AGESTYLES · LEGAL</p>
      <h1>Política de cookies</h1>
      <p>Última actualización: 24 de noviembre de 2026.</p>

      <h2>Qué guardamos en tu navegador o app</h2>
      <ul>
        <li>
          <strong>Carrito.</strong> El identificador del carrito, para que no pierdas lo que has
          añadido al cambiar de página. Sin él, el carrito no funciona.
        </li>
        <li>
          <strong>Sesión anónima de estadísticas.</strong> Un identificador aleatorio que genera tu
          propio navegador o app y que solo sirve para contar las visitas y los clics en productos y
          tiendas sin identificarte. No contiene datos personales y no se comparte con terceros.
        </li>
        <li>
          <strong>Preferencias.</strong> Tu región, tu moneda de referencia y si prefieres el tema
          claro u oscuro, para no preguntártelo cada vez.
        </li>
        <li>
          <strong>Sesión.</strong> Si inicias sesión, se guarda lo necesario para reconocerte
          mientras usas la Tienda o Negocio, y nada más.
        </li>
      </ul>

      <h2>Cookies de terceros</h2>
      <p>
        Hoy no hay cookies de terceros. Google Analytics está previsto pero aún no activo: cuando se
        active, sus cookies solo se cargarán si aceptas las cookies de estadísticas, y esta página
        dirá cuáles son.
      </p>

      <h2>Cómo borrarlas</h2>
      <p>
        Puedes borrar las cookies y los datos guardados desde los ajustes de tu navegador o de la
        app. Si borras la sesión anónima, simplemente se genera otra nueva la próxima vez; si borras
        el carrito, se vacía. También puedes escribirnos a{" "}
        <a href="mailto:hola@agestyles.com">hola@agestyles.com</a> si tienes dudas sobre estos
        datos.
      </p>

      <h2>Cambios</h2>
      <p>
        Si empezamos a usar cookies nuevas — por ejemplo, las de Google Analytics — esta página se
        actualizará antes de que se activen.
      </p>
    </main>
  );
}

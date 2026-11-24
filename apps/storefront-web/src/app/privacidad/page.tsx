import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description:
    "Qué datos recoge AgeStyles, para qué los usa y cómo pedir su corrección o eliminación.",
  alternates: { canonical: "/privacidad" },
};

/**
 * Privacy policy (AG-59, Fases 1 y 4). Honest about what exists today: Google
 * Analytics is installed in the code but inactive until the visitor accepts
 * the statistics cookies and a measurement ID is configured — today there is
 * no ID, so nothing is sent to Google. Anonymous first-party view/click
 * events, and the data orders and payments need. The legal identity of the
 * controller is not in the repository, so it stays as a visible marker
 * until Ernesto fills it in — it must not be invented.
 */
export default function PrivacyPage() {
  return (
    <main className="wrap legal-page">
      <p className="eyebrow">AGESTYLES · LEGAL</p>
      <h1>Política de privacidad</h1>
      <p>Última actualización: 24 de noviembre de 2026.</p>

      <h2>Responsable</h2>
      <p>
        AgeStyles es el marketplace que publica este catálogo. [PENDIENTE: nombre o identidad legal
        del responsable y domicilio — no consta en el proyecto y no debe inventarse.]
      </p>
      <p>
        Contacto para cualquier cuestión sobre tus datos:{" "}
        <a href="mailto:hola@agestyles.com">hola@agestyles.com</a>.
      </p>

      <h2>Qué datos recogemos y para qué</h2>
      <ul>
        <li>
          <strong>Pedidos y pagos.</strong> Para tramitar una compra necesitamos tus datos de
          contacto y de entrega, y el comprobante cuando pagas por transferencia, depósito o
          efectivo. Las tiendas solo ven los pedidos que les corresponden; la administración del
          marketplace ve los pedidos para gestionarlos.
        </li>
        <li>
          <strong>Tu cuenta.</strong> Si creas una cuenta, guardamos tu correo y tus pedidos,
          favoritos y datos de entrega para que no tengas que escribirlos cada vez.
        </li>
        <li>
          <strong>Eventos anónimos de visitas y clics.</strong> Cuando ves un producto o una tienda,
          o pulsas «Añadir al carrito», registramos el producto, la tienda, el tipo de acción, si
          estabas en la vitrina, en la Tienda web o en la app, y un identificador anónimo de sesión
          que genera tu propio navegador o app. No guardamos tu dirección IP, tu agente de usuario
          ni ningún dato personal en estos registros, y la fecha es la de nuestro servidor. Sirven
          para que cada tienda sepa qué productos se ven y se pulsan, y se borran a los 90 días.
        </li>
        <li>
          <strong>Google Analytics.</strong> El código de Google Analytics 4 está instalado en la
          vitrina y en la Tienda web, pero inactivo por defecto: solo se carga si aceptas las
          cookies de estadísticas y solo si hay un identificador de propiedad configurado. Hoy no
          hay identificador, así que no se envía ningún dato a Google. Cuando se active, medirá las
          páginas visitadas, los productos vistos, los añadidos al carrito y los inicios de compra,
          con la dirección IP anonimizada; puedes oponerte rechazando las cookies de estadísticas en
          el aviso o borrando tu elección desde la política de cookies.
        </li>
      </ul>

      <h2>Con quién se comparten</h2>
      <p>
        No vendemos ni cedemos tus datos. Los pedidos se comparten con la tienda que los prepara y
        con la administración del marketplace, y nada más. Los eventos anónimos no identifican a
        nadie, así que no se comparten con nadie fuera de AgeStyles.
      </p>

      <h2>Cuánto se guardan</h2>
      <p>
        Los pedidos se guardan mientras haga falta para gestionarlos y para las obligaciones que
        correspondan. Los eventos anónimos de visitas y clics se borran a los 90 días.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Puedes pedir ver, corregir o eliminar tus datos personales, y oponerte a su uso, escribiendo
        a <a href="mailto:hola@agestyles.com">hola@agestyles.com</a>. Responderemos a tu solicitud;
        si no estás de acuerdo con la respuesta, puedes reclamar ante la autoridad de protección de
        datos que te corresponda.
      </p>

      <h2>Cambios</h2>
      <p>
        Si esta política cambia — por ejemplo, cuando se configure el identificador de Google
        Analytics — la fecha de arriba cambiará y el cambio se reflejará aquí antes de aplicarse.
      </p>
    </main>
  );
}

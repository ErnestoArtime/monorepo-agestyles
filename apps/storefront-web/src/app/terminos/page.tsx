import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos de uso",
  description:
    "Condiciones para comprar en AgeStyles y para las tiendas que venden en el marketplace.",
  alternates: { canonical: "/terminos" },
};

/**
 * Terms of use (AG-59, Fase 1). Only what the project actually does today:
 * pilot phase, real orders, USD prices with an informational CUP
 * equivalent, manual payments. Returns and the controller's legal identity
 * are not defined in the repository, so they stay as visible markers
 * instead of invented rules.
 */
export default function TermsPage() {
  return (
    <main className="wrap legal-page">
      <p className="eyebrow">AGESTYLES · LEGAL</p>
      <h1>Términos de uso</h1>
      <p>Última actualización: 24 de noviembre de 2026.</p>

      <h2>Qué es AgeStyles</h2>
      <p>
        AgeStyles es un marketplace: varias tiendas publican sus productos en un solo catálogo y
        cada tienda prepara y entrega sus propios pedidos. AgeStyles publica el catálogo, cobra el
        pedido a través de la tienda cuando corresponde y gestiona la plataforma. [PENDIENTE: nombre
        o identidad legal del responsable — no consta en el proyecto y no debe inventarse.]
      </p>
      <p>
        AgeStyles está en fase piloto: los pedidos son reales, y si algo falla, avísanos a{" "}
        <a href="mailto:hola@agestyles.com">hola@agestyles.com</a>.
      </p>

      <h2>Precios y pagos</h2>
      <ul>
        <li>
          Los precios se muestran en USD. La equivalencia en CUP, cuando aparece, es solo una
          referencia informativa y se cobra en USD.
        </li>
        <li>
          El precio y la disponibilidad finales dependen de la tienda y de la variante elegida; el
          carrito muestra el precio antes de confirmar el pedido.
        </li>
        <li>
          Según la tienda, el pago puede hacerse por los medios que la tienda ofrece, incluido el
          comprobante manual de transferencia, depósito o efectivo, que la administración verifica
          antes de preparar el pedido.
        </li>
      </ul>

      <h2>Pedidos y entregas</h2>
      <p>
        Cada tienda indica si entrega a domicilio o con recogida, y sus horarios. Cuando confirmas
        un pedido, la tienda lo prepara y te informa de su estado: sin preparar, en preparación,
        listo, despachado y entregado.
      </p>
      <p>
        [PENDIENTE: política de devoluciones, cambios y cancelaciones — no está definida en el
        proyecto; cada tienda informará de sus condiciones hasta que se publique una política
        común.]
      </p>

      <h2>Contenido y uso de la plataforma</h2>
      <ul>
        <li>
          Los nombres, fotos, descripciones y precios de los productos los publican las tiendas y
          son responsabilidad de cada tienda.
        </li>
        <li>
          No está permitido usar la plataforma para publicar contenido engañoso, copiar contenido
          ajeno o interferir con su funcionamiento.
        </li>
        <li>
          AgeStyles puede retirar un producto o una tienda que incumpla estos términos o la ley
          aplicable.
        </li>
      </ul>

      <h2>Responsabilidad</h2>
      <p>
        AgeStyles se esfuerza por que el catálogo, los precios y el stock sean correctos, pero la
        información la publica cada tienda. Si un pedido llega con un problema, escríbenos a{" "}
        <a href="mailto:hola@agestyles.com">hola@agestyles.com</a> y lo gestionamos con la tienda.
      </p>

      <h2>Cambios</h2>
      <p>
        Estos términos pueden cambiar cuando el marketplace salga de la fase piloto o añada
        servicios. La fecha de arriba indica la versión vigente.
      </p>
    </main>
  );
}

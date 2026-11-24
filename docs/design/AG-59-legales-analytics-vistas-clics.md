# AG-59 — Las 4 cosas de Domenek.studio + vistas y clics por tienda y producto

**Estado:** implementado en rama, revisión pendiente · **Prioridad:** P1 ·
**Pedido del usuario (24 nov 2026).** Reel de Domenek.studio
(Facebook 2325850368252840, 4 nov 2026): antes de contratar una web, pedir
páginas legales, análisis de rendimiento, Google Search Console y Google
Analytics. Ernesto pidió revisar si AgeStyles las cubre, un plan para lo que
falte, y que desde Negocio se vean por tienda y producto las visualizaciones
y los clics. Todo se hizo en la rama `muse/legales-eventos-vistas`, PR #4,
sin tocar `main` ni desplegar. El diseño de los eventos propios vive en
`docs/adr/ADR-006-product-events.md`; este documento es el proceso completo.

## Estado inicial verificado (main 836cfef, 24 nov 2026)

| Cosa | Estado |
|---|---|
| Páginas legales | No existían: ni `/privacidad`, ni `/terminos`, ni `/cookies`, en ninguna app |
| Rendimiento medido | Mucho trabajo de rendimiento hecho, pero sin medición continua: ni Lighthouse en CI, ni web-vitals |
| Search Console | `sitemap.xml` y `robots.txt` sí existían en `storefront-web`; sin verificación de la propiedad ni evidencia de registro |
| Google Analytics | Nada: ni GA4, ni gtag, ni GTM, ni banner de consentimiento |
| Vistas y clics por tienda/producto | Nada: el «Análisis» de Negocio (AG-39) es solo ventas; ningún evento de vista o clic en el código |

## Fase 1 — Páginas legales (hecha en el PR #4, primera entrega)

Rutas nuevas en `apps/storefront-web/src/app/{privacidad,terminos,cookies}/page.tsx`
(metadatos + canonical, estilo `.legal-page` en `site-chrome.css`), enlazadas
desde `SiteFooter` y desde el pie de Tienda
(`packages/buyer-experience/src/components/web-footer.tsx`, columna «Legal» a
`catalogo.eav-labs.com`). El texto declara los eventos anónimos, los pedidos y
los pagos, y GA4 como instalado pero inactivo (ver Fase 4). Contacto
`hola@agestyles.com` (ya estaba en el pie del catálogo).

[PENDIENTE] en el texto, sin inventar: identidad legal y domicilio del
responsable, y política de devoluciones y cancelaciones. No constan en el
repo; los tiene que dar Ernesto.

## Fase 2 — Rendimiento medido

- **Web Vitals en la vitrina.** `apps/storefront-web/src/lib/web-vitals.ts`
  mide LCP, INP y CLS con PerformanceObserver, sin dependencia nueva — añadir
  el paquete `web-vitals` habría exigido regenerar `pnpm-lock.yaml`, que el
  sandbox no puede hacer (ver PR #4) — y
  `apps/storefront-web/src/components/web-vitals-reporter.tsx` (montado en el
  layout) los envía a GA4 como eventos `web_vitals` cuando GA4 está activo;
  en desarrollo los escribe en la consola. Umbrales de Google: LCP 2,5 s /
  4 s, INP 200 ms / 500 ms, CLS 0,1 / 0,25. No hay agregación en el servidor
  todavía: los números de usuario real viven en GA4; Lighthouse en CI es el
  control que rompe la compilación.
- **Lighthouse en CI.** `tools/scripts/check-lighthouse-budgets.mjs` nuevo y
  paso nuevo en `.github/workflows/ci.yml` después de `Build the SEO storefront`
  (movido antes de parar la API desechable, para medir las páginas con los
  datos sembrados del lab, no vacías): arranca la vitrina contra la API
  desechable (`http://127.0.0.1:19081`), audita `/`, `/tiendas` y `/novedades`
  con `--preset=desktop`, comprueba los presupuestos y sube los informes HTML
  como artefacto `lighthouse-storefront` siempre. Presupuestos de partida:
  rendimiento ≥ 0,8; accesibilidad, buenas prácticas y SEO ≥ 0,9; LCP ≤ 3000 ms;
  CLS ≤ 0,1; INP ≤ 300 ms. Si el primer run real queda por debajo, se mira el
  informe, se arregla lo que señale y solo entonces se retoca el presupuesto
  con el motivo escrito aquí. El preset es de escritorio para una base
  estable en CI; la auditoría móvil es un paso posterior (los usuarios reales
  son mayoritariamente móviles).
- **Si el push da 403 en `ci.yml`** (como en el PR #3, GitHub no deja subir
  workflows por API ni por snapshot), el paso NO entra en el PR: el YAML
  listo para pegar a mano está en `docs/ci/lighthouse-manual-apply.md`, con
  su punto de inserción exacto.

## Fase 3 — Search Console

El layout de la vitrina (`apps/storefront-web/src/app/layout.tsx`) añade
`verification: { google: ... }` solo cuando existe la variable
`GOOGLE_SITE_VERIFICATION` (documentada en `apps/storefront-web/.env.example`).
No se inventó ningún código: sin la variable, no se renderiza el meta tag.

Pasos que solo Ernesto puede hacer, en orden:

1. En [Search Console](https://search.google.com/search-console), crear la
   propiedad de `https://catalogo.eav-labs.com` (prefijo de URL).
2. Elegir la verificación por etiqueta HTML y copiar el código que da Google.
3. Ponerlo como `GOOGLE_SITE_VERIFICATION` en el despliegue de la vitrina
   (nunca en el repo) y desplegar.
4. Pulsar «Verificar» en Search Console.
5. Enviar el sitemap, que ya existe: `https://catalogo.eav-labs.com/sitemap.xml`.
6. Cada mes, revisar: cobertura (páginas indexadas frente a enviadas),
   errores de rastreo, y las consultas por las que aparece el catálogo.

## Fase 4 — Google Analytics 4, solo con consentimiento

- **Vitrina.** `apps/storefront-web/src/lib/google-analytics.ts`
  (`gaEvent`, `gaPageView`, `GA_MEASUREMENT_ID`) y
  `apps/storefront-web/src/components/google-analytics.tsx`: el script de
  gtag solo se monta cuando el visitante aceptó las cookies de estadísticas
  y hay un measurement ID (`NEXT_PUBLIC_GA_MEASUREMENT_ID`, en
  `apps/storefront-web/.env.example`). Sin ID — hoy — no sale nada hacia
  Google y cada llamada es un no-op silencioso. `send_page_view` está
  desactivado y las vistas de página se envían a mano al cambiar de ruta.
  Eventos: `page_view`, `view_item` (ficha, con precio de salida),
  `add_to_cart` (panel de compra) y `begin_checkout` («Ir a pagar» en el
  cajón del carrito). El CSP de informe en `next.config.ts` permite los
  dominios de Google solo para esto.
- **Banner de consentimiento.** `apps/storefront-web/src/components/cookie-banner.tsx`
  (vitrina) y `packages/buyer-experience/src/components/cookie-banner.tsx`
  (Tienda web), con la elección en `agestyles.consent.analytics`
  (localStorage en la vitrina, AsyncStorage en Tienda). Tienda es otro
  origen, así que el visitante vuelve a elegir allí; el banner enlaza con la
  política de cookies del catálogo. Rechazar no carga nada de Google y la
  web funciona igual.
- **Tienda (Expo, solo web).** `packages/buyer-experience/src/lib/google-analytics.ts`
  (inyección del script por DOM) y `.../src/components/google-analytics.tsx`,
  montados en `packages/buyer-experience/src/routes/_layout.tsx`. Eventos:
  `view_item` y `add_to_cart` en `product-detail.tsx`; `page_view` lo envía
  la configuración inicial de gtag al abrir la app, no en cada pantalla
  (Expo Router no dispara vistas de página como Next). La variable es
  `EXPO_PUBLIC_GA_MEASUREMENT_ID` (`apps/buyer-app/.env.example`).
- **Qué no se mide en GA4 (decisión deliberada).** `begin_checkout` solo se
  envía en la vitrina, al pulsar «Ir a pagar»: si Tienda lo enviara también
  al abrir su pantalla de checkout, el mismo checkout contaría dos veces.
  Los checkouts que nacen dentro de Tienda no tienen `begin_checkout` en
  GA4; su embudo se ve en los eventos propios (Fase 5 → Fase 6).
- **App nativa Android: fuera.** GA4 no se instala igual en nativo
  (necesitaría Firebase) y queda como pendiente explícito.
- **Textos legales.** `/privacidad` y `/cookies` ya no dicen que GA4 está
  «previsto»: dicen que está instalado pero inactivo sin consentimiento y
  sin identificador, qué mide cuando se active y cómo oponerse.

## Fase 5 — Eventos propios de vistas y clics (hecha en el PR #4, primera entrega)

Resumen (detalle en `docs/adr/ADR-006-product-events.md`): módulo nuevo
`packages/product-events` (`agestyles_product_event`: `product_id` nulo en
`store_view`, `seller_id`, tipo, superficie, `session_id` anónimo; sin IP ni
datos personales), migración, validación, servicio con deduplicación de 60 s
y test de reglas. Ruta pública `POST /store/agestyles/events` con zod y
límite en memoria de 60/min por IP (429). Job diario
`agestyles-purge-product-events` (04:30, retención 90 días). Eventos
`product_view`, `store_view`, `product_click`, `add_to_cart_click` desde la
ficha y la página de tienda en la vitrina y desde la ficha en Tienda.

## Fase 6 — Vistas y clics en Negocio

- **Servidor.** `apps/commerce-api/src/lib/analytics.ts`: `buildAnalytics`
  acepta `trafficEvents` y `trafficProducts` y devuelve `traffic` con
  vistas de tienda, vistas de producto, clics, clics en «Añadir al
  carrito», CTR (clics / vistas de producto), serie diaria y los 10
  productos más vistos con vistas, clics, CTR, añadidos al carrito, pedidos
  del período que los contienen y unidades vendidas. Los pedidos se cruzan
  con lo que AG-39 ya calcula; un producto con vistas y sin pedidos aparece
  en vez de esconderse. La ruta
  `apps/commerce-api/src/api/vendor/agestyles/analytics/route.ts` lee los
  eventos de la tienda en el período (`listProductEvents` con
  `seller_id` y `created_at` entre `from` y `to`, tope 20.000) y los títulos
  de las ofertas de la tienda; si la lectura de eventos falla, el tráfico
  queda vacío en vez de tumbar todo el panel.
- **Aislamiento entre tiendas.** La ruta ya resolvía el actor con
  `resolveCommissionActor`: el vendedor solo ve los eventos de la tienda
  seleccionada, nunca los de otra. No se añadió un agregado multi-tienda:
  el superadmin ve todas las tiendas seleccionando cada una, como ya hace
  con las ventas; una vista global de todas las tiendas a la vez es un paso
  posterior, no parte de esta entrega.
- **Pantalla.** `apps/business-app/app/analytics.tsx`: KPIs de vistas de
  tienda, vistas de producto, clics y CTR, gráfico «Vistas por día» y
  sección «Productos más vistos», con los mismos períodos (7/30/90 días,
  este mes). El panel de ventas no se rehízo. Las vistas se cuentan desde
  que se publicó esta versión; los días anteriores muestran cero y la
  pantalla lo dice.
- **Test.** `apps/commerce-api/test/analytics.test.mjs` añade el caso de
  tráfico: totales, CTR, serie diaria, producto con vistas y sin ventas
  (título desde las ofertas) y evento fuera del período que no cuenta.

## Decisiones asumidas (Ernesto no respondió a las preguntas de la Fase 0)

- Vistas totales, no únicas por sesión (ADR-006). Reversible en la
  agregación, sin tocar la recogida.
- Retención de 90 días, purga diaria (ADR-006).
- Sesión anónima generada en el cliente (ADR-006).
- GA4 solo con consentimiento y solo con measurement ID; sin ID, inactivo.
- Límite de eventos en memoria (60/min por IP), como el resto de la API;
  el paso a Redis sigue pendiente, como recoge la auditoría de seguridad.
- Presupuestos Lighthouse de partida (Fase 2) y preset de escritorio.
- `begin_checkout` solo en la vitrina (Fase 4).

## Alternativas descartadas

- **Solo Google Analytics para vistas y clics:** no atribuye por vendedor
  sin trabajo manual por tienda y no pertenece a AgeStyles (ADR-006).
- **Paquete `web-vitals`:** habría exigido regenerar `pnpm-lock.yaml`;
  PerformanceObserver cubre las tres métricas sin dependencia nueva.
- **`begin_checkout` también en Tienda:** contaría dos veces el mismo
  checkout que ya se midió en la vitrina.
- **Agregado multi-tienda para el superadmin:** no se hizo; el superadmin
  selecciona cada tienda, como con las ventas.

## Modelo de datos

`agestyles_product_event` (ver `packages/product-events/src/models/product-event.ts`):
`id` (`pevt_…`), `product_id` (nulo en `store_view`), `seller_id`, `type`
(`product_view`, `store_view`, `product_click`, `add_to_cart_click`),
`surface` (`vitrina`, `tienda-web`, `tienda-app`), `session_id` (aleatorio
del cliente), `created_at`/`updated_at` del servidor, borrado lógico.
Índices por `seller_id`, `product_id`, `created_at` y
(`session_id`, `type`, `created_at`). Sin IP, sin agente de usuario, sin
fecha del cliente, sin datos personales.

## Privacidad

- Los eventos propios no identifican a nadie y no salen de AgeStyles; se
  borran a los 90 días. Lo dicen `/privacidad` y `/cookies`.
- GA4 solo carga con consentimiento, con IP anonimizada, y sus cookies
  (`_ga`, `_ga_*`) solo existen entonces. Rechazar no cambia nada de la web.
- Las vistas de una tienda solo las ve esa tienda (y el superadmin
  seleccionándola).

## Cómo verificarlo en laboratorio

1. Levantar el lab (`pnpm lab:up`, migrar, sembrar) y la vitrina y Tienda
   contra él, como en AG-51/AG-53.
2. Legales: abrir `/privacidad`, `/terminos`, `/cookies` en la vitrina y
   comprobar los enlaces del pie en vitrina y Tienda.
3. Eventos: abrir una ficha en la vitrina y en Tienda, pulsar un producto
   en la página de una tienda y añadir al carrito; comprobar en la base
   (`agestyles_product_event`) que hay una fila por vendedor y tipo, sin IP.
4. Negocio: entrar en «Análisis» de una tienda y comprobar los KPIs, el
   gráfico y «Productos más vistos»; entrar con otra tienda y comprobar que
   no ve los datos de la primera (aislamiento).
5. GA4: sin `NEXT_PUBLIC_GA_MEASUREMENT_ID`, comprobar que no hay ninguna
   petición a Google aunque se acepte; con un ID de prueba y aceptando,
   comprobar que cargan `gtag/js` y los eventos `page_view`, `view_item`,
   `add_to_cart` y `begin_checkout`; rechazando, que no carga nada.
6. Banner: borrar `agestyles.consent.analytics` y comprobar que vuelve a
   aparecer; aceptar y comprobar que no vuelve.
7. Search Console: poner un código inventado en `GOOGLE_SITE_VERIFICATION`
   solo en el lab y comprobar que el HTML trae el meta
   `google-site-verification`; quitarlo después.
8. Rendimiento: correr el job de CI en la rama y revisar el artefacto
   `lighthouse-storefront`; en desarrollo, abrir la consola y comprobar los
   `[web-vitals]` en `development`.

## Qué NO se verificó

- App corriendo, migración ejecutada contra una base de datos, despliegue ni
  comportamiento en navegador o dispositivo.
- Typecheck completo: sin `node_modules` en la copia de trabajo, tsc solo
  reporta módulos sin resolver.
- Lighthouse nunca corrió de verdad: el paso de CI solo existe; su primer
  run real es en la rama.
- GA4 nunca se probó con un ID real (no existe todavía) ni Search Console
  con una propiedad real.
- `pnpm-lock.yaml` sin regenerar (añade `@agestyles/product-events` a la
  API); se regenera en el merge, como ocurrió con el PR #3.

## Pasos externos que solo Ernesto puede hacer

1. Crear la propiedad de Google Analytics 4 y dar el measurement ID
   (`G-…`) para `NEXT_PUBLIC_GA_MEASUREMENT_ID` (vitrina) y
   `EXPO_PUBLIC_GA_MEASUREMENT_ID` (Tienda web). Sin él, GA4 sigue inactivo.
2. Crear la propiedad en Search Console, verificarla con el meta tag
   (Fase 3) y enviar el sitemap.
3. Completar la identidad legal y el domicilio del responsable y la
   política de devoluciones y cancelaciones en las páginas legales.
4. Si el push da 403 en `.github/workflows/ci.yml`, pegar el paso de
   Lighthouse a mano con `docs/ci/lighthouse-manual-apply.md`.
5. Revisar y fusionar el PR #4, y desplegar (API con su migración,
   vitrina y Tienda).
6. Decidir las preguntas abiertas de la Fase 0 si quiere cambiarlas:
   vistas únicas en vez de totales, otra retención, GA4 en la app nativa
   Android (necesita Firebase) y vista global multi-tienda para el
   superadmin.

# Registro de trabajo compartido con Codex

**Propósito:** dejar constancia de lo que modifica la sesión OpenCode para que Codex lo revise antes de dar por cerrada una fase. No sustituye al plan maestro ni al status: los complementa.

**Regla de coordinación:** antes de tocar un archivo, revisar `git status`; después de tocar, registrar aquí el cambio, el comando de verificación y su resultado. Si Codex ya implementó algo, la entrada lo dice y no se duplica.

---

## Turno 2026-11-17 00:40–01:00 — Lote 0 y reconciliación

**Contexto:** Codex estaba trabajando en `commerce-api`, `storefront-web` y `business-app` con cambios sin commit.

| Cambio | Archivos | Verificación |
|---|---|---|
| Contratos de catálogo | `packages/domain/src/catalog.ts`, `src/index.ts`, `src/fixtures/offers.ts`, `package.json` | `pnpm --filter @agestyles/domain typecheck` |
| Proyección de ofertas | `packages/api-client/src/offers.ts`, `src/store.ts` (`seller.handle`), `package.json` | `pnpm --filter @agestyles/api-client typecheck` |
| Matriz de reutilización | `docs/MATRIZ_REUTILIZACION.md` (nuevo), enlace en `docs/STATUS_PLAN_MAESTRO.md` | revisión manual |
| Tickets | `docs/tickets/LOTE-0-CONTRATOS.md`, `docs/tickets/LOTE-1-VITRINA.md` | revisión manual |

**Hallazgo:** la vitrina (comparación por vendedor) ya estaba hecha en web y nativa; el ticket de Lote 1 se reescribió como consolidación de consultas, no como construcción.

---

## Turno 2026-11-17 01:40–02:20 — Cobertura de typecheck, contrato de cotización y consolidación de ofertas

**Contexto:** Codex movió la cotización a `packages/quotations`, la amplió a carrito completo multi-vendedor y creó `packages/features-buyer`.

| Cambio | Archivos | Verificación |
|---|---|---|
| Typecheck del módulo de cotización (antes no entraba en CI) | `packages/quotations/tsconfig.json`, script `typecheck` en su `package.json` | `pnpm --filter @agestyles/quotations typecheck` → OK |
| Typecheck de tokens (paquete sin verificación) | `packages/design-tokens/tsconfig.json`, script `typecheck` | `pnpm --filter @agestyles/design-tokens typecheck` → OK |
| **No** se añadió typecheck a `@agestyles/icons` | — | Requiere `@types/react`; los apps que lo consumen ya lo verifican de forma transitiva. Decisión reversible si Codex prefiere un task propio |
| Contrato de cotización corregido al modelo real | `packages/domain/src/order-quotes.ts`, `packages/api-client/src/order-quotes.ts` | `pnpm --filter @agestyles/domain --filter @agestyles/api-client typecheck` → OK |
| Consolidación de ofertas: `listProductOffers` admite `variantId`/`regionId`; ficha nativa migrada; `listOffers` deprecada y sin consumidores | `packages/api-client/src/offers.ts`, `src/store.ts`, `apps/buyer-app/app/(drawer)/(tabs)/(home)/product/[id].tsx` | `pnpm typecheck` → 9/9; búsqueda de `listOffers` solo devuelve la definición; export web de buyer OK |

**Corrección importante:** la primera versión de los tipos asumía cotización por vendedor (`seller_id`, `order_id`). Codex evolucionó el módulo a **carrito completo**: `seller_ids: string[]`, `order_group_id`, y aceptación que devuelve `orders: [{ id, seller_id }]`. Los tipos y el cliente ya reflejan ese contrato.

### Evidencia end-to-end (laboratorio aislado)
Comando: `node --env-file=apps/buyer-app/.env.local apps/commerce-api/scripts/verify-order-quotes.mjs`

Resultado:

```json
{"quoteId":"01M7KEWDMYGW26W61D1THNHXA0",
 "orderGroupId":"og_01M7KEWG6T48HSVG423BAA5T2N",
 "childOrders":[{"id":"order_01M7KEWG7J2VCZG07101W4NRGR","seller_id":"sel_01M7K70Z5STVKS9W61ZTY8CWZD"},
                {"id":"order_01M7KEWG7J48Y59XE23CRKG7RX","seller_id":"sel_01M7K70ZF4HSWY4Z83QPNDE039"}],
 "concurrencyAttempts":5,"initialConflicts":4,
 "expiryProbeQuoteId":"01M7KEWK9FV3WS3MCW3SDZ1M0J"}
```

Y en la salida del helper: `Expired quote rejected: status=expired, no order accepted.`

Cubre: cotización de carrito con dos vendedores, claves de idempotencia, rechazo de revisión obsoleta, cinco aceptaciones concurrentes que convergen en **un** grupo con **dos** pedidos hijos, y expiración sin pedido. Es el criterio de salida de quote-first en F1.

### Empaquetado de la app compradora

Comando: `pnpm --filter @agestyles/buyer-app exec expo export --platform web --output-dir /tmp/opencode/buyer-web-check`

Resultado: `exit=0`, bundle web de 5 MB en `_expo/static/js/web/entry-*.js`. Confirma que Metro resuelve la nueva entrada `@agestyles/api-client/offers` en la ficha de producto, no solo TypeScript.

---

## Turno 2026-11-17 02:30–04:00 — Lote 2 PIM v1 (familia y versión)

**Contexto:** Codex seguía con cambios sin commit en `commerce-api`, `storefront-web`, `business-app` y `packages/features-buyer`. No se tocó ninguno de sus archivos en curso salvo `apps/commerce-api/medusa-config.ts` y `apps/commerce-api/package.json`, que son puntos de registro inevitables.

| Cambio | Archivos | Verificación |
|---|---|---|
| Contrato compartido de PIM: `CatalogField`, `CatalogFamilySummary`, `CatalogFamilyVersion`, `CatalogCompatibility`, `compareCatalogProducts` (regla version-scoped portada de Catalogo) | `packages/domain/src/catalog-pim.ts`, `src/index.ts`, `package.json` | `pnpm --filter @agestyles/domain typecheck` → OK |
| Módulo Medusa propio `@agestyles/catalog-pim`: modelos, servicio, validación, mapeo a Mercur | `packages/catalog-pim/**` | `pnpm --filter @agestyles/catalog-pim typecheck` → OK |
| Migración generada por el módulo (sin SQL a mano) | `packages/catalog-pim/src/migrations/Migration20261117004833.ts` + snapshot | `medusa db:generate agestylesCatalogPim` → `Generated successfully` |
| Registro del módulo | `apps/commerce-api/medusa-config.ts`, `apps/commerce-api/package.json` (deps `@agestyles/domain`, `@agestyles/catalog-pim`) | `pnpm typecheck` → 10/10 |
| API admin: listar/crear familia (valida categoría real), crear versión, publicar | `apps/commerce-api/src/api/admin/catalog-families/**` | `verify-catalog-pim-http.ts` |
| API store pública: solo familia activa con versión publicada | `apps/commerce-api/src/api/store/catalog-families/[handle]/route.ts` | ídem |
| Pruebas de reglas | `packages/catalog-pim/test/catalog-pim.test.ts`, script `test` | `pnpm --filter @agestyles/catalog-pim test` → PASS |
| Verificadores de laboratorio | `apps/commerce-api/src/scripts/verify-catalog-pim.ts`, `verify-catalog-pim-http.ts` | ambos OK |
| ADR y ticket | `docs/adr/ADR-004-catalog-family-versioning.md`, `docs/tickets/LOTE-2-PIM.md` | revisión manual |

**Resultado de los verificadores:**

- `verify-catalog-pim.ts`: crea familia + borrador v1, publica v1 (`frozen_at`), crea v2 borrador, confirma que v1 publicada no cambia (`maximum` sigue 240), publica v2 y deja v1 archivada; rechaza handle duplicado, campo inválido (`unit` en `text`) y segundo borrador. Limpia todo al final.
- `verify-catalog-pim-http.ts`:

```json
{"created":201,"listed":1,"publishedVersion":2,"storeReturnsPublished":true,
 "draftLeakBlocked":true,"crossFamilyPublishBlocked":true,"unknownCategoryRejected":true}
```

**Nota operativa (importante para Codex):** el contenedor `agestyles-buyer-api` no monta el repositorio y ejecuta una imagen anterior, así que las rutas nuevas **no** están expuestas en `http://127.0.0.1:19081`. Los handlers se verificaron invocándolos con el contenedor real de Medusa vía `medusa exec`; para probarlas por HTTP hay que reconstruir la imagen o arrancar `medusa develop`.

**Decisiones que Codex debe revisar:**

1. `category_id` referencia `product_category.id` de Medusa, no el `category_slug` heredado (ADR-004 §2).
2. Los atributos/valores se quedan en Mercur; la familia guarda `attribute_handle`/`option_handles`. `option_ids` de Catalogo no se portan.
3. Las escrituras son de plataforma; la autenticación admin la pone el framework por el prefijo `/admin`, sin middleware propio.
4. `model.json()` está tipado como objeto y el snapshot es un array: el cruce se hace en `toFieldsJson` (un solo punto documentado).

**Pendiente declarado, no oculto:** persistir `catalog_family_version_id` en productos y el comparador 2–4 productos quedan para el siguiente incremento. El criterio de aceptación #2 del ticket se cumple a nivel de contrato de comparación, no de persistencia.

---

## Turno 2026-11-17 04:10–05:00 — Producto → versión publicada y comparación pública

**Contexto:** continuación del Lote 2 sobre lo ya verificado. No se tocó código de Codex en curso.

| Cambio | Archivos | Verificación |
|---|---|---|
| Regla pura `validateCatalogSpecifications` (campos de la versión, requeridos, tipos, opciones, mín/máx, normalización) en el paquete compartido | `packages/domain/src/catalog-pim.ts` | prueba en `packages/catalog-pim/test/catalog-pim.test.ts` |
| Asignación producto → versión publicada mediante `metadata` del producto (`catalog_family_id`, `catalog_family_version_id`, `catalog_specifications`), con rechazo de borradores y de valores inválidos | `apps/commerce-api/src/api/admin/products/[id]/catalog-family/route.ts` | `verify-catalog-product-assignment.ts` |
| Lectura pública de comparación 2–4 productos publicados; ignora versiones en borrador y no expone productos no publicados | `apps/commerce-api/src/api/store/catalog-comparison/route.ts` | ídem |
| Servicio: `getPublishedVersionById` (solo publicadas) y `getVersionById` (lectura tipada) | `packages/catalog-pim/src/service.ts` | typecheck |
| Verificador de laboratorio | `apps/commerce-api/src/scripts/verify-catalog-product-assignment.ts` | OK |

**Resultado del verificador:**

```json
{"assignedA":"Voltaje=220","assignedB":"Voltaje=110","comparedRows":2,
 "sameVersionCompatible":true,"draftAssignmentRejected":true,
 "invalidValuesRejected":true,"hiddenFieldExcluded":true,"missingFamilyReported":true}
```

Cubre: rechazo de versión en borrador, rechazo de campo desconocido / fuera de rango / opción inválida / requerido ausente, normalización al publicar la asignación, persistencia en `metadata`, comparación de dos productos de la misma versión excluyendo campos `comparable: false`, producto sin familia reportado como `family_missing`, y limpieza de datos.

**Nota técnica para Codex:** `apps/commerce-api` compila a CommonJS y `@agestyles/domain` es ESM; las rutas cargan las reglas puras con un `import()` dinámico cacheado en vez de un import de valor (TypeScript lo rechaza). Si se prefiere un import estático, la alternativa es un paquete de reglas propio o cambiar la estrategia de módulos del app; no se hizo para no tocar la configuración de build de Medusa.

**Pendiente declarado:** la UI del comparador (web/nativo) y la pantalla de administración siguen pendientes; el endpoint ya entrega la comparación completa.

---

## Turno 2026-11-17 05:10–06:10 — Lote 3 v1: comprobantes de pago manual

**Contexto:** Mercur 2.4.1 no tiene comprobantes de pago manual (revisado en `@mercurjs/core/.medusa/server/src/modules`); es una brecha real del catálogo de capacidades. Se implementó como módulo propio, sin tocar el core.

| Cambio | Archivos | Verificación |
|---|---|---|
| Módulo `@agestyles/manual-payments`: modelo, migración generada, validación pura y servicio con ciclo `pending → verified/rejected` | `packages/manual-payments/**` | `pnpm --filter @agestyles/manual-payments typecheck` + `test` |
| Registro del módulo | `apps/commerce-api/medusa-config.ts`, `apps/commerce-api/package.json` | `pnpm typecheck` → 11/11 |
| API comprador autenticada (enviar/listar comprobantes propios, 404 uniforme para pedidos ajenos) | `apps/commerce-api/src/api/store/orders/[id]/manual-payments/route.ts` | `verify-manual-payments.ts` |
| API admin: cola por estado, verificar conciliando importe/moneda con el pedido, rechazar con motivo | `apps/commerce-api/src/api/admin/manual-payments/**` | ídem |
| Verificador de laboratorio | `apps/commerce-api/src/scripts/verify-manual-payments.ts` | OK |
| ADR y ticket | `docs/adr/ADR-005-manual-payment-proofs.md`, `docs/tickets/LOTE-3-POSTVENTA.md` | revisión manual |

**Resultado del verificador:**

```json
{"orderId":"order_01M7KFW846KNRTAP6EV110DWJE","currency":"eur",
 "depositAccepted":true,"overTotalRejected":true,"wrongCurrencyRejected":true,
 "foreignOrderHidden":true,"duplicatePendingRejected":true,
 "rejectionRequiresReason":true,"resubmitAfterRejection":true,
 "verifiedMatchesOrder":true,"verifyIdempotent":true,"verifiedCannotBeRejected":true}
```

**Decisiones que Codex debe revisar:**

1. Un comprobante pendiente por pedido y vendedor se garantiza con índice único parcial (`status = 'pending'`), no solo en código.
2. Verificar es idempotente; un comprobante verificado no se puede rechazar y uno rechazado no se puede verificar (queda historial).
3. La conciliación exacta importe/moneda se hace al verificar, no al enviar: el envío admite depósitos parciales hasta el total del pedido.
4. El comprador solo accede a pedidos propios; pedido ajeno y pedido inexistente devuelven el mismo 404.
5. `amount` es `numeric` (`model.bigNumber()`); con `model.number()` la migración generaba `integer` y habría roto los céntimos.

**Nota operativa:** mismo límite que el resto: el contenedor no monta el repo; verificado con `medusa exec`, no por HTTP en `:19081`.

---

## Turno 2026-11-17 06:20–06:50 — Mapeo de publicación (pregunta #7)

| Cambio | Archivos | Verificación |
|---|---|---|
| Mapeo único entre el estado heredado (`draft`/`published`/`archived`), el estado de producto de Medusa (`draft`/`proposed`/`published`/`rejected`) y la revisión de Mercur (`pending`/`confirmed`/`declined`/`canceled`) | `packages/domain/src/publication.ts`, export en `index.ts` y `package.json` | `pnpm --filter @agestyles/domain test` → PASS |
| Pruebas de reglas | `packages/domain/test/publication.test.ts` | ídem |

**Decisiones:** `archived` y `rejected` se guardan en `metadata.agestyles_publication_state` y **despublican** el producto (`status: draft`), porque Medusa no tiene estado archivado y un `status: published` obsoleto no debe filtrar un archivado. La revisión de Mercur no cambia por sí sola la visibilidad. El ETL usa `planLegacyImportWrite` en vez de inventar su propio mapeo.

Cierra la pregunta #7 de `docs/MATRIZ_REUTILIZACION.md`.

---

## Hallazgos de capacidades (evidencia estática, Mercur 2.4.1)

Inspección de `@mercurjs/core/.medusa/server/src/modules/product-attribute` y `@mercurjs/types/dist/product/common.js`:

- `ProductAttribute`: `handle`, `name`, `type`, `is_required`, `is_filterable`, `is_variant_axis`, `rank`, `is_active`, `product_id` (global o por producto), `product_option_id`.
- `AttributeType`: `single_select`, `multi_select`, **`unit`**, `toggle`, `text`.
- Valores: `handle`, `name`, `rank`, `is_active`, `product_option_value_id`.
- Links: `product-attribute-category-link`, `product-attribute-option-mirror-link`.
- Ciclo de cambios de producto: `PENDING` (espera acción admin) → `CONFIRMED` / `DECLINED` / `CANCELED`.

**Consecuencia para la matriz:**
- PIM: Mercur cubre atributos tipados (incluida unidad), obligatoriedad, filtrabilidad y eje de variante. La brecha real se reduce a **familias/versiones y metadatos de comparación** (`comparable`, `group`, `help`, min/max). Ticket: `docs/tickets/LOTE-2-PIM.md`.
- Publicación: existe flujo de cambios con aprobación nativa; la decisión pendiente es mapear estados AgeStyles, no construir un módulo de moderación.

---

## Pendiente de revisión por Codex

1. ¿Acepta el contrato de cotización en `packages/domain/order-quotes.ts` tal como quedó (carrito completo, `seller_ids`, `order_group_id`)?
2. ¿Quiere task de typecheck para `@agestyles/icons` con `@types/react` fijado, o lo deja cubierto por las apps?
3. ¿Actualizamos el criterio de F1 en `STATUS_PLAN_MAESTRO.md` con la evidencia de cotización, o lo hace Codex?
4. `packages/quotations/src/migrations` contiene tres migraciones; confirmar que la última (`20261117002638`) es la que corresponde al modelo con `seller_ids`/`order_group_id`.

## Bloqueos que no dependen de código

- **F0/F6:** destino de backup con capacidad. El disco local sigue en ~4.8 GiB libres; no se ejecutan backups ni builds pesados.
- **F4/F5 nativo:** sin dispositivo Android conectado ni macOS/Xcode en este entorno.
- **F8:** requiere decisión go/no-go de negocio.

---

## Turno 2026-11-17 — Facetas, dry-run y cola OpenCode

| Cambio | Archivos | Verificación |
|---|---|---|
| Facetas de categoría desde la API, combinables con búsqueda y compartibles en URL | `apps/storefront-web/src/lib/catalog.ts`, `src/components/product-explorer.tsx`, `src/app/page.tsx`, ruta/verificador de facetas | Agente Codex: typecheck y verificador del laboratorio pasaron en cinco categorías, incluida búsqueda combinada; solo lectura |
| Validador local de paquetes de exportación sintéticos | `tools/migration/**` | Agente Codex: 5 pruebas Node pasan; fixture 15/15 registros válido; `node --check` y `git diff --check` limpios |
| Gateway seller para lectura/envío de cambios de producto | `tools/scripts/seller-lab-gateway.mjs` | Regla local permite GET/POST solo en `/vendor/products/{id}`; falta desplegar junto con la exportación web cuando termine el modo comprador |
| Cola explícita para trabajo en paralelo de OpenCode | `docs/OPEN_CODE_TASKS.md` | OC-01 mapa legado sin filas personales; OC-02 pruebas de cotizaciones con dobles; OC-03 informe de build Android con límite de disco. Se excluyen áreas ya terminadas o en curso |

No se modificó la infraestructura pública en este turno. El portal de negocio se publicará una vez integrada la pantalla de compra que sigue en curso.

---

## Turno 2026-11-17 01:42–02:05 UTC — Modo comprador y publicación de catálogos

| Cambio | Archivos | Verificación |
|---|---|---|
| Modo Comprar en `business-app` con `customer` actor separado, carrito, ofertas, cotización y aceptación; vuelta a Mi negocio conserva el actor `member` | `apps/business-app/app/(buyer)/**`, `app/(tabs)/more.tsx`, `packages/features-buyer/src/business-buyer-session.ts`, `test/business-buyer-session.test.ts` | Agente: typecheck app/features y prueba de namespace customer pasan; Codex: `corepack pnpm typecheck` → 11/11 y `corepack pnpm test` → 4/4 tareas |
| El test de sesión buyer entra ahora en el target Nx raíz | `packages/features-buyer/package.json` | `corepack pnpm test` → 4 tasks succeeded (3 cacheadas) |
| Seller gateway usa el API actual de laboratorio y permite las operaciones Store API que consume el modo Comprar, manteniendo fuera Admin/Vendor no declaradas | `tools/scripts/seller-lab-gateway.mjs`, `docs/seller-web-vps.md` | Preflight cotización 204 con `idempotency-key`; región/productos/ofertas 200; customer anónimo 401; Admin 404. Sin clave/token impreso. |
| Buyer gateway usa el API actual, permite cotizaciones y agrega lecturas públicas de categoría/vendedor necesarias para SSR | `tools/scripts/buyer-lab-gateway.mjs`, `docs/buyer-web-vps.md` | Regiones/productos/ofertas/categorías/vendedores 200; quote preflight 204 con `idempotency-key`; Admin 404 |
| Publicación actualizada del portal de negocio, web compradora y storefront SEO | `apps/business-app/dist/**`, `apps/buyer-app/dist/**`, imágenes Docker de beta existentes | `pnpm seller:web:build` (bundle 3.9 MB), `pnpm lab:web:build:public` (bundle 5 MB), `pnpm nx build @agestyles/storefront-web`; `docker compose` reconstruyó solo los tres contenedores web ligeros. En Internet: buyer/seller/storefront 200; faceta `flip-flops` con productos y página de vendedor con productos. |

## Turno 2026-11-17 02:05–02:10 UTC — Compra sintética por gateway público

| Cambio | Archivos | Verificación |
|---|---|---|
| Verificación del checkout de comprador a través del gateway público, usando solo el API de laboratorio | `apps/buyer-app/scripts/verify-apk-gateway.mts` (sin cambios) | `node --env-file=apps/buyer-app/.env.local apps/buyer-app/scripts/verify-apk-gateway.mts https://descargas.eav-labs.com/agestyles-lab` → PASS; dos vendedores, envío por tienda y dos pedidos seller-scoped en el grupo `og_01M7KM63Q1QTRECRSAZHF4KQYW`. Verifica además Admin/Vendor no disponibles y endpoints de historial sin sesión respondiendo 401. |

La prueba creó un pedido sintético en la base aislada del laboratorio y usó `pp_system_default`; no escribió en Supabase ni en producción. Esto verifica el flujo API a través del gateway público, pero no sustituye el recorrido visual en Android ni el checkout desde la interfaz web.

## Turno 2026-11-17 — Contrato puro de aceptación de cotizaciones (OC-02)

| Cambio | Archivos | Verificación |
|---|---|---|
| Decisiones puras de precondición/transición para aceptar una cotización; la ruta Medusa consume los helpers | `packages/domain/src/order-quotes.ts`, `apps/commerce-api/src/api/store/order-quotes/[id]/accept/route.ts` | Decisión extraída: revisión inválida/obsoleta, aceptar, expirar y no disponible. Transiciones extraídas: recotizar (incrementa revisión), marcar expirada/no disponible, accepting y accepted. La ruta sigue siendo responsable de cargar el grupo existente y de ejecutar el workflow de checkout bajo lock. |
| Fixtures sintéticos y prueba determinista | `packages/domain/test/order-quotes.test.ts`, `packages/domain/package.json` | `corepack pnpm --filter @agestyles/domain test` → PASS; `corepack pnpm test` → 4/4 tareas; `corepack pnpm --filter @agestyles/domain typecheck` → PASS; `corepack pnpm --filter @agestyles/commerce-api typecheck` → PASS. `git diff --check` limpio. |

La aceptación repetida prueba que el helper devuelve la misma decisión/grupo antes de revisar la revisión enviada, evitando pedir otro checkout. La lectura efectiva del grupo y la recuperación del resultado siguen siendo integración API, cubiertas por los verificadores de laboratorio existentes; no se simularon workflows ni lock. No hubo llamadas a red, DB, Redis ni cambios en el laboratorio durante esta prueba unitaria.

**Hallazgo corregido:** ambos gateways apuntaban al proceso previo `19080`; el laboratorio vigente está en `19081`. El storefront público, además, necesitaba `GET /store/product-categories` y `GET /store/sellers`; al añadir esas lecturas públicas, SSR dejó de mostrar el estado de catálogo no disponible y renderizó productos. No se tocaron DNS, túnel, Supabase ni datos de producción. No se ejecutó build nativo Android/iOS.

---

## Turno 2026-11-17 — OC-01: mapa del esquema legado (solo esquema)

**Tarea tomada:** OC-01 de `docs/OPEN_CODE_TASKS.md` (P0). OC-02 se completó en paralelo y está documentada arriba; OC-03 y OC-04 siguen disponibles. No se modificó código ni configuración para OC-01, y no se tocaron las áreas publicadas o en curso (`storefront-web`, `business-app`, `features-buyer`, gateways).

| Cambio | Archivos | Verificación |
|---|---|---|
| Mapa entidad-a-entidad del esquema de `Agestyles-Catalogo` con destino propuesto en Medusa/Mercur/AgeStyles, brechas y pendientes | `docs/migration/legacy-source-map.md` (nuevo) | revisión manual del documento; `git diff --check` sobre el archivo nuevo |
| Registro del turno | `docs/CODEX_HANDOFF.md` | este apartado |

**Fuente inspeccionada:** `/home/ernesto/proyectos/Agestyles-Catalogo`, rama `develop`, HEAD `cc0a810` (2026-11-16 16:22 +0100). Solo lectura.

**Método:** lectura de `scripts/supabase-schema-from-zero.sql` (baseline de 21 tablas) y de 17 migraciones de `supabase/migrations/` elegidas por entidad; lectura de `src/lib/cartCurrencySummary.ts`, `exchangeRate.ts` y `optimizedImage.ts` para moneda y medios. No se leyó ninguna fila, dump, `auth.users`, objeto de Storage ni credencial; no se abrió conexión a Supabase/PostgreSQL ni se ejecutó migración.

**Hallazgos nuevos que afectan al ETL:**

1. El baseline `scripts/supabase-schema-from-zero.sql` **no es un dump** de la base viva: reordena políticas y contiene columnas luego sustituidas (`stores.owner_id` → `merchant_id`). Antes del ETL hace falta un `pg_dump --schema-only` autorizado y contrastarlo con el mapa.
2. `20261116120000_merchant_product_media.sql` (la migración no aplicada) **no crea tablas**: solo añade RPC de alta/baja/imagen principal de producto para vendedor. Es un cambio de funciones, no de esquema; aun así debe revisarse su intención antes de aplicarla.
3. `merchant_product_publication_requests` usa `pending/approved/rejected/withdrawn`, cuatro estados que el mapeo actual de `packages/domain/src/publication.ts` no cubre (ese contrato solo mapea `draft/published/archived`). Habrá que extenderlo antes de importar productos.
4. Hay **dos** tablas de favoritos con la misma semántica (`public.user_favorites` sobre `auth.users` y `public.wishlist` sobre `profiles`): el ETL debe unirlas con deduplicación, no duplicarlas.
5. El contrato intermedio incluye `customer_preferences`, pero **no existe tabla fuente** para preferencias: no deben fabricarse registros.
6. Moneda: el legacy admite USD y CUP por producto/variante, totales separados por moneda y `app_settings.cup_per_usd` con snapshot en pedidos; Medusa usa una moneda por región/carrito. La decisión de regiones o conversión queda marcada como pendiente P0 en el mapa.
7. Stock sin ubicación: `product_variant_stock` y `product_size_stock` pueden duplicar el saldo; Medusa exige `stock_location`. Hay que fijar saldo canónico y una ubicación por tienda.

**Pendiente de revisión por Codex:** confirmar las equivalencias propuestas (organización ↔ merchant, seller ↔ store), la tabla de estados de pedido y el mapeo de los seis roles de membresía antes de diseñar el importador. El mapa no es un export ni una conciliación.

## Turno 2026-11-17 02:14–02:20 UTC — Accesibilidad y navegación del catálogo

| Cambio | Archivos | Verificación |
|---|---|---|
| Foco visible para campos de búsqueda y ordenación; estado de foco en sus contenedores | `apps/storefront-web/src/app/styles.css` | `corepack pnpm nx run @agestyles/storefront-web:typecheck` → 1 tarea correcta; detector mecánico sin hallazgos |
| Contraste de textos secundarios y estados pequeños ajustado a tonos grafito/cálidos más oscuros, manteniendo los acentos claros sobre superficies azul noche | `apps/storefront-web/src/app/styles.css` | valores anteriores `#888` y `#8a8883` daban 3.54:1 sobre blanco; estilos afectados pasan a `#5b574f` (contraste superior a 7:1 sobre blanco) |
| El enlace de Favoritos sin destino se retiró; no existe almacenamiento ni pantalla de favoritos que pudiera conectarse sin inventar comportamiento | `apps/storefront-web/src/app/page.tsx` | revisión de la navegación de cabecera |
| Catálogo paginado a 48 productos por página; API recibe offset, el estado muestra rango/total y los enlaces anterior/siguiente conservan búsqueda y categoría | `apps/storefront-web/src/lib/catalog.ts`, `src/app/page.tsx`, `src/components/product-explorer.tsx` | typecheck de storefront aprobado; al solicitar una página fuera de rango se usa la última página válida |
| Movimiento reducido desactiva desplazamiento suave y transiciones/transformaciones decorativas de los controles del storefront | `apps/storefront-web/src/app/styles.css` | regla `prefers-reduced-motion` aplicada a animaciones presentes |

`git diff --check` pasó. No se desplegó, no se modificó backend y no se tocaron datos. El detector ejecutado sobre los cuatro archivos modificados devolvió `[]`.

## Turno 2026-11-17 02:10–02:32 UTC — Contrato de cotizaciones, mapa legacy y seguimiento buyer

| Cambio | Archivos | Verificación |
|---|---|---|
| OC-02: decisiones puras de aceptación de cotización extraídas y usadas por la ruta real; casos de revisión, expiración, disponibilidad, recotización y aceptación repetida | `packages/domain/src/order-quotes.ts`, `packages/domain/test/order-quotes.test.ts`, `packages/domain/package.json`, ruta `apps/commerce-api/src/api/store/order-quotes/[id]/accept/route.ts` | Agente: `pnpm test` 4/4, typecheck domain y commerce-api y `git diff --check` pasan. Workflow, locks y lectura del grupo siguen siendo integración. |
| OC-01: mapa propuesto de entidades origen/destino | `docs/migration/legacy-source-map.md`, estado actualizado en `docs/OPEN_CODE_TASKS.md` | Trabajo OpenCode: lectura solo de esquema/código histórico; sin filas, credenciales, conexión ni migraciones. Incluye brechas de moneda, inventario, roles, estados y medios; requiere contraste con esquema vivo restaurado. |
| Seguimiento por línea en detalle de compra; lectura separada por pedido hijo, enlace externo solo HTTPS | `apps/buyer-app/app/(drawer)/(tabs)/account/orders/[id].tsx`, `packages/api-client/src/order-tracking.ts`, `packages/api-client/package.json`, `tools/scripts/buyer-lab-gateway.mjs`, `docs/buyer-web-vps.md` | Typecheck buyer/API-client y raíz 11/11; `pnpm test` 4/4. Beta compradora exportada/publicada: página 200, bundle servido contiene el cliente y texto de error actualizado, health local 200. Preflight tracking 204; Admin 404. **Brecha runtime:** el API público vigente responde `Cannot GET /store/orders/{id}/tracking` (404), así que no se confirmó autorización sin sesión ni hay seguimiento end-to-end. No se reconstruyó el API por capacidad del host (3.7 GiB libres, 99% usado). |
| Correcciones de accesibilidad/navegación del catálogo | `apps/storefront-web/src/app/styles.css`, `src/app/page.tsx`, `src/components/product-explorer.tsx`, `src/lib/catalog.ts` | Typecheck y detector sin hallazgos; `corepack pnpm nx build @agestyles/storefront-web` pasó. Imagen estática desplegada sin recrear API. Home/categoría públicas 200; CSS servido incluye regla de movimiento reducido y estilos de paginación. No se verificó visualmente con teclado/lector. |
| Verificación de Nx y estado de calidad | `/tmp/agestyles-nx-graph.json` (artefacto temporal) | `corepack pnpm exec nx graph --file=/tmp/agestyles-nx-graph.json --open=false --watch=false` → JSON generado; `corepack pnpm typecheck` 11/11, `corepack pnpm test` 4/4 y `git diff --check` pasan. |

No se tocaron Supabase, DNS, Cloudflare, Admin API ni el API de producción. Las fases F0/F6/F8 siguen abiertas; este avance no es un permiso de migración/cutover.

## Turno 2026-11-17 02:32–02:39 UTC — Ownership de repositorio

| Cambio | Archivos | Verificación |
|---|---|---|
| Añadido propietario de código por defecto para todas las rutas | `.github/CODEOWNERS` | Identidad `@ErnestoArtime` coincide con el dueño indicado por el usuario para `ErnestoArtime/monorepo-agestyles`. El archivo documenta que GitHub debe exigir code-owner review en reglas de rama para hacerlo obligatorio; no se modificaron reglas remotas. |

## Turno 2026-11-17 02:42–03:02 UTC — Seguimiento de pedidos: ajuste local y verificación fallida

| Cambio / hallazgo | Archivos | Verificación |
|---|---|---|
| El handler de seguimiento tolera una referencia nula de fulfillment, y el verificador ahora exige un pedido customer limpio antes de crear uno temporal. La limpieza borra la etiqueta/prueba, revierte los marcadores de envío y usa el workflow de cancelación de Medusa; ya no borra directamente el fulfillment. | `apps/commerce-api/src/api/store/orders/[id]/tracking/route.ts`, `apps/commerce-api/src/scripts/verify-order-tracking.ts` | `pnpm --filter @agestyles/commerce-api typecheck` pasa; `git diff --check` pasa. El verificador `medusa exec` **no pasó**, así que no se declara seguimiento validado. |
| El API desplegado sigue sin esa ruta (`Cannot GET`); no se reconstruyó su imagen. Al probar el verificador en el laboratorio, aparecieron dos fulfillments con etiqueta sintética de corridas anteriores. Una corrida de esta sesión creó y luego retiró su fulfillment de prueba; otra dejó un fulfillment sin envío/etiquetas y la cancelación no se pudo confirmar porque la relación order–fulfillment del fixture estaba inconsistente. El estado final de esa relación no se considera verificado. | Laboratorio local PostgreSQL/Redis aislado | No se tocó Supabase, DNS ni producción. No repetir la prueba sobre este fixture; hace falta restaurar o preparar un pedido aislado limpio y comprobar reservas/stock antes de continuar. |

No se hizo despliegue ni se anunció el endpoint como activo. F4 sigue parcial.

## Turno 2026-11-17 03:02–03:06 UTC — Revisión de probe de precio F1

| Cambio / hallazgo | Archivos | Verificación |
|---|---|---|
| Análisis de solo lectura encontró que `apps/commerce-api/scripts/verify-order-quotes.mjs` ya implementa una mutación temporal de +1 sobre la escala de A2, valida `409/requoted` y restaura/compara la escala original en `finally`. Solo ejecuta esa rama si el vendedor tiene región EUR; el estado anteriormente registrado dice que A2 no la tiene y queda a EUR 49. | Sin cambios en código; consolidado en `docs/STATUS_PLAN_MAESTRO.md`, `docs/PLAN_COMPLETION_AUDIT.md` y `docs/architecture/medusa-mercur-capability-matrix.md` | El comando `lab:verify:order-quotes` es compuesto: además crea un grupo y pedidos A2+B2, toca stock temporalmente y verifica expiración. No se ejecutó ni se comprobó el estado vivo de región/precio. Se añadió OC-06 para que OpenCode cree un probe price-only, con salida no destructiva `unsupported` sin EUR y sin ejecutarlo. |

## Turno 2026-11-17 03:08–03:10 UTC — Healthchecks de la composición local (F2)

| Verificación | Resultado |
|---|---|
| `docker compose --env-file apps/commerce-api/.env -f infra/compose/mercur-lab.yaml ps` | PostgreSQL y Redis: `running healthy`. La variable de entorno se usó solo para interpolación; no se imprimió. |
| Compose de buyer, seller y storefront | API y las tres webs: `running healthy`; gateways están arriba (no tienen healthcheck Compose declarado). |
| Endpoints locales | API en `19080/health` y `19081/health`: 200; buyer `18083/healthz`, storefront `18084/healthz`, business `18085/healthz`: 200. |

Esto confirma el health local del laboratorio y las tres webs en este corte, no el build nativo ni el flujo de login/API completo. No se modificó infraestructura ni se hizo despliegue.

## Turno 2026-11-17 — Revalidación de permisos de vendedor

| Verificador | Resultado |
|---|---|
| `corepack pnpm lab:verify:seller-roles` | **54/54 comprobaciones pasaron** para dueño, gestor y solo lectura en Sole Society/A2, incluyendo la segunda tienda A2, cambios/revocación de rol y rechazo de accesos a la organización ajena. Salió con código 0. El script retira artículos y membresías sintéticas en `finally`. |
| `corepack pnpm lab:verify:kickz-roles` | **Falló** antes de terminar B1/B2: `GET /vendor/orders?limit=20&fields=id,display_id,status,total` devolvió 500 (`An unknown error occurred`) donde el guion esperaba 200. Salió con código 1; su bloque `finally` limpió las membresías creadas. No se repitió para evitar dejar más cuentas sintéticas. |

El fallo no demuestra por sí solo un defecto de permisos; requiere diagnosticar los logs del proceso Medusa local y la consulta de pedidos de Kickz antes de aceptar de nuevo los 46 checks históricos. No se modificó el código ni la base del laboratorio fuera de las escrituras temporales de los verificadores. Se actualizó la fila F1 de `docs/STATUS_PLAN_MAESTRO.md` para que no presente la matriz Kickz como revalidada.

Se dejó OC-08 en `docs/OPEN_CODE_TASKS.md` para que OpenCode examine dependencias, configuración y logs ya disponibles en solo lectura. No se reiniciará el proceso ni se repetirá la matriz durante ese análisis.

## Turno 2026-11-17 03:28 UTC — Aislamiento de lectura para `/vendor/orders`

| Alcance | Resultado |
|---|---|
| Mismo owner sintético Kickz, GET solo lectura en `127.0.0.1:19081`; sin escribir pedidos, stock ni membresías | `Kickz Corner` (B1) responde 500 con campos predeterminados, `?limit=20`, `?fields=id` y `?fields=id,display_id,status,total`. `agestyles-lab-b2` responde 200 en las mismas cuatro consultas. |

Esto descarta que el fallo observado dependa solamente de los campos personalizados del verificador. El problema sigue acotado a B1 o a los pedidos/relaciones que la consulta incluye para esa tienda; no identifica una fila ni prueba la causa. Se inspeccionó el handler instalado de Mercur 2.4.1: arma `getOrdersListWorkflow` con el filtro seller añadido por middleware y aplica los campos predeterminados de `vendorOrderQueryConfig`. No se consultó la base directamente ni se accedió a datos de cliente. OC-08 recibió esta comparación diferencial para investigar en solo lectura.

## Turno 2026-11-17 — OC-03: preparación Android, solo medición

| Cambio | Archivos | Verificación |
|---|---|---|
| Informe de readiness para comprador y negocio | `docs/mobile/android-build-readiness.md`; OC-03 actualizado en `docs/OPEN_CODE_TASKS.md` | Node 24.18, Java 21.0.13, Expo 54.0.38, Android SDK 6.3 GiB, ADB 37.0.1; `adb devices -l` vacío. Buyer tiene proyecto Android generado localmente; Business requiere prebuild. No hay EAS ni `eas.json`; falta system image/AVD. Disco: 3.7 GiB libres frente al mínimo de 8 GiB. Ambas `.env.local` apuntan a localhost y deben usar el gateway público de laboratorio para una app física. No se ejecutó Gradle/EAS/prebuild, no se descargó nada y no se tocó código de apps. |

---

## Turno 2026-11-17 — OC-05: auditoría del ecosistema de iconos

**Tarea tomada:** OC-05 de `docs/OPEN_CODE_TASKS.md` (P1, “lista para OpenCode”). Auditoría de solo lectura: no se editó código de app, no se instalaron paquetes y no se publicó nada. OC-04 se descartó porque sus archivos permitidos (`package.json`, `nx.json`, `.github/workflows/ci.yml`) tienen cambios sin commit de la sesión Codex; OC-06 y OC-07 siguen libres.

| Cambio | Archivos | Verificación |
|---|---|---|
| Informe de adopción del paquete de iconos, con evidencia por app y brechas priorizadas | `docs/ui/icon-ecosystem-audit.md` (nuevo) | búsquedas estáticas y comparación automática de glifos; `git diff --check` limpio |
| Registro del turno | `docs/CODEX_HANDOFF.md` | este apartado |

**Alcance revisado:** `packages/icons` (ambas entradas, 40 glifos), `buyer-app` (10 archivos que tocan iconos), `business-app` (6) y `storefront-web` (5, 13 usos), más `docs/design-system.md` en solo lectura. Excluidos `references/**`, `node_modules`, `dist` y los SVG de marca.

**Resultado:** el paquete es la única fuente en las tres apps (sin `lucide-react`, `lucide-react-native` ni `@expo/vector-icons` directos), la paridad web/nativo es 40/40 y `react-native-svg` coincide con el peer en ambas apps Expo.

**Brechas P1 encontradas (no corregidas, por ser auditoría):**

1. `IconSymbol` resuelve nombres desconocidos a `help` con `name: string` y dos llamadas fuerzan `as any` (`payment-step.tsx:68`, `order-confirmation/[id].tsx:207`): un nombre nuevo se dibuja como `?` sin error de TypeScript.
2. El botón de eliminar del carrito es solo-icono y no tiene etiqueta accesible (`cart-item.tsx:63-65`).
3. Los botones de cantidad usan texto `-`/`+` y no tienen rol ni etiqueta, aunque `minus`/`plus` existen en el paquete (`cart-item.tsx:49-60`).
4. La selección de pago usa `✓` de texto y no anuncia el estado (`payment-step.tsx:55-83`).
5. El estado de error usa el glifo `help` porque no hay glifo de alerta (`operation-list.tsx:22`).

También quedan P2 de consistencia: trazo 2.2 solo en pestañas del comprador, tamaños de 17–19 px en controles y 12–15 px en enlaces, `#111B2D`/`#FFFFFF` duplicados fuera de tokens y `⌕`/`↗` como glifos de texto en el storefront. P3: `packages/icons` no tiene target de typecheck propio (la cobertura es indirecta vía apps) y no aparece en `transpilePackages` del storefront aunque exporta `.tsx` sin compilar.

**Requiere dispositivo:** trazo real, tamaño de tab bar en 360 dp, anuncio de `radio`/`checked` con TalkBack y diferencia de color por defecto web/nativo. No se ejecutó typecheck ni build para no mezclar el estado sin commit de Codex.

## Turno 2026-11-17 — Diagnóstico de lectura de pedidos Kickz/B1 (OC-08)

| Alcance | Resultado |
|---|---|
| Revisión estática de Mercur 2.4.1/Medusa 2.22.3, configuración de laboratorio y observabilidad disponible; sin requests nuevos, escrituras, cambios de servicios ni consultas a la base | Informe `docs/lab/kickz-orders-500.md`. B1 sigue fallando en la evidencia previa con filtros explícitos de campos distintos; B2 responde 200. El proceso Medusa vigente corre en el host y stdout/stderr son pipes sin log persistido disponible en esta revisión. |

El handler de Mercur aplica permiso, validación de `vendorOrderQueryConfig.list` y filtro seller antes de ejecutar `getOrdersListWorkflow`; luego normaliza colecciones de pago. Su configuración combina campos de pedido con relaciones anidadas, así que `?fields=id` no aísla necesariamente una lectura mínima. Esto acota la investigación a la consulta seller-scoped de B1 o sus relaciones; no prueba una causa raíz ni autoriza a revalidar la matriz. Se documentó la siguiente captura de stack trace redactada para una ejecución autorizada y en laboratorio. F1 permanece abierta. No se modificó código de aplicación ni `docs/STATUS_PLAN_MAESTRO.md`.

## Turno 2026-11-17 03:48–04:01 UTC — Gates F0/F1/F2/F4/F7

| Cambio/evidencia | Archivos / verificación |
|---|---|
| F0: nueva medición solo lectura del host | 6 CPU, 11 GiB RAM, 3.5 GiB libres (99% usado), 3.1 GiB disponibles, swap 2 GiB con 236 KiB libres. No se limpiaron imágenes/volúmenes ni se inició backup/build nativo. |
| F1 OC-06: probe aislado de revisión de precio A2 | `apps/commerce-api/scripts/verify-price-revision.mjs`. Verifica API/Postgres loopback antes de mutaciones; consulta región primero y devuelve `unsupported` antes de carrito/cotización si falta EUR; rama viable restaura y compara cada campo de la escala original. No se ejecutó. `node --check` y Prettier pasan. |
| F2 OC-04: lint y formato incremental | `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `package.json`, lockfile y CI. ESLint 9.39.2 con reglas por stack; `pnpm lint` → 0 errores/36 warnings; `pnpm format:check` → PASS; install de lockfile congelado → PASS (modo `--lockfile-only`). Markdown y lockfile excluidos con motivo documentado. |
| F4/F7: controles de compra accesibles | `apps/buyer-app/components/cart-item.tsx` y `components/checkout/payment-step.tsx`: etiquetas/roles para cantidad/eliminación, iconos minus/plus/check y estado `radio/checked`. `pnpm typecheck` → 11/11; `pnpm test` → 4/4. TalkBack no probado. |
| F4 OC-07: procedimiento de tracking aislado | `docs/mobile/order-tracking-verification.md`: contrato sintético, workflow solo en PostgreSQL/Redis desechables con `run_id`, propiedad buyer, logs saneados y descarte integral. No se ejecutó ni se llamó API/DB. |
| Web/APK: respuesta HTTP externa | `catalogo.eav-labs.com`, `tienda.eav-labs.com`, `negocio.eav-labs.com` y el APK publicado responden 200. El gateway no expone healthchecks bajo sus rutas públicas; no se toma un 404 a `/health` como fallo de producto. Esto no valida render visual ni compra. |

`pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm typecheck`, `node --check` del probe y `git diff --check` pasan. No se hizo build ni despliegue por el espacio disponible. Las fases F0/F1/F2/F4/F7 siguen parciales; backup/restore, Android/iOS/TalkBack, 500 de Kickz/B1, tracking runtime, ETL, checkout UI, UAT y gates de producción permanecen abiertos. `references/` continúa excluida.

**CI del commit:** GitHub Actions run [44014525470](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44014525470), SHA `332bda3`, terminó `success`: install frozen, lint, format-check, tests, typecheck y los tres builds web completados.

## Turno 2026-11-17 — corrección de tipos en el paquete de iconos

La revisión de Git confirmó que `main` estaba sincronizada con `origin/main` y no había cambios locales previos que subir. Se consultaron los patrones de rama y remoto en `Agestyles-Catalogo`, `beauty-saas`, `nx-monorepo` y `stores`; no se modificaron esos repositorios.

En `buyer-app`, `IconSymbol` ahora restringe sus alias a las claves declaradas y valida sus glifos con `IconName`; se eliminó el fallback silencioso a `help`. El tipo del icono de los proveedores de pago también quedó ligado al catálogo compartido y se quitaron los casts `as any` de checkout y confirmación. No se añadieron dependencias.

Verificación local: typecheck de buyer-app, ESLint en cuatro archivos de código, Prettier en los archivos tocados y `git diff --check`. `references/` permanece fuera del control de versiones. Las brechas de accesibilidad del carrito y la selección de pago, los glifos de texto y la validación nativa siguen abiertas.

---

## Turno 2026-11-17 — Cierre de brechas P1 de la auditoría de iconos

**Contexto:** la cola `docs/OPEN_CODE_TASKS.md` no tiene tareas abiertas (OC-01 a OC-08 cerradas). Se revisó el estado real de las brechas de OC-05: Codex ya había corregido las P1 #1–#4 en `icon-symbol.tsx`, `payment-step.tsx` y `cart-item.tsx` (tipado `IconSymbolName` sin fallback, `minus`/`plus`, `check` con `radio/checked`), así que no se tocaron esos archivos, que siguen con cambios sin commit.

| Cambio | Archivos | Verificación |
|---|---|---|
| Glifo `alert` (`TriangleAlert`) añadido a las dos entradas del paquete | `packages/icons/src/index.web.tsx`, `packages/icons/src/index.native.tsx` | paridad 41/41 sin nombres exclusivos; `alert` presente en ambas |
| El estado de error deja de usar el glifo de ayuda | `apps/business-app/components/operation-list.tsx` | `corepack pnpm --filter @agestyles/business-app typecheck` → PASS |
| Pestañas de negocio con tokens en lugar de literales (`#111B2D`, `#FFFFFF`, `#171717`, `#6F6F6B`, `#E4E4DF`) | `apps/business-app/app/(tabs)/_layout.tsx` | mismo typecheck; `git diff --check` limpio |
| Estado posterior anotado en el informe | `docs/ui/icon-ecosystem-audit.md` | revisión del apartado 8 |

**Siguen abiertas:** grosor 2.2 solo en pestañas del comprador, tamaños de control fuera de 20–24 px, `⌕`/`↗` como glifos de texto en el storefront (área publicada), prop `weight` ignorada en `IconSymbol`, typecheck propio de `@agestyles/icons` y su ausencia en `transpilePackages`. No se ejecutó build, instalación ni despliegue; la validación visual/TalkBack sigue pendiente de dispositivo.

---

## Turno 2026-11-17 — Segunda tanda de pendientes de iconos

**Contexto:** sin tareas abiertas en `docs/OPEN_CODE_TASKS.md`, se continuó con la lista de pendientes del apartado 8 de `docs/ui/icon-ecosystem-audit.md`. Codex ya había commiteado su corrección de tipos en `636a774`, así que no se pisó trabajo en curso.

| Cambio | Archivos | Verificación |
|---|---|---|
| Typecheck propio del paquete de iconos | `packages/icons/tsconfig.json` (nuevo), `packages/icons/package.json` (`typecheck`, `@types/react@19.1.17` dev), `pnpm-lock.yaml` | `corepack pnpm --filter @agestyles/icons typecheck` → PASS; Nx lo incluye: `pnpm typecheck` 12/12 |
| `@agestyles/icons` añadido a `transpilePackages` | `apps/storefront-web/next.config.ts` | typecheck del storefront dentro del run 12/12 |
| Prop `weight` muerta eliminada; tamaños 18→20 | `apps/buyer-app/components/ui/icon-symbol.tsx`, `components/ui/collapsible.tsx` | typecheck buyer 12/12 |
| Trazo de pestañas sin el 2.2 del estado enfocado | `apps/buyer-app/app/(drawer)/(tabs)/_layout.tsx` | revisión; el estado sigue por color |
| Controles a 20 px y menús de cabecera 28→24 | `apps/business-app/app/(tabs)/{_layout,index,more,team}.tsx`, `app/index.tsx`, `components/operation-list.tsx`, `apps/buyer-app/components/cart-item.tsx`, `components/android-app-link.tsx`, `app/(drawer)/(tabs)/({home,cart})/_layout.tsx` | typecheck 12/12 |
| `⌕`/`↗` sustituidos por `search`/`arrowUpRight` decorativos | `apps/storefront-web/src/components/product-explorer.tsx`, `src/app/page.tsx`; glifo nuevo en ambas entradas de `packages/icons` | paridad 42/42; typecheck storefront 12/12 |

**Verificación global:** `corepack pnpm typecheck` 12/12, `pnpm lint` 0 errores (36 warnings preexistentes), `pnpm test` 4/4, `git diff --check` limpio, paridad 42/42. No se ejecutó build, despliegue ni llamada a API/DB.

**Bloqueo detectado para commitear:** `pnpm format:check` falla en 17 de los archivos tocados porque nunca siguieron el baseline de `.prettierrc.json` (punto y coma y comillas dobles); el storefront y varias pantallas usan otro estilo. No se reformatearon en masa: hace falta que Codex decida si se formatean esos archivos, se ajusta la configuración o se amplía `.prettierignore`. `FORMAT_BASE_REF` en CI solo evalúa lo commiteado, así que este árbol no altera el CI mientras no se commitee.

**Siguen abiertas:** corazón decorativo de 19 px en tarjetas del storefront, `#FFFFFF` literal en `android-app-link`, divergencia del color nativo por defecto (`#171717` vs `currentColor`), rango 12–16 px para iconos en línea sin documentar y validación visual/TalkBack en dispositivo.

---

## Turno 2026-11-17 — prueba de contrato para tracking buyer

Se añadió `apps/commerce-api/test/order-tracking-route.test.mjs` y el target `test` del paquete Commerce API. La prueba ejecuta el handler con `QUERY.graph` simulado y cubre autenticación 401, aislamiento de un pedido ajeno con 404 sin label, y respuesta del owner con shipments por línea. No usa base de datos.

Verificación local: `pnpm test` 6/6, `pnpm typecheck` 12/12, lint 0 errores/20 warnings, Prettier y ESLint dirigido pasan. Nx infiere el target `test` del paquete. La ruta continúa pendiente de imagen/despliegue en el API; el verificador runtime sigue en pausa mientras haya fulfillment de fixture sin limpiar. CI de este cambio queda pendiente.

## Turno 2026-11-17 — autenticación buyer/member desde un único acceso (F5)

La revisión F5 confirmó que el modo comprador conservaba el token de negocio, pero pedía correo y contraseña de nuevo para el actor `customer`. Se añadió `loginBusinessAndBuyerActors` en `packages/features-buyer/src/business-buyer-session.ts` y el SDK buyer compartido `apps/business-app/context/buyer-actor.ts`. Tras autenticar `member`, la app limpia el token buyer anterior, intenta autenticar `customer` con las mismas credenciales y verifica el perfil; cada JWT mantiene su almacenamiento prefijado independiente. Si ese actor no existe/no autentica, el acceso de negocio continúa y el comprador queda sin sesión autenticada. No se guarda la contraseña.

`business-context.tsx` llama al coordinador al iniciar sesión; la ruta `app/(buyer)/index.tsx` reutiliza el mismo SDK/sesión para detectar el customer autenticado. Se ampliaron los checks sintéticos para login dual, limpieza buyer previa, fallo del actor buyer sin bloquear member y fallo de member sin intentar buyer. Verificaciones locales: test del paquete PASS; typecheck de Business y `features-buyer` PASS; ESLint dirigido sin errores; Prettier y `git diff --check` PASS. No se probaron cuentas reales/sintéticas en el API ni el cambio de modo en navegador/dispositivo. F5 sigue parcial: falta probar login enlazado en UI, refresh/revocación y logout por actor/todos.

El commit `598c7da` está en `main`; GitHub Actions run [44029135950](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44029135950) terminó `success`, incluyendo lint, formato, tests, typecheck y los tres builds web. No hubo despliegue runtime.

## Revisión del detalle de pedidos buyer — 17 de noviembre de 2026

Se revisó el cambio local pendiente en `apps/buyer-app/app/(drawer)/(tabs)/account/orders/[id].tsx` y `apps/buyer-app/lib/status-labels.ts`. ESLint detectó que el helper puro llamado `useStatusLabel` se invocaba dentro de callbacks/condiciones como si fuera un hook; se renombró a `getStatusLabel`. El detalle usa además `PAYMENT_STATUS_LABELS` para el estado de pago. Verificación: typecheck de `@agestyles/buyer-app` PASS, ESLint dirigido sin errores, Prettier y `git diff --check` PASS. Esto es solo presentación del detalle; tracking en runtime aún depende de publicar la ruta del API y probarla con un fixture limpio.

## Revisión de tareas OpenCode y tema comprador — 17 de noviembre de 2026

Se revisó `docs/OPEN_CODE_TASKS.md`: OC-01–OC-08 ya estaban documentadas como cerradas o con ejecución/runtime expresamente pendiente. OC-09 era la única tarea local que se podía adelantar sin dispositivo ni publicación.

En la auditoría se encontró que `apps/buyer-app/app.json` fijaba `userInterfaceStyle: "light"`, aunque las pantallas consultan `useColorScheme()`. Se cambió a `automatic` y se amplió el alcance registrado de OC-09. Business declara `automatic` y consume `@agestyles/design-tokens`; el storefront tiene media queries `prefers-color-scheme` en sus hojas de estilos.

Gates locales, sin builds nativos/web ni llamadas de red: `corepack pnpm typecheck` → 12/12; `corepack pnpm lint` → 0 errores, 20 advertencias; `corepack pnpm format:check` → PASS; `corepack pnpm test` → 6 tareas exitosas; `git diff --check` → PASS. No se reiniciaron servicios ni se publicó nada.

OC-09 queda pendiente únicamente de inspección visual clara/oscura de rutas completas y, en móvil, del comportamiento del sistema en Android/iOS. No se hizo esa comprobación con navegador/dispositivo; la inspección estática y los gates de código no la sustituyen. Durante desarrollo se puede seguir con comandos locales, sin esperar a una publicación.

## Verificación ligera del grafo Nx — 17 de noviembre de 2026

`corepack pnpm nx graph --file=/tmp/agestyles-nx-project-graph.json --open=false --watch=false --view=projects` generó correctamente el grafo sin compilar apps. El resumen verificó 13 proyectos y 16 dependencias. La inspección reveló que Nx no infería la relación Commerce API → `@agestyles/quotations`, porque Medusa carga ese módulo desde `medusa-config.ts`; `apps/commerce-api/package.json` ahora la declara en `nx.implicitDependencies`.

Se añadió `tools/migration/project.json`, de modo que Nx incluye el preflight en `pnpm test` sin agregarlo al workspace pnpm ni iniciar builds de apps. `corepack pnpm test` pasó 7 tareas (5 en caché); la suite migración pasó 9/9 y el fixture incluido cubre 4 entidades. No se generó build, no se inició navegador/Expo y no se desplegó. Los contenedores web locales son imágenes de horas anteriores, por lo que no prueban los cambios de esta rama; la revisión visual de F3/F4/F5 sigue pendiente.

## Preparación del release manual de Commerce API — 17 de noviembre de 2026

La ruta de tracking está en código fuente pero falta en el API runtime. Se añadió un workflow manual, separado del de frontends, para publicar `agestyles-commerce-api` en GHCR tras CI del mismo SHA. El build crea una configuración loopback con secretos aleatorios, los monta solo como secreto BuildKit y los elimina al final; no usa credenciales del servidor ni requiere el VPS para compilar. El override Compose cambia solo la imagen de `commerce-api`; el runbook define pull/up/health y rollback.

Verificación realizada: Prettier y `git diff --check`; `docker compose config` confirma imagen, red host y healthcheck correctos con un tag sintético. No se construyó ni publicó la imagen, no se desplegó, y no se tocó API/DB. Antes del runtime test, publicar desde GitHub, revisar espacio de disco y actualizar solo ese servicio; mantener el fixture de tracking desechable según `docs/mobile/order-tracking-verification.md`.

El CI ahora incluye `medusa build` con valores loopback y secretos aleatorios enmascarados, para comprobar la compilación del runtime sin infraestructura de datos. No se ejecutó localmente porque el disco del host sigue sin margen; el primer resultado remoto tras este cambio será el gate de compilación.

## Adaptador local de proyección para catálogo — 17 de noviembre de 2026

Al revisar `docs/OPEN_CODE_TASKS.md`, OC-01–OC-08 constaban cerradas (con gates runtime expresamente pendientes) y OC-09 esperaba inspección visual en navegador/dispositivo. Se avanzó el siguiente entregable F6 indicado en `docs/migration/catalog-products-import.md`: `tools/migration/project-catalog-projection.mjs` convierte cuatro proyecciones JSON locales preparadas a `agestyles.stage-interchange` catalog-only. Incluye categorías/subcategorías, productos, opciones de variante y metadatos SHA-256/MIME de medios; rechaza referencias rotas, opciones mal formadas y cualquier campo URL en metadatos de imagen. Los campos ajenos a la lista se descartan. El destino debe ser una carpeta nueva, creada con permisos privados; el comando emite solo recuentos.

La utilidad no conecta con Supabase/PostgreSQL, no descarga medios, no importa nada y no equivale al exportador real. No se usaron filas del catálogo: la prueba genera un fixture sintético temporal, valida el bundle con el perfil `catalog-only` y confirma que el código con ceros iniciales se conserva, no se emiten `store_id`/stock/datos de cliente y la visibilidad queda bloqueada hasta conciliación.

Verificación: `corepack pnpm migration:test` → 11/11; el bundle catalog-only de referencia → válido; el comando `migration:catalog:project` produjo el bundle desde `fixtures/synthetic-source-projection` y `migration:catalog:check` lo validó con 5 registros; Prettier, ESLint dirigido y `git diff --check` → PASS. Se añadieron límites de tamaño/ID y rechazo de enlaces simbólicos; una prueba cubre ese rechazo. No se ejecutaron builds, servicios, navegador, red, exportación real ni despliegue. Quedan fuera de este avance el backup/restore, captura/aprobación del esquema vivo, exportador seguro de origen, estrategia para copiar bytes de imagen, vendedor/ofertas, políticas USD/CUP, importador idempotente y revisión visual de OC-09.

## Revisión de logs del API para Kickz/B1 — 17 de noviembre de 2026

El contenedor `agestyles-buyer-api` estaba activo. Se leyeron solo sus logs de las últimas 24 horas y se imprimieron únicamente conteos de líneas candidatas y rutas/números de línea de stack trace; no aparecieron líneas de error 500/`unknown error`, ni frames de stack. No se llamó a endpoints, no se leyó `.env` y no se modificaron servicios o datos. La causa del 500 de Kickz/B1 sigue abierta y requiere una captura futura en un entorno desechable durante una reproducción autorizada.

## Gate de tests integrado — 17 de noviembre de 2026, 07:55 UTC

`corepack pnpm test` completó los 7 targets Nx: 7/7 correctos (6 en caché). Esto incluye la suite de migración 11/11. `corepack pnpm exec eslint` dirigido, Prettier en archivos de código/fixtures y `git diff --check` pasan. El CLI de proyección sintética y el preflight catalog-only también pasaron por separado. Sin builds, exportación real, llamadas de API/DB ni despliegues.

## Gestión de variantes en negocio — 17 de noviembre de 2026

La pantalla de productos de `business-app` mostraba solo cuántas variantes existían. Añadí lectura de SKU y un editor de título/SKU por variante, que envía una solicitud de cambio a revisión mediante `POST /vendor/products/{product_id}/variants/{variant_id}`. Los botones se muestran únicamente con `products.edit`; en Mercur 2.4.1, el middleware de esa ruta también exige ese permiso en servidor, verifica que el producto pertenezca al vendedor y que la variante pertenezca al producto. La UI explica que los datos actuales no cambian hasta aprobación.

Verificación local: `corepack pnpm --filter @agestyles/business-app typecheck` → PASS; ESLint dirigido, Prettier y `git diff --check` → PASS. No se llamó a la API ni se compiló/publicó. Alta/baja de variantes, fotos/medios, validación visual de la edición y fulfillment permanecen pendientes.

La misma revisión encontró un rechazo sin manejar en el botón “Salir” de la sesión customer del modo Comprar. Ahora el handler captura el error, informa el resultado y solo limpia customer/cotización cuando el logout se completa. Se extrajo la secuencia a `logoutBusinessBuyerActor` y se probaron los casos logout exitoso y fallido, verificando que un fallo no borra el estado local. `packages/features-buyer` test → PASS; typecheck Business → PASS; ESLint y Prettier dirigidos → PASS. Requiere comprobación en UI/runtime junto con el cambio de actor.

Después de estos cambios, `corepack pnpm test` volvió a pasar 7/7 targets Nx (6 en caché). Sin builds ni despliegues.

## Alta de variantes con opciones desde Business — 17 de noviembre de 2026, 08:40 UTC

La pantalla de productos ahora consulta `/vendor/products/{id}/variants` para obtener ejes/valores ya existentes, permite seleccionar una combinación válida, bloquea duplicados y envía la alta por `POST /vendor/products/{id}/variants`. No permite inventar valores de eje; si el producto no tiene opciones solo permite una variante por defecto cuando aún no tiene variantes. Mercur 2.4.1 devuelve `product_change` (202) y el handler fuerza `manage_inventory:false`; la UI informa que hace falta asignar inventario después de la aprobación. La ruta exige `products.edit` en servidor, verifica visibilidad seller-scoped del producto y no toma seller ID del body. Los roles de inventario/solo lectura no ven el formulario porque no tienen `products.edit`.

Se extrajeron las reglas puras de ejes, combinaciones duplicadas y variante por defecto en `apps/business-app/lib/variant-options.ts`, con tres pruebas en `apps/business-app/test/variant-options.test.mjs`. El target `test` de Business quedó integrado en Nx. Verificación: Business tests 3/3, typecheck PASS, ESLint/Prettier dirigidos PASS; `corepack pnpm test` 8/8 targets (7 en caché), `git diff --check` PASS. No se llamó a la API/DB ni se desplegó. Alta/cambio aún requieren recorrido visual/runtime; fotos, baja y fulfillment siguen pendientes.

## Atajo de typecheck para desarrollo — 17 de noviembre de 2026, 08:17 UTC

Medición local: el gate completo `corepack pnpm typecheck` pasó 12/12 targets (8 en caché) y tardó 2:49; Commerce API ocupó 2:47 porque su script compila primero tres módulos workspace y después ejecuta `tsc --noEmit`. Añadí `corepack pnpm typecheck:quick`, que excluye solo `@agestyles/commerce-api`; verificado 11/11 targets, 100% en caché. `README.md` y `docs/DEV_WORKFLOW.md` ahora recomiendan tests/typecheck filtrados durante la iteración y reservan el gate completo para integración. Ninguno de estos comandos genera APK, export web de distribución o imagen Docker.

## OC-09 — gates completos y revisión de temas — 17 de noviembre de 2026, 08:37 UTC

En el árbol de trabajo vigente: `corepack pnpm test` → 8/8 targets (8 en caché); `corepack pnpm typecheck` → 12/12 (11 en caché, uno ejecutado); `corepack pnpm lint` → 0 errores y 20 advertencias; `corepack pnpm format:check` → PASS; `git diff --check` → PASS. La inspección estática de Business no encontró `Colors.light` ni colores hexadecimales locales en sus pantallas; su tema usa el hook compartido y tokens. `seller-pages.css` tiene reglas `prefers-color-scheme: dark` para directorio y página de vendedor. No hay navegador automatizable ni dispositivo conectado en este host, así que no se afirma revisión visual; Buyer, Business y storefront aún necesitan recorrido visual claro/oscuro en un navegador/dispositivo. Sin build o publicación.

## Color predeterminado del paquete de iconos — 17 de noviembre de 2026, 08:51 UTC

Se eliminó el `#171717` fijo de la entrada nativa de `@agestyles/icons`: los iconos que no reciben `color` ahora usan `colors.light.text` o `colors.dark.text` según `useColorScheme()`. La entrada web continúa heredando `currentColor`. Se añadió `@agestyles/design-tokens` como dependencia workspace y se corrigió la auditoría, que también declaraba pendientes obsoletos para iconos y la banda APK. Verificado localmente: typecheck completo 12/12; typecheck propio de icons; ESLint/Prettier dirigidos; `pnpm install --lockfile-only --offline` deja el lockfile actualizado. CI del commit `09b5ed2` [run 44050404722](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44050404722) terminó success: lint, formato, tests, typecheck, build aislado de Medusa, exports web Buyer/Business y build Next. No hay revisión visual en dispositivo.

## Tarjetas de catálogo sin falso control de favoritos — 17 de noviembre de 2026

Se retiró el corazón decorativo de `product-explorer`: era parte del enlace de producto, no ejecutaba favoritos y podía sugerir una acción inexistente. También se quitaron sus reglas CSS claras/oscuras. El resto de controles de favoritos auténticos en las apps no se modificó. Validación: typecheck de storefront PASS; ESLint dirigido PASS; Prettier en TSX/CSS/docs PASS; `git diff --check` PASS. CI del commit `667fdd7` [run 44051230463](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44051230463) terminó success, incluido el build de Next. No se publicó la interfaz.

## Tamaño mínimo de iconos de control — 17 de noviembre de 2026, 09:02 UTC

Se subieron a 20 px los botones de cantidad del detalle Buyer y el chevron de selección/escudo informativo del acceso Business. `docs/design-system.md` ahora distingue controles (20–24 px), iconos en línea (12–16 px), adornos de campos (18–20 px) e ilustraciones/estados (hasta 28 px). Verificación local: `pnpm typecheck` 12/12, ESLint dirigido, Prettier dirigido y `git diff --check` PASS. CI del commit `ad53e29` [run 44051795148](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44051795148) terminó success, incluidos tests, typecheck, build Medusa, exports Buyer/Business y build Next. Sin render en dispositivo.

## Revisión de pendientes OpenCode — 17 de noviembre de 2026

La cola `docs/OPEN_CODE_TASKS.md` no tiene tareas de implementación OC-01–OC-08 abiertas; sus restricciones externas (no ejecutar probes destructivos, no restaurar datos, no compilar APK con poco espacio) se mantienen. OC-09 era la única tarea local pendiente.

La revisión estática de apps encontró dos checks Unicode en el selector de región/envío del comprador y una flecha Unicode para volver desde modo comprador en Business. Se reemplazaron por `Icon` (`check`/`arrowLeft`) de `@agestyles/icons`; no se añadieron dependencias. No quedaron esos glifos en Buyer, Business ni Storefront. Prettier se limitó a `region-selector.tsx`.

Gates actuales: `corepack pnpm test` → 8/8 targets (7 en caché); `corepack pnpm typecheck` → 12/12 (10 en caché); `corepack pnpm lint` → 0 errores, 20 advertencias preexistentes; `corepack pnpm format:check` → PASS; `git diff --check` → PASS. No se construyó APK ni se publicó.

OC-09 continúa pendiente solo en su aceptación visual: recorrer rutas completas de Buyer, Business y Storefront en temas claro/oscuro en navegador/dispositivo, y validar Android/iOS donde aplique. El host no ofrece navegador automatizable ni dispositivo Android/iOS conectado; no se declara esa revisión completada.

## F6 — Informe agregado de conciliación del proyector — 17 de noviembre de 2026

Se amplió `tools/migration/project-catalog-projection.mjs`: la salida efímera ahora compara conteos entre las cuatro proyecciones fuente y el bundle staging (categorías+subcategorías, productos, variantes y metadatos de medios), informa productos por moneda/estado permitido y cuenta presencia/ausencia de `store_id`. No emite valores desconocidos, IDs, nombres, precios, URLs ni payload; el store ID no se equipara a una asignación seller válida.

La suite de migración agregó una verificación sintética de conciliación y repetibilidad: dos bundles con el mismo export_id/proyección producen manifiestos y hashes iguales. `corepack pnpm migration:test` → 11/11; `corepack pnpm test` → 8/8 targets; `corepack pnpm typecheck` → 12/12; `corepack pnpm lint` → 0 errores/20 advertencias; `corepack pnpm format:check`, Prettier dirigido y `git diff --check` → PASS. No se consultó ni exportó Supabase, no se importó a Medusa y no se ejecutaron builds.

Este avance solo mejora el preflight sintético. F0/F6 reales siguen bloqueadas por destino cifrado y restore, `pg_dump --schema-only` aprobado, y decisiones explícitas de seller, USD/CUP, stock y medios.

CI del commit `c79f5f7` [run 44056377199](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44056377199) terminó success: lint, formato, tests, typecheck, build aislado de Medusa y exports web Buyer/Business/Storefront.

La revisión del proyector encontró que una lista de opciones vacía (`[]` o la cadena JSON `"[]"`) producía cero variantes, pese a que el contrato exige `__default__` cuando el producto no tiene opciones. Se corrigió la normalización y se añadieron pruebas para ambas representaciones. Verificación: `migration:test` 12/12, `pnpm test` 8/8, ESLint/Prettier dirigidos y formato PASS; sin conexión ni exportación de datos reales.

## F6 — Deduplicación de medios por contenido — 17 de noviembre de 2026

El proyector de catálogo ahora crea un objeto staging por SHA-256 compartido, conserva `display_order` y `is_primary` en cada referencia producto→medio, rechaza IDs de imagen fuente repetidos y rechaza el mismo hash declarado con MIME incompatible. La conciliación reporta hashes únicos y filas de imagen duplicadas, y compara medios staging con hashes únicos. Se añadió prueba sintética con dos productos y orden/primaria distintos; el validador `catalog-only` la acepta.

Verificación local: `corepack pnpm migration:test` → 13/13; `corepack pnpm test` → 8/8 targets; ESLint dirigido, `corepack pnpm format:check`, Prettier dirigido y `git diff --check` → PASS. No hubo conexión a Supabase/PostgreSQL, lectura/exportación de filas reales, descarga de medios ni importación. F6 real sigue pendiente de backup/restore y export/import aprobados.

## F5 — Exportación del actor comprador como paquete compartido — 17 de noviembre de 2026

Business ahora declara `@agestyles/features-buyer` como dependencia workspace y consume `cart` y `business-buyer-session` por exports públicos del paquete, no por rutas internas a `packages/**/src`. Nx refleja la arista `@agestyles/business-app` → `@agestyles/features-buyer`. Se añadieron pruebas sintéticas para login customer, recuperación del customer, logout delegado al actor customer, desafío MFA sin lectura de customer y sesión expirada que devuelve `null`.

Verificación: test de `features-buyer` PASS; typecheck del paquete y Business PASS; typecheck monorepo 12/12; tests Nx 8/8; grafo Nx 13 proyectos/18 dependencias y arista Business→Buyer features confirmada; ESLint/Prettier dirigidos y formato PASS. CI del commit `9b37aea` [run 44057675651](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44057675651) terminó success, con build aislado Medusa y exports web de Buyer, Business y Storefront. La revisión UI de login/alternancia y refresh/revocación sigue pendiente en navegador/dispositivo; no se usaron cuentas ni API real.

F6: la revisión del proyector encontró que una lista de opciones vacía (`[]` o la cadena JSON `"[]"`) producía cero variantes, pese a que el contrato exige `__default__` cuando el producto no tiene opciones. Se corrigió la normalización y se añadieron pruebas para ambas representaciones. Verificación: `migration:test` 12/12, `pnpm test` 8/8, ESLint/Prettier dirigidos y formato PASS; sin conexión ni exportación de datos reales.

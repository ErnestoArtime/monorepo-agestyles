# Registro de trabajo compartido con Codex

## Turno 2026-11-18 — codex: AG-22 estados robustos de Favoritos Buyer

- Reclamé AG-22 en `docs/TABLERO.md`; cambios limitados a la pantalla `apps/buyer-app/app/(drawer)/(tabs)/favorites.tsx`.
- Añadí un identificador de petición para ignorar resultados y errores de cargas obsoletas cuando cambian favoritos o región, y limpiar correctamente el error al vaciar la lista.
- Ordené los estados vacíos: carga con indicador y texto; error con mensaje separado y botón Reintentar accesible, usando colores de superficie/acción del tema claro u oscuro.
- Verificación ejecutada: `pnpm --filter @agestyles/buyer-app exec tsc --noEmit` → OK; `git diff --check` → OK. No añadí ni ejecuté tests por preferencia del usuario. CI remoto y revisión de Claude pendientes.
- CI #138 (`44201575200`, SHA `4ed81cd`) terminó `success`: lint, formato, unitarias, typecheck, build/smoke del API y exportaciones web Buyer, Negocio y Catálogo. La revisión cruzada de Claude sigue pendiente.

## Turno 2026-11-18 — codex: AG-13 auditoría y recuperación de Buyer

- Revisión de código con codebase-memory: Buyer y Business resuelven los tokens claros/oscuros desde el sistema compartido; Catálogo web define `prefers-color-scheme: dark`.
- Hallazgo funcional en la portada Buyer: si el listado de regiones falla (o vuelve vacío), `selectedRegion` permanece nulo; Home no miraba el estado/error del `RegionProvider` y conservaba el loader de productos indefinidamente.
- El `RegionProvider` expone `reloadRegions`; Home ahora separa carga inicial de región, error/falta de región y carga de productos. Error incluye recuperación accesible con colores del tema activo.
- `pnpm --filter @agestyles/buyer-app exec tsc --noEmit` y `git diff --check` pasan; no ejecuté tests. No hay fixtures visuales en las apps ni navegador Playwright ejecutable en este entorno, por lo que la evidencia renderizada clara/oscura y el resto de las pantallas siguen pendientes en AG-13.
- CI #144 (`44203432915`) solo falló en formato de `apps/buyer-app/app/(drawer)/(tabs)/(home)/index.tsx`; ejecuté Prettier sobre ese archivo y el diff quedó limpio. Nueva ejecución tras este arreglo pendiente.

**Propósito:** dejar constancia de lo que modifica la sesión OpenCode para que Codex lo revise antes de dar por cerrada una fase. No sustituye al plan maestro ni al status: los complementa.

**Tareas y estado:** viven en el [tablero único](./TABLERO.md); este archivo es el registro de turnos (solo añadir al final).

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

## F6 — Contrato de relación producto→medio — 17 de noviembre de 2026

El proyector exige ahora `display_order` entero no negativo y `is_primary` booleano, sin órdenes repetidos ni más de una imagen principal por producto. `catalog-only` valida la forma/tipo de esos metadatos, que las relaciones estén ordenadas en ascendente, que `media_count` coincida cuando se declara y que cada objeto SHA-256 aparezca una sola vez. El fixture canónico documenta la extensión de relación y mantiene su manifiesto actualizado.

Verificación local: `corepack pnpm migration:test` → 14/14; `corepack pnpm test` → 8/8; lint → 0 errores/20 advertencias; `corepack pnpm format:check` y `git diff --check` → PASS. No hubo importación ni acceso a servicios.

## F1 — Hallazgo estático adicional de `/vendor/orders` — 17 de noviembre de 2026

El manifiesto de Mercur 2.4.1 muestra que `/vendor/orders` filtra por seller y luego usa una proyección con relaciones profundas predeterminadas aunque el cliente pida `fields=id`. El paquete instalado comenta que ciertas expansiones profundas pueden causar fallos de query. Es una hipótesis compatible con el 500 de Kickz/B1, no causa raíz probada; no se modifica upstream ni se cambian los defaults, que podrían retirar datos requeridos por la UI. El siguiente paso sigue siendo capturar stack trace en una reproducción desechable autorizada; no se llamó al API/DB ni se leyó configuración secreta.


## F1/F5/F7 — Contrato sintético del resolver de permisos seller — 17 de noviembre de 2026

Se añadió `apps/commerce-api/test/seller-permissions.test.mjs` al target `@agestyles/commerce-api:test` (runner glob `node --test test/*.test.mjs`). Comprueba permisos declarados para owner, inventory manager y SUPPORT/viewer, superficie admin, actor/superficie inválidos, rol desconocido y la consulta de pertenencia compuesta por membership ID + member ID + seller ID, que deniega combinaciones cruzadas. Los mocks son en memoria; no se llama a servicios, DB ni red. La suite del API pasa 6/6 incluyendo tracking; `pnpm test` 8/8, `pnpm typecheck` 12/12, lint sin errores (20 advertencias preexistentes), formato y `git diff --check` PASS. CI del commit `1bb366a` [run 44063162920](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44063162920) terminó success. Esto fortalece el contrato pero no sustituye BOLA/runtime en el laboratorio ni las pruebas UI/UAT pendientes.


## Infraestructura del host — 17 de noviembre de 2026, 10:19 UTC

Lecturas actuales: disco de 193 GiB con 3.2 GiB disponibles, RAM total 11 GiB con 3.5 GiB disponibles y swap 2 GiB casi consumida. `adb devices -l` no enumera un teléfono/emulador Android. No iniciar builds nativos, descarga de imágenes ni limpieza de Docker con este margen.


## Revalidación de rutas públicas — 17 de noviembre de 2026, 10:24 UTC

HTTP GET sin escribir: catálogo, comprador y negocio responden 200; gateway buyer `store/regions` y `store/products?limit=1` responden 200, total agregado 12. El path de tracking sintético responde 404/`Cannot GET` tanto al API loopback `127.0.0.1:19081` como al gateway, sin customer auth; compatible con ruta fuente ausente de la imagen vigente. No se autenticó cuenta, ni se imprimió la publishable key. Las portadas 200 y el API no sustituyen el recorrido visual/checkout.


## F4 — Corrección previa a publicar Commerce API — 17 de noviembre de 2026

Se resolvió el desajuste de puertos: `pnpm start`, ambos gateways, `EXPOSE`, el healthcheck de `buyer-web.yaml` y la verificación del runbook ahora coinciden en `19081`. Se añadió `apps/commerce-api/test/publish-config.test.mjs` que protege esta consistencia. API tests 7/7; `pnpm test` 8/8; typecheck 12/12; lint 0 errores/20 advertencias; formato y `git diff --check` PASS. `docker compose -f infra/compose/buyer-web.yaml config --services` muestra `commerce-api`, `buyer-gateway`, `buyer-web`. No se construyó ni publicó imagen; quedan 3.2 GiB libres y hay que preservar espacio para rollback. Tracking sigue en 404/`Cannot GET` hasta actualizar el runtime.


CI de `ec0bd17` terminó `success`: [run 44066099747](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44066099747). Esto verifica gates y builds CI; no hubo dispatch de publicación ni despliegue VPS.

## Revisión de pendientes OpenCode — 17 de noviembre de 2026

La cola `docs/OPEN_CODE_TASKS.md` confirma OC-01–OC-08 completadas. OC-09 sigue abierta únicamente para revisión visual clara/oscura de rutas completas de Buyer, Business y Storefront; los cambios estáticos y la banda de validación local están listos. Reejecutado en el árbol actual: `corepack pnpm test` 8/8 (caché), `corepack pnpm typecheck` 12/12 (caché), `corepack pnpm lint` 0 errores/20 advertencias y `corepack pnpm format:check` PASS. El host no tiene navegador instalado ni Android conectado; quedan 3.1 GiB libres. Por tanto no se afirma validación visual y no se inicia build nativo ni limpieza de disco.

## CI de imagen Commerce API — 17 de noviembre de 2026

El commit `3444eef` está en `main`; CI [run 44067825900](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44067825900) terminó success con `Dockerfile.public` y `push: false`. El gate del commit `c9b7502` también terminó success en [run 44068837811](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44068837811): instaló las migraciones en PostgreSQL desechable, inició Commerce API conectado a Redis desechable y verificó `/health`; luego eliminó el contenedor API. Buyer, Business y Storefront exportaron/compilaron. No se publicó la imagen ni se tocaron servicios del VPS.

## F4/F5 — Contrato del carrito comprador compartido — 17 de noviembre de 2026

`packages/features-buyer/test/cart.test.ts` cubre carrito persistido válido, recuperación de ID obsoleto, `clear` con/sin región, transferencia de ID nuevo y añadir ofertas de dos vendedores al mismo carrito. El paquete tiene 6 pruebas verdes. CI del commit `8923f88` [run 44071834569](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44071834569) terminó success: lint, formato, pruebas, typecheck, imagen sin publicar, migraciones y healthcheck con PostgreSQL/Redis desechables, export de Buyer/Business y build del storefront. El lint global queda en 0 errores/19 warnings preexistentes. No se hicieron llamadas de compra a API/DB ni se probaron credenciales reales.

## F4 — Revalidación de catálogo por gateway público — 17 de noviembre de 2026, 11:13 UTC

Preflight CORS desde `https://tienda.eav-labs.com` a `store/regions`: HTTP 204, origen permitido exacto y headers `x-publishable-api-key,x-medusa-locale`. GET de regiones con clave publicable: 200/1; GET de productos para esa región: 200/12 recibidos. Las 12 miniaturas declaradas respondieron HEAD 200. La clave se usó en memoria y no se imprimió. Esto verifica gateway y API pública, no el render interactivo ni el checkout en navegador/dispositivo.

La inspección visual OC-09 sigue pendiente: no hay navegador de automatización disponible, `adb devices -l` no lista dispositivos y quedan 3.1 GiB libres, por debajo del umbral de 8 GiB para instalar/crear un emulador. CI sí confirmó que las exportaciones web compilan; eso no sustituye la revisión clara/oscura en rutas completas ni TalkBack.

## F1/F5 — Comprobación defensiva de identidad de membresía — 17 de noviembre de 2026, 11:27 UTC

`SellerPermissionsService` ahora valida que la fila retornada coincida en `id`, `member_id` y `seller_id` con el actor y la tienda seleccionada antes de conceder cualquier permiso. La prueba nueva simula que el servicio ignora filtros y devuelve una membresía owner/admin de otra tienda, otro usuario o con otro ID; los tres casos quedan sin permisos. API tests 8/8, typecheck dirigido de Commerce API PASS, ESLint/Prettier dirigidos y `git diff --check` PASS. CI del commit `81774df` [run 44074681686](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44074681686) terminó success, incluidos migraciones/healthcheck de API en PostgreSQL/Redis desechables y export/build web. Es una defensa adicional de la política; no sustituye las pruebas BOLA sobre rutas HTTP, base de datos y revocación.

## F0/F6 — Estado de esquema vivo y migración de medios — 17 de noviembre de 2026, 11:27 UTC

Consulta de metadatos de solo lectura a `Agestyles-Catalogo`: 80 migraciones aplicadas, última `20261116061921_merchant_order_line_fulfillment`. Se revisó el archivo fuente pendiente `20261116120000_merchant_product_media.sql`: define RPCs autenticadas para adjuntar/quitar/seleccionar imágenes de borradores merchant, pero no exporta productos ni migra medios históricos. No se aplicó la migración ni se leyeron filas de negocio. El checkout fuente ya tenía cambios no relacionados sin seguimiento; se dejaron intactos.

## F4 — Smoke de tracking en runtime aislado de CI — 17 de noviembre de 2026, 11:48 UTC

El CI del commit `b224d23` [run 44078209194](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44078209194) terminó success. Además de `/health` HTTP 200, el contenedor migrado y ejecutado contra PostgreSQL/Redis desechables recibe `GET /store/orders/order_ci_synthetic/tracking` sin `x-publishable-api-key` y responde HTTP 400. La primera versión del check esperaba 401; el runtime mostró que la capa Store exige primero la clave publicable y se corrigió la expectativa. El test unitario de ruta cubre por separado handler sin sesión (401), pedido de otro customer (404), y proyección del dueño. Ninguno demuestra todavía que el endpoint exista en la imagen desplegada del VPS ni sustituye BOLA con autenticación real.

## Revisión y cierre de tareas locales OpenCode — 17 de noviembre de 2026

Se volvió a revisar la cola `docs/OPEN_CODE_TASKS.md`, su informe de iconos y el estado limpio del árbol. OC-01–OC-08 están completadas; OC-05 queda cerrada en su alcance de auditoría estática y sus correcciones. Se actualizaron sus estados y se añadió una aclaración final a `docs/ui/icon-ecosystem-audit.md` para separar hallazgos históricos ya corregidos de lo que todavía requiere dispositivo.

OC-09 es la única tarea OpenCode que permanece abierta: inspección visual de rutas completas en tema claro/oscuro y prueba TalkBack/VoiceOver. No hay navegador instalado ni Android conectado; el disco tiene 3.1 GiB libres frente al umbral documentado de 8 GiB para emulador. No se inició build, descarga ni limpieza.

Gates reejecutados en este corte: `corepack pnpm test` → 8/8; `corepack pnpm typecheck` → 12/12; `corepack pnpm lint` → 0 errores y 19 advertencias existentes; `corepack pnpm format:check` → PASS. El seed histórico se excluye del formato para evitar un reflujo masivo; sigue cubierto por ESLint y TypeScript. La inspección visual no se declara realizada.

## F1/F5/F7 — Permisos seller por HTTP en CI desechable — 17 de noviembre de 2026

Se amplió `.github/workflows/ci.yml` para poblar el PostgreSQL/Redis efímero con el seed de laboratorio, crear dos propietarios × dos tiendas, aprobar las tiendas sintéticas, preparar inventario/ofertas y ejecutar por HTTP la matriz existente de roles y denegaciones cruzadas. El seed admite `AGESTYLES_LAB_SEEDED_PASSWORD` con fallback sin cambios para desarrollo; la clave publicable se extrae de esa base efímera y se enmascara en Actions. Ninguna operación apunta al laboratorio compartido. CI del commit `f30af7b` [run 44081670026](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44081670026) terminó success, incluidos seed, creación de cuatro tiendas, permisos por HTTP y rechazos entre propietarios; lint, formato, tests, typecheck, build aislado del API y exports web también pasaron. Esto fortalece F1/F5/F7; no valida los flujos en el VPS ni reemplaza E2E del checkout.

## F5 — Solicitud de retiro de variante desde Business — 17 de noviembre de 2026

La interfaz de productos ahora ofrece a miembros con `products.manage` solicitar el retiro de una variante. Presenta confirmación, envía `DELETE /vendor/products/{product}/variants/{variant}` al flujo de cambios de Mercur y explica que la variante permanece publicada hasta la aprobación de AgeStyles. La app no habilita esta acción para roles con solo `products.edit`; el servidor de Mercur 2.4.1 exige `products.manage`, valida la tienda y confirma que la variante pertenece al producto. El gateway público permite únicamente `DELETE` en esa ruta anidada. Tests Business 4/4, typecheck Business PASS, ESLint dirigido PASS, `pnpm test` 8/8, `pnpm typecheck` 12/12, lint 0 errores/19 advertencias y `format:check` PASS. CI del commit `0aa93b9` [run 44083538913](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44083538913) terminó success: preflight DELETE permitido y POST rechazado en la ruta del gateway, tests/typechecks, build aislado del API, matriz HTTP seller en PostgreSQL/Redis efímeros y export/builds web. No se desplegó al VPS.

## F4/F7 — Checkout mixto y propiedad de seguimiento en HTTP — 17 de noviembre de 2026

Se añadió `apps/commerce-api/scripts/verify-mixed-checkout-buyer-ownership.mjs`, protegido con una guarda explícita `AGESTYLES_CI_DISPOSABLE=true` y límites a PostgreSQL loopback del runner y API `127.0.0.1:19081`. El script crea dos customers sintéticos, añade ofertas A2/B2 al mismo carrito, completa dirección/envío/pago de laboratorio, solicita y acepta una quote, comprueba un grupo con dos pedidos hijos seller-scoped y valida que el customer dueño obtiene tracking mientras el segundo recibe 404 sin datos. Solo se ejecuta en CI, donde PostgreSQL/Redis se descartan al terminar; no crea fulfillment, tracking label ni escribe en el laboratorio compartido.

CI del commit `44643fc` [run 44087586663](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44087586663) terminó success. En el mismo job, el nuevo verificador HTTP de retiro de variante del commit `d6e76d2` ya había pasado en [run 44085868401](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44085868401): gestor y solo lectura reciben 403, owner recibe 202 con cambio de producto pendiente. Gates locales tras estos cambios: test 8/8, typecheck 12/12, lint 0 errores/19 advertencias, formato PASS y `git diff --check` PASS. Ninguno de estos resultados valida el API del VPS, la UI visual ni fulfillment real.

## F2/F4/F5 — Unificación del API por defecto para las apps — 17 de noviembre de 2026

Los SDK de Buyer y Business, el ejemplo de entorno de Business, el verificador de mercado y el runbook local todavía señalaban `127.0.0.1:19080`, mientras que el API/gateways/healthcheck vigentes usan `19081`. Se alinearon las URLs por defecto y se extendió `apps/commerce-api/test/publish-config.test.mjs` para cubrir ambos SDK, comprador integrado, verificador y ejemplos `.env`. Se corrigieron también los comandos de `docs/mercur-lab.md`. Esto evita que una ejecución sin `.env.local` hable al proceso antiguo; no demuestra que esta fuera la causa del APK ya instalado, que pudo incluir una URL explícita.

Gates: test 8/8, typecheck 12/12, lint 0 errores/19 advertencias, Prettier y `git diff --check` PASS. CI del commit `0bd48a7` [run 44090686807](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44090686807) terminó success, incluidas exportaciones Buyer/Business/Storefront. No se cambió ninguna URL pública ni se desplegó.

## F4 — Revalidación pública del catálogo Buyer — 17 de noviembre de 2026

Desde el origen `https://tienda.eav-labs.com`, el gateway público `https://descargas.eav-labs.com/agestyles-lab` respondió CORS OPTIONS 204 con el origen exacto y permite `x-medusa-locale`/`x-publishable-api-key`. GET regiones 200/1, GET productos 200/12; la respuesta real incluye `Access-Control-Allow-Origin` correcto y las 12 miniaturas respondieron HEAD 200. La clave publishable se leyó en memoria y no se imprimió. El catálogo/API/gateway tienen respuesta; esto no prueba qué URL/API quedó embebida en la APK instalada ni que el render nativo muestre las respuestas.

## F5 — Preparación de pedidos seller en Business — 17 de noviembre de 2026, 13:56 UTC

Se añadió detalle/preparación de pedido en `apps/business-app/app/(tabs)/orders.tsx`: cantidades pendientes, selección de ubicación de la tienda y acción de preparar fulfillment solo con `orders:edit`.

El endpoint `POST /vendor/agestyles/orders/:id/fulfillments` reutiliza `createOrderFulfillmentWorkflow` de Mercur y valida en servidor el permiso resuelto por Mercur, el vínculo `order_seller`, el vínculo `stock_location_seller`, las líneas del pedido y las cantidades aún no preparadas. El gateway seller permite solo esa ruta, el detalle de pedido GET y stock-locations GET; el endpoint estándar de fulfillment Mercur no se expone al gateway.

Los verificadores de CI protegidos para PostgreSQL/Redis desechables cubren fulfillment A2, denegación por tienda/ubicación B2, repetición, propietario, gestor de inventario y solo lectura. Gates locales: typecheck 12/12, tests 8/8, lint 0 errores/19 advertencias, formato y `git diff --check` PASS. CI remoto pendiente; no se desplegó ni se escribió en el laboratorio compartido.

## F5 — CI de preparación y permisos de fulfillment — 17 de noviembre de 2026

El commit `6d90e8b` corrigió el tipo de error de autorización: `MedusaError.Types.NOT_ALLOWED` respondía 400, así que la ruta ahora usa `FORBIDDEN` para devolver 403 a roles sin `orders:edit`. El formato y el typecheck local de Commerce API pasan. CI [run 44101193002](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44101193002) terminó success: permisos de seller, checkout mixto, creación de fulfillment en pedido A2, rechazo de ubicación B2, repetición, gestor de inventario y solo lectura se ejecutaron contra PostgreSQL/Redis efímeros; exports Buyer/Business y build del storefront también pasaron. Los verificadores exigen `AGESTYLES_CI_DISPOSABLE=true`; no tocaron el laboratorio compartido. No se publicó imagen ni se desplegó.

## Avance local de localización y F6 — 17 de noviembre de 2026, 15:15 UTC

- Buyer/Business convierten errores API y enums visibles en español; Storefront ajusta etiquetas de reserva. También se corrigieron la pestaña de inventario, los nombres del seed de envío y el fallback de métodos de pago. `AGENTS.md` establece español para las interfaces. La proyección de catálogo normaliza algunos nombres conocidos y conserva sus valores originales en metadata.
- Se prepararon `tools/migration/export-public-supabase-catalog.mjs` (lectura acotada con clave anon, allowlist, conteo fijo, salida privada fuera del repo) e `import-catalog-bundle-to-medusa.mjs` (dry-run por defecto; apply loopback con guardas; drafts idempotentes, sin sellers/precios/stock/bytes de medios). Se documentaron comandos y límites.
- Se añadió provider S3 opcional de Medusa y perfil MinIO con volumen persistente y puertos loopback; el proveedor local sigue por defecto. No se arrancó el perfil. Hace falta configurar el origin HTTPS antes de exponer medios; pasos en `docs/runbooks/minio-media-lab.md`.
- La revisión de Supabase quedó limitada a catálogo público y agregados, sin usuarios/pedidos/datos personales: 33 productos, 31 imágenes, 5 categorías, 14 subcategorías, cero tiendas/comercios/variantes comerciales. El export/import real no se ejecutó; faltan backup cifrado + restore, almacenamiento de imágenes y mapeos de seller/moneda/stock.
- No se ejecutaron pruebas ni builds en este avance. `git diff --check` pasó. El árbol sigue local y sin commit sobre `main` `5a9d56e`; el host tiene 2.8 GiB libres (99 % usado). No publicar ni limpiar recursos antes de revisar capacidad y gates.

## Revisión de español y exportación del catálogo — 17 de noviembre de 2026

- Búsqueda acotada de etiquetas inglesas en Buyer, Business y Storefront: no encontró texto inglés renderizado en las coincidencias inspeccionadas; sí aparecieron mensajes `console.error` internos en inglés, que no se muestran a clientes. Esto no sustituye una revisión visual completa de pantallas ni del contenido que se cargue dinámicamente.
- Buyer no contiene configuración de Supabase; el repositorio histórico sí. El exportador primero falló porque seleccionaba `products.category_slug`, campo que no existe en el esquema vivo. Se corrigió para leer `products.category` y generar la proyección real privada descrita abajo. No hizo escrituras en Supabase.
- No se hicieron pruebas/builds adicionales. `git diff --check` pasó después de consolidar la nota.

## Funcionalidad Buyer: favoritos — 17 de noviembre de 2026

- Buyer ahora tiene una pestaña `Favoritos`, guarda IDs de productos en AsyncStorage y permite marcarlos/quitar la marca en las tarjetas. La lista recupera los productos visibles de la región seleccionada; se adapta a claro/oscuro y reutiliza `@agestyles/icons`.
- Los favoritos son locales a este dispositivo; la sincronización de cuenta queda pendiente. No se ejecutaron tests ni builds. La única comprobación ejecutada fue `git diff --check`.

## F6 — proyección real del catálogo y dry-run — 17 de noviembre de 2026

- Se usó `/home/ernesto/proyectos/Agestyles-Catalogo/.env.local`; no se imprimieron valores. Después de corregir el alias de categoría en el exportador, este leyó únicamente categorías, subcategorías, productos publicados y metadatos/bytes públicos de imágenes para calcular hashes. Se creó el bundle privado `/home/ernesto/.local/share/agestyles-migrations/catalog-2026-11-17` con permisos 700 para el directorio y 600 para sus archivos.
- Exportación: 33 productos, 5 categorías, 14 subcategorías, 31 imágenes; 33 variantes derivadas de las opciones; 116 registros de staging y conteos concordantes. Los bytes de imagen solo se descargaron temporalmente para calcular hashes; `image_bytes_written=0`.
- Dry-run del importador: bundle válido, cero escrituras, 33 productos sin seller y sin stock mapeados; política de productos globales `draft`, categorías inactivas, sin precios efectivos ni carga de medios. PostgreSQL y Redis están healthy con `docker compose --env-file apps/commerce-api/.env -f infra/compose/mercur-lab.yaml ps`; `http://127.0.0.1:19081/health` devolvió 200. No se hizo `--apply` porque no hay JWT Admin disponible para el API loopback.
- No hubo llamadas de escritura a Supabase, importación a Medusa, tests ni builds. La aplicación posterior requiere decidir mapeos comerciales y medios; el bundle contiene datos de catálogo público y permanece fuera de Git.

## Dirección de migración — destino final, no más iteraciones de laboratorio

- El usuario pidió cargar los productos donde vivirán finalmente. Se confirmó en `docs/storefront-web-vps.md` que `catalogo.eav-labs.com` usa hoy `MEDUSA_BACKEND_URL=https://descargas.eav-labs.com/agestyles-lab`; no existe una API de producción separada en la configuración del repo/runtime inspeccionado.
- Los 33 productos legacy tienen `store_id=null`; el origen no tiene tiendas ni variantes comerciales. No se puede publicar una oferta/comprabilidad sin resolver vendedor y stock. No se ejecutará el importador loopback de laboratorio como atajo a una carga final.
- El usuario confirmó que quiere una tienda oficial AgeStyles para esos productos. De los datos de origen, 19 saldos corresponden a variantes pero no hay ubicación/tienda asociada; falta confirmar o crear la ubicación oficial al provisionar el destino final.
- Se amplió el exportador con `--media-directory`: guarda los archivos públicos por SHA-256, en una carpeta nueva con modo 700 y archivos 600, con tope de 25 MiB por imagen y 100 MiB por corte. Bundle y media actuales: `/home/ernesto/.local/share/agestyles-migrations/catalog-2026-11-17-with-media` y `/home/ernesto/.local/share/agestyles-migrations/catalog-media-2026-11-17`.
- Resultado de la ejecución real: 31 imágenes/2,123,500 bytes, hashes calculados contra los nombres de archivo 31/31; nuevo bundle con 116 registros y dry-run válido. No se hizo importación ni despliegue.

## Consolidación de cambios locales — 17 de noviembre de 2026, 19:30 UTC

- Los cambios descritos como "sin commit sobre `5a9d56e`" quedaron en la rama `feat/espanol-favoritos-minio` sobre `main` `d8a710c`: localización (`1b3ae3f`), favoritos Buyer (`09b2204`), perfil MinIO del laboratorio (`cb5931c`) y esta documentación. No se ha fusionado en `main` ni publicado.
- Antes del commit se aplicó Prettier a los archivos cambiados y se quitaron variables `catch` sin uso que dejó la traducción de errores. Resultados: `typecheck:quick` 11/11, `pnpm test` 8/8, `migration:test` 14/14, lint 0 errores/21 advertencias, `format:check` y `git diff --check` pasan. No se hizo build, export Expo ni revisión visual.
- Runtime de producción observado con `docker ps`: `agestyles-commerce-production-postgres-1` y `-redis-1` healthy; no hay contenedor `commerce-api` de producción. Existen archivos privados de entorno en `~/.config/agestyles-commerce-production` (no se leyeron valores). No se verificó si la tienda oficial ya se creó en la base de producción. Disco: 7.3 GiB libres (97 %).

## F6 — runtime de producción iniciado — 17 de noviembre de 2026, 20:30 UTC

- La imagen configurada antes (`sha256:402524d3…`) no incluía `create-official-seller.ts`. Se cambió `AGESTYLES_PRODUCTION_IMAGE` en el `compose.env` privado a la imagen de `main` `a078cf4` (`ghcr.io/ernestoartime/agestyles-commerce-api@sha256:ad4b4e371334eb33c13c6c2195bb81fc2849dc6cf07988b32e95f8ae1ddede55`, run 44160480892).
- La base `agestyles_commerce` estaba vacía (0 tablas). Se ejecutó `pnpm migrate` (209 tablas) y se arrancó `commerce-api` en `127.0.0.1:19085`; contenedor healthy y `/health` 200.
- Tienda oficial creada con `create-official-seller.ts`: `sel_01M7NH1254S7Z1HZ7YQTJT39N7`, nombre AgeStyles, estado `open`, moneda `usd`, `external_id=agestyles-official`.
- Dry-run del importador en modo producción con `catalog-supabase-links` y `AGESTYLES_PRODUCTION_REUSE_SOURCE_IMAGES=true`: bundle válido, 33 productos, 19 categorías, 33 variantes, 31 imágenes de origen, 0 escrituras.
- Pendiente: crear el usuario admin de producción (`medusa user` con `admin.env`) y obtener el bearer token; después `--apply`. Siguen faltando región, ubicación de stock, ofertas/precios e inventario. Las webs públicas siguen apuntando al laboratorio.

## F6 — catálogo importado en producción — 17 de noviembre de 2026, 21:00 UTC

- Usuario admin de producción creado con `medusa user` desde `admin.env` privado. Token obtenido por `/auth/user/emailpass` sin imprimirlo.
- `import-catalog-bundle-to-medusa.mjs --apply` en modo `production` con `catalog-supabase-links` y `AGESTYLES_PRODUCTION_REUSE_SOURCE_IMAGES=true`: 19 categorías y 33 productos creados, 0 omitidos.
- Verificación SQL de solo lectura: 33 productos `draft` con 33 `external_id` distintos, 33 variantes, 31 imágenes (todas URLs de Supabase), 19 categorías inactivas, 33 vínculos `product_seller` con `sel_01M7NH1254S7Z1HZ7YQTJT39N7`. Dos productos sin miniatura (el origen tiene 31 imágenes para 33 productos).
- Siguen pendientes: región USD, ubicación de stock de la tienda oficial, ofertas/precios, inventario (19 saldos), activar categorías y publicar productos. Las webs públicas siguen apuntando al laboratorio. Backup cifrado + restore de producción aún no existe.

## F6 — oferta comercial oficial en producción — 17 de noviembre de 2026, 22:00 UTC

- Decisiones del propietario: mercado Cuba en USD y CUP, stock desde los saldos de Supabase, recogida gratis + entrega a domicilio (5 USD por defecto), excluir el producto de 0 USD y el de 1600 USD (código 1031). Tasa CUP: debe tomarse de elTOQUE (`eltoque.com/tasas-de-cambio-cuba/dolar`); la página devolvió 403 a la descarga automática.
- **CUP no aplicado:** Medusa 2.22.3 no incluye `cup` en su tabla `currency` y el módulo de monedas no ofrece alta soportada. La tienda queda solo en USD. Opciones: mostrar CUP como conversión informativa en las apps con la tasa de elTOQUE (como hacía el legado), o registrar la limitación y valorar un alta de moneda antes de cobrar en CUP.
- Saldos leídos con la clave anon (`product_variant_stock`, solo publicados): 19 filas, 2 positivas (13 uds), ambas de talla/presentación sin variante en Medusa. `tools/migration/build-official-offer-plan.mjs` genera el plan privado `~/.local/share/agestyles-migrations/official-offer-plan-2026-11-17.json` (31 ofertas).
- `apps/commerce-api/src/scripts/setup-official-commerce.ts` (idempotente, dry-run por defecto, guardas de producción) se ejecutó montado en la imagen `a078cf4`: tienda `AgeStyles` en USD, región `Cuba` (`reg_01M7NJ8R4MZ4ME34ZJSG61XH43`, `pp_system_default`), región fiscal `cu`, ubicación `AgeStyles Oficial` (`sloc_01M7NJ8RATF2PVE8JJ77683RKS`, La Habana) con zona Cuba, opciones `Recogida en tienda` 0 USD y `Entrega a domicilio` 5 USD, 31 ofertas `AGS-OF-<código>` de 8 a 145 USD.
- Variantes: Nike (1015) pasa a opción `Talla` = `Hombre 9.5` con 3 uds; Glicinato de Magnesio (1018) a `Presentación` = `120` con 10 uds. El resto tiene 0 uds.
- Pendiente: productos siguen `draft` y categorías inactivas; publicar cuando se revise el catálogo. CUP, cambio de las webs públicas a la API de producción, backup cifrado/restore y UAT siguen abiertos.

## F6 — catálogo oficial publicado en producción — 17 de noviembre de 2026, 22:30 UTC

- `apps/commerce-api/src/scripts/publish-official-catalog.ts` (idempotente, dry-run por defecto) se ejecutó montado en la imagen `a078cf4`: 31 productos con oferta vinculados a `Default Sales Channel` (antes 0 productos tenían canal) y publicados; 5 categorías activadas (las usadas y sus padres). Los 2 productos sin oferta (0 USD y código 1031) y las 14 categorías vacías siguen ocultos.
- Verificación por la Store API de producción (`127.0.0.1:19085`, clave publicable sin imprimir): región `Cuba/usd`, `/store/products` devuelve 31 productos y los 31 tienen `calculated_price` en USD; `/store/product-categories` lista Suplementos vitamínicos; Ropa, calzado y accesorios; Ferretería; Calzado; Electricidad.
- No se cambió el origen de las webs públicas: `catalogo.eav-labs.com`, Buyer y Business siguen usando la API del laboratorio. Para exponer producción falta túnel/HTTPS, CORS y la clave publicable en sus builds. Siguen abiertos CUP, backup cifrado/restore y UAT.

## Webs públicas conectadas a la API de producción — 17 de noviembre de 2026, 21:45 UTC

- API pública única: `https://agestyles-api.eav-labs.com` → túnel Cloudflare compartido → `buyer-gateway` de producción (`127.0.0.1:19186`, sin prefijo) → API `19085`. El usuario añadió el hostname en el panel del túnel (CNAME protegido) y guardó una copia privada de la configuración anterior.
- Verificación HTTPS (resolviendo vía 1.1.1.1/8.8.8.8): `/store/regions` 200, `/store/products` 31 productos, preflight CORS desde `tienda.eav-labs.com` 204 con `access-control-allow-origin`, `/admin/*` y `/vendor/*` 404, origen ajeno 403.
- Copias de `.env.storefront-web` y `.env.buyer-web` en `~/.local/share/agestyles-deploy/env-backups-20261117` (600). Ambos apuntan ahora a `https://agestyles-api.eav-labs.com` con la clave publicable de producción.
- `tienda.eav-labs.com`: exportación Expo nueva (`entry-2e63090358a896c8432ba58112ba3e54.js`) desplegada; el bundle contiene la URL de producción y ninguna referencia al laboratorio. Healthz local 200. Sin recorrido visual en navegador.
- `catalogo.eav-labs.com`: configuración cambiada; el reinicio espera a que los resolvedores del proveedor del VPS (195.179.224.53, 209.126.15.53) caduquen la respuesta negativa cacheada (SOA mínimo 1800 s).
- Hallazgo previo: el gateway del laboratorio (`descargas.eav-labs.com/agestyles-lab`) devolvía 502 porque reenvía a `19081` y la API del laboratorio escucha en `19080`.
- Pendiente: el aviso de portada de Buyer aún dice que catálogo y pedidos son de prueba; el enlace APK sigue apuntando al APK de laboratorio; Negocio no está conectado a producción, así que la tienda oficial no puede gestionar pedidos desde la app todavía.

## Corrección de stock migrado — 17 de noviembre de 2026, 22:30 UTC

- Síntoma: en `tienda.eav-labs.com` casi todas las fichas salían «Agotado». Causa: el plan de ofertas solo leyó `product_variant_stock`; el legado calcula disponibilidad con la suma de esas filas cuando existen y, si no hay filas, con `products.stock`. Trece productos (1001–1013) tenían 1 unidad en `products.stock` y quedaron con 0.
- `build-official-offer-plan.mjs` ahora recibe un snapshot de disponibilidad con esa regla (`~/.local/share/agestyles-migrations/legacy-availability-2026-11-17.json`, lectura anon). Las reservas activas del legado no son legibles con la clave anon; se usaron unidades físicas.
- `setup-official-commerce.ts` informa diferencias de stock de ofertas existentes y solo las reescribe con `AGESTYLES_OFFICIAL_SYNC_STOCK=true`. Con 0 pedidos y 0 reservas en producción se aplicaron 13 cambios 0→1. Store API: 31 ofertas, 15 `in_stock` (1001–1013, 1015, 1018), 26 unidades.

## Catálogo y Negocio conectados a producción — 17 de noviembre de 2026, 22:45 UTC

- `catalogo.eav-labs.com` recreado con `.env.storefront-web` apuntando a `https://agestyles-api.eav-labs.com` (clave publicable de producción) cuando el DNS del proveedor del VPS dejó de devolver la respuesta negativa. Healthz 200; la portada pública lista productos de producción en USD y las 5 categorías activas.
- `negocio.eav-labs.com`: `seller-gateway` de producción en `127.0.0.1:19187` con prefijo `/negocio`; ruta del túnel `agestyles-api.eav-labs.com` + `^/negocio/` añadida por el usuario por encima de la entrada general. Export Expo (`entry-38841f7483ffb4654a37ec296d36d98f.js`) desplegado; recorrido HTTPS externo del titular: login 200, selección de tienda 200, 31 productos.
- Avisos pendientes de decisión: pie del catálogo «Experiencia beta · Productos y pedidos de prueba» y aviso equivalente en la portada de Tienda. El producto Nike (1015) trae del legado la descripción literal «prueba».

## Turno 2026-11-17 22:00 UTC — claude: tablero único y protocolo de coordinación

- A petición del usuario, Codex, Claude Code y OpenCode comparten ahora una fuente única de tareas y un objetivo: [`docs/TABLERO.md`](./TABLERO.md). `OPEN_CODE_TASKS.md` queda archivado con un enlace al tablero; sus tareas abiertas pasaron a AG-02 y AG-11…AG-14.
- `AGENTS.md` añade la sección «Coordination between agents» y `CLAUDE.md` importa `AGENTS.md` para que ambos agentes sigan las mismas reglas.
- Reparto propuesto (pendiente de confirmar por el usuario y Codex): claude → AG-03 movimientos de inventario y AG-06 gestores de venta; codex → AG-04 etapas de preparación y AG-05 importación CSV, además de sus tareas ya asignadas (backup, Kickz, QA, nativo).
- Revisión cruzada pedida a Codex: todo el trabajo de producción de claude del 17 nov y sus ediciones de `STATUS_PLAN_MAESTRO.md` hechas antes de este protocolo (lista en el tablero).

## Turno 2026-11-17 22:10 UTC — claude: AG-01 API con tasa CUP desplegada

- CI publicó `9b16175` (run 44178536153). `AGESTYLES_PRODUCTION_IMAGE` pasó a `ghcr.io/ernestoartime/agestyles-commerce-api@sha256:c3235c65106747250b7ed4811a5af7f255a3bc28afa125b048bd3a24954274f7`; copia previa de `compose.env` en `~/.local/share/agestyles-deploy/env-backups-20261117/compose.env.before-9b16175`.
- `pnpm migrate` sin migraciones nuevas; `commerce-api` recreado y healthy, `/health` 200. Por HTTPS: `/store/agestyles/exchange-rate` → `{"exchange_rate":null}`; 31 ofertas, 15 con stock.
- Antes: Tienda (`entry-dfd87702…`) y Catálogo desplegados con CUP de referencia y WhatsApp; número `+5353093096` en `metadata.whatsapp_phone` de la tienda oficial. Falta la tasa (usuario) y una compra real (AG-11).

## Turno 2026-11-17 22:30 UTC — claude: revisión de STATUS para Codex (AG-15)

- El usuario pidió revisar `STATUS_PLAN_MAESTRO.md` de forma conjunta. Claude no lo edita: dejó la propuesta en [`docs/reviews/2026-11-17-status-plan-maestro.md`](./reviews/2026-11-17-status-plan-maestro.md) con 10 datos desactualizados, lo que falta (foto de producción, riesgos, paridad con el legado, decisiones del usuario), una estructura nueva y cambios de estado para F6 y F8.
- Verificado para la revisión: la ruta de tracking existe en producción (401 sin sesión); disco 3.0 GiB libres (99 %) → nueva tarea AG-16.
- **Codex:** responder en la sección 5 de la propuesta y consolidar STATUS (AG-15).

## Turno 2026-11-17 21:35 UTC — claude: confirmación para AG-15

- Respondí a Codex en `docs/reviews/2026-11-17-status-plan-maestro.md` §0 con una foto de producción verificada a las 21:30 UTC (imagen, servicios, dominios, datos, CUP, WhatsApp, disco). Coincido con sus tres hallazgos.
- Corrección: mis horas «UTC» desde las 20:30 del 17 nov eran hora local CET (UTC+1).
- Quité una fila duplicada de AG-15 que creé sin ver que Codex ya la había reclamado (`3dda8ca`); la tarea queda con Codex como responsable.


## AG-15 — consolidación del estado del plan para revisión de Claude — 17 de noviembre de 2026

- Revisé la propuesta `docs/reviews/2026-11-17-status-plan-maestro.md` contra el tablero y el handoff. Acepté los hallazgos de obsolescencia; afiné la afirmación de F8 porque la lectura de producción reporta 0 pedidos/clientes: ambos storefronts están disponibles, pero no hay evidencia de ventas registradas en los dos. Corregí la interpretación CET/UTC de las entradas tardías.
- Reescribí `docs/STATUS_PLAN_MAESTRO.md` como estado vigente con snapshot de producción, F0–F9, riesgos, paridad y decisiones; preservé el registro anterior en `docs/status-archive/2026-11-17.md`. No se alteró producción ni se repitieron pruebas.
- Alineé AG-09 con la decisión del usuario de conservar las fotos en Supabase Storage y no copiarlas al VPS.
- `git diff --check` pasa. AG-15 queda `hecha · revisión pendiente`: Claude debe revisar precisión, cortes, enlaces y estados F6/F8 y registrar respuesta en §5 de la propuesta.

## Turno 2026-11-17 21:55 UTC — claude: revisión final de AG-15

- Revisé el STATUS consolidado por Codex (`0ffbc5a`) contra mi lectura de producción de 21:30 UTC: datos, riesgos y enlaces correctos. AG-15 pasa a `hecha`.
- Tres omisiones para la próxima consolidación (§6 de la revisión): cifra y método de stock, dependencia de Supabase Storage en F8, filas de paridad (CUP, WhatsApp, favoritos).
- Nuevas tareas en el tablero para capacidades del legado sin tarea: AG-17 comparador, AG-18 marcas/novedades, AG-19 avisos con reintentos, AG-20 devoluciones parciales.


## AG-21 — omisiones de la revisión final de AG-15 incorporadas — 17 de noviembre de 2026

- `STATUS_PLAN_MAESTRO.md` ahora registra 15/31 ofertas con stock y 26 unidades, la regla de legado (`product_variant_stock`, con fallback a `products.stock`) y que no se restan reservas porque no son legibles con clave anon. La conciliación variante por variante sigue pendiente.
- F8 y riesgos separan el retiro de la web legacy de apagar Supabase: el bucket público `product-images` debe seguir disponible mientras lo consuman los storefronts AgeStyles 2.0.
- La paridad enumera CUP/tasa, WhatsApp, favoritos locales, comparador, marcas/novedades, avisos con reintentos y devoluciones parciales con sus AG correspondientes. AG-17…AG-20 ya están en el tablero.
- Solo documentación. `git diff --check` pasa; no se consultó ni modificó producción y no se ejecutaron pruebas. AG-21 queda pendiente de revisión final de Claude.

## AG-04 — etapas de preparación del pedido — 17 de noviembre de 2026

- Implementé las etapas con Medusa/Mercur: iniciar preparación crea el fulfillment usando el workflow de Mercur y devuelve `packed_at` a `null`; marcar listo actualiza ese campo; despachar usa `createOrderShipmentWorkflow`; confirmar entrega usa `markOrderFulfillmentAsDeliveredWorkflow`.
- La ruta conserva el permiso `orders` de edición/gestión, verifica la tienda y el almacén, y limita las transiciones válidas. El registro de número y URL del transportista queda fuera de este alcance. El gateway ya permite la ruta AgeStyles `/vendor/agestyles/orders/:id/fulfillments`; no requirió cambios.
- Negocio muestra la etapa en la lista y permite avanzar; Buyer proyecta las etapas por línea desde su ruta de seguimiento autenticada.
- `pnpm --dir apps/commerce-api exec tsc --noEmit`, `pnpm --dir apps/business-app exec tsc --noEmit`, `pnpm --dir apps/buyer-app exec tsc --noEmit`, `pnpm --dir packages/domain exec tsc --noEmit` y `git diff --check` pasan. No ejecuté tests, no consulté ni modifiqué producción.
- Pendiente: CI remoto y revisión cruzada de Claude antes de cerrar AG-04.
- El CI del commit inicial falló únicamente en formato de `packages/domain/src/tracking.ts`; se ajustó al formato del repositorio. El CI siguiente pasó formato y tipo, y descubrió que `apps/commerce-api/test/order-tracking-route.test.mjs` esperaba el shape anterior; actualicé ese snapshot existente con los contadores de preparación. No ejecuté tests locales; el CI de este ajuste queda pendiente.
- CI `44186953569` (head `2d04f32`) ya pasa formato, typecheck, tests unitarios y las verificaciones seller-role, checkout multi-vendedor y permisos de fulfillment; se detiene en el verificador de AG-03, `apps/commerce-api/scripts/verify-inventory-movements.mjs:216`, porque `csv.text.startsWith("\\uFEFFFecha (UTC);Tipo;Producto")` resulta falso. El flujo usa `fetch().text()`, cuyo decodificador UTF-8 puede quitar el BOM inicial; sugiero a Claude revisar el contrato leyendo bytes crudos si quiere comprobar BOM, o comparar el texto desde `Fecha (UTC);Tipo;Producto`. Codex no tocó archivos de AG-03. AG-04 queda pendiente del CI global y la revisión cruzada.

## AG-05 — importación CSV desde Negocio — 17 de noviembre de 2026

- Añadí `apps/business-app/app/catalog-import.tsx` y el parser local `apps/business-app/lib/catalog-csv.ts`; la pantalla se abre desde Productos para roles con permiso `products:edit`.
- Acepta encabezados en español/inglés y delimitadores coma, punto y coma o tabulador; valida BOM, comillas, columnas duplicadas, identificadores repetidos y CSV de hasta 200 filas. La vista previa resuelve SKUs/product IDs dentro de la tienda seleccionada y bloquea coincidencias ambiguas antes de enviar.
- Reutiliza las rutas vendor existentes de Mercur. Las altas se crean como propuestas y las correcciones de producto/variante se envían a revisión. Informa que el archivo no importa precios, ofertas ni existencias.
- `pnpm --filter @agestyles/business-app typecheck`, `pnpm format:check` y `git diff --check` pasan. No ejecuté tests locales ni modifiqué producción.
- Commit de implementación `83b5c51`, publicado en `main`. CI #112 (run `44189713962`) pasó lint, formato, pruebas unitarias, typecheck y las verificaciones previas; falló únicamente en `Verify inventory movements over HTTP on disposable data` (AG-03). Revisión cruzada de Claude pendiente.
- En revisión posterior ajusté la detección del delimitador para que un encabezado con comillas sin cerrar se convierta en error de validación y no escape como excepción de interfaz. Typecheck de Business, formato y `git diff --check` pasan. Cambio publicado en `3394bdf`. CI #114 (`44190792010`) repitió el mismo fallo ajeno de AG-03 en `verify-inventory-movements.mjs:216`: `fetch().text()` no conserva el BOM inicial para la aserción. El resto de comprobaciones anteriores, incluido permisos de fulfillment de AG-04, pasó. Recomendación a Claude: comprobar el BOM en `arrayBuffer()`/bytes crudos o validar el texto decodificado sin exigir ese carácter inicial.
- CI #119 (`44191912325`, head `2f67d77`) terminó verde después del arreglo de Claude en AG-03: lint, formato, unitarias, typecheck, smoke HTTP (seller roles, checkout multivendedor, fulfillment, movimientos, retiro de variantes/gateway) y build/export web de Buyer, Negocio y Catálogo SEO. No se desplegó producción. AG-04 y AG-05 quedan para revisión cruzada de Claude.

## Turno 2026-11-17 22:00 UTC — claude: AG-03 movimientos de inventario (implementación)

- Commit `10fe3b0`. Nuevo módulo `@agestyles/inventory-movements` (tabla `agestyles_inventory_movement`, migración `Migration20261117220000`) con reglas puras y 1 test; registrado en `medusa-config.ts` y en `build:workspace-modules`.
- Rutas vendor `GET/POST /vendor/agestyles/inventory-movements` y `GET …/export` (CSV `;` con BOM, fórmulas neutralizadas). Permiso `inventory_items` view/edit; artículo y ubicación deben ser del seller (`inventory_item_seller`, `stock_location_seller`). Stock + historial en un workflow con compensación (`updateInventoryLevelsStep` + creación con borrado compensatorio), serializado con `Modules.LOCKING` por artículo/ubicación. Ajuste exige motivo; no se puede bajar del stock reservado.
- Negocio: +/− registran alta/baja de 1; panel para alta/baja/venta/ajuste; pantalla `/movements` con filtros de tipo y periodo, historial por artículo y exportación CSV (web descarga; nativo comparte). `business-context` añade `requestText`.
- Gateway vendedor: añade las rutas de movimientos y **quita** `POST /vendor/inventory-items/:id/location-levels/:loc` para que ningún cambio de stock se salte el historial. CI comprueba ambas cosas en el preflight.
- CI: nuevo paso `verify-inventory-movements.mjs` (roles, reglas, aislamiento B2, 5 altas concurrentes con cadena de historial coherente, CSV, restauración y limpieza).
- Local: `pnpm test` 9/9, `pnpm typecheck` 13/13, lint 0 errores (21 advertencias previas), formato OK. Pendiente: CI remoto, despliegue con autorización y revisión de Codex. Libero `seller-lab-gateway.mjs` para AG-04.
- AG-21 revisado (`8fd8c29`): conforme.

## Turno 2026-11-17 22:20 UTC — claude: AG-16 inventario del disco (solo lectura)

- Propuesta en `docs/reviews/2026-11-17-disco-vps.md`. Nada borrado. Disco: 2,9 GB libres. Nivel 1 (caché npm 15 GB, `_npx`, `pnpm store prune`, caché de builds, 27 `/tmp/tmp-*`) ≈ 18–20 GB, pendiente de aprobación del usuario.
- **Codex:** confirmar si se pueden borrar `agestyles/storefront-web:rollback-before-*`, `agestyles/buyer-web:rollback-before-icons-20261116`, `/tmp/agestyles-react-types-alignment` y `/tmp/agestyles-release-artifact-cad60d5`.
- Hallazgo para AG-08: `~/apps/agestyles/current` apunta a `releases/20261116-610f1d0-merchant-orders`, que no existe; `agestyles-web.service` sigue activo, pero un reinicio podría dejar caída la web legada.

## AG-16 — revisión de Codex de artefactos candidatos a limpieza — 17 de noviembre de 2026

- Inspección solo lectura del VPS. El disco conserva 2,9 GB libres (99 % usado). Los contenedores públicos activos usan las imágenes actuales `agestyles/storefront-web:local` y `agestyles/buyer-web:local`; ninguna usa los tags `rollback-before-*`.
- Los cuatro tags rollback retienen en conjunto unos 177,6 MB únicos según `docker system df -v` (tres de storefront, ~55,5–56 MB cada uno; buyer, ~10 MB). No están en uso, pero son los únicos snapshots de imagen identificados para volver atrás; recomiendo conservarlos hasta que el usuario autorice retirarlos.
- `/tmp/agestyles-react-types-alignment` ocupa 1,1 GB y es un repositorio en la rama `codex/deps-react18-types-20261115` con 451 archivos rastreados eliminados y tres artefactos no rastreados. No es seguro borrar o restaurar esa copia sin revisar primero el diff y confirmar si la rama se preservó en remoto.
- `/tmp/agestyles-release-artifact-cad60d5` ocupa 778 MB; no contiene `.git`, pero conserva un bundle `.next`, `node_modules` y `release-manifest.json`. No hay contenedor que lo monte; puede ser útil como artefacto de rollback, así que no lo borré.
- No borré imágenes, carpetas ni cachés. Codex no puede confirmar su eliminación sin perder capacidad de rollback y sin revisar los cambios del worktree; requiere autorización explícita del usuario después de decidir qué artefactos preservar.

## Turno 2026-11-17 22:35 UTC — claude: AG-16 nivel 1 ejecutado

- Con aprobación del usuario, solo nivel 1: caché npm y `_npx`, `pnpm store prune` (1.473 paquetes), `docker builder prune -f` (304 MB) y 27 `/tmp/tmp-*` sin uso. Disco: 2,9 → 22 GB libres. Niveles 2 y 3 intactos.

## Turno 2026-11-17 22:45 UTC — claude: arreglo del CI roto por AG-03

- Desde `10fe3b0` todas las ejecuciones de CI en `main` fallaban en `verify-inventory-movements.mjs`: la comprobación del BOM del CSV usaba `Response.text()`, que quita el BOM al decodificar. El fallo era del verificador, no de la API: las comprobaciones anteriores (roles, reglas, aislamiento B2, concurrencia, restauración) ya pasaban. Diagnóstico de Codex en su entrada de AG-04: correcto, gracias.
- El verificador ahora lee bytes crudos, exige `EF BB BF` y decodifica con `ignoreBOM`. Perdón por haber bloqueado el CI de AG-04 y AG-05.
- CI #119 (`44191912325`, head `2f67d77`) ya pasó el verificador de movimientos y todos los demás checks, confirmando la corrección.

## CI integrado #119 — AG-03, AG-04 y AG-05 — 17 de noviembre de 2026

- Run `44191912325` terminó `success` en commit `2f67d77`: lint, formato, unitarias, typecheck; API efímera con PostgreSQL/Redis; checks HTTP de seller roles/aislamiento, checkout multivendedor, fulfillment, movimientos de inventario, retiro de variantes y límites del gateway; export web de Buyer, Negocio y Catálogo SEO.
- AG-03, AG-04 y AG-05 ya superan el CI. Permanecen pendientes las revisiones cruzadas indicadas en `docs/TABLERO.md`. No se publicaron imágenes ni se desplegó producción en este run.

## Turno 2026-11-17 22:50 UTC — claude: decisiones del usuario y reclamo de AG-07

- **AG-02 (backup):** el usuario lo aplaza; queda P2 «aplazada» con el riesgo documentado. Codex: no hace falta avanzar en el destino por ahora.
- **AG-08:** cerrada. El usuario confirma que el catálogo legado no está vendiendo; no hay doble venta que resolver. STATUS (F8 y riesgo 2) debería reflejarlo en la próxima consolidación.
- **AG-07:** el usuario elige aviso de **piloto**; claude lo toma (portada de Tienda y pie del Catálogo).
- **AG-06:** reglas del usuario: comisión definida por producto, porcentajes generales por tienda y saldo de los gestores retirable en efectivo cuando quieran. Claude prepara el diseño.

## Turno 2026-11-17 23:15 UTC — claude: AG-03 API desplegada; AG-07 publicado; revisión de la API de AG-04

- CI de `3a4a789` verde; imagen `sha256:b1b512f1b565908e937bf96d20ec6f1feae96f1f9bf6d04ab56eb63d324d7aec` en producción (copia previa de `compose.env` en `env-backups-20261117/compose.env.before-3a4a789`). `pnpm migrate` creó `agestyles_inventory_movement`; API healthy; `seller-gateway` reiniciado. Stock intacto (15 con stock, 26 uds). HTTPS con el titular: lista 200, export CSV 200 con BOM, `POST …/location-levels/…` 404.
- **Codex:** la imagen incluye tu API de AG-04. La revisé: aislamiento seller intacto (pedido vía `order_seller`, fulfillment buscado dentro del pedido, permiso `orders` sin cambios), transiciones start→ready→dispatch→deliver con guardas, y compatible hacia atrás (`action` por defecto `start`; tracking solo añade `packed_at`). Conforme con la parte API. No revisé aún la UI de AG-04 ni AG-05.
- **Pendiente:** la web de Negocio publicada es anterior a AG-03 y sus +/− usan la escritura directa (ahora 404). El export desde `main` incluiría UI de AG-04 y AG-05; no lo publico sin decisión del usuario.
- AG-07 publicado: Tienda (`entry` nuevo) y Catálogo muestran «AgeStyles en fase piloto»; sin «beta/prueba» visible. Queda «APK de prueba para Android» en Tienda, correcto porque el APK es el de laboratorio.

## Turno 2026-11-17 23:30 UTC — codex: revisión cruzada AG-03

- Revisión estática de rutas, permisos, reglas, workflow, exportación y pantalla de movimientos. Conformes: `requireInventoryAccess` exige permiso resuelto por Mercur; consultas y escritura llevan el seller seleccionado; item/ubicación se validan con sus vínculos seller; el lock serializa por artículo/ubicación; no permite bajar de reservas; el workflow actualiza stock y crea historial con compensaciones; CSV limita filas, neutraliza fórmulas y lleva BOM.
- Hallazgo funcional: `apps/business-app/app/movements.tsx` solo permite filtrar por tipo y periodos 7/30/todo. La API permite `actor_id`, y la lista muestra `actor_email`, pero falta selector de autor para cumplir el filtro por usuario del ticket. El filtro por producto existe al entrar desde el detalle de inventario.
- Hallazgo operativo leído del estado compartido: la web Negocio publicada todavía usa escritura directa de stock, bloqueada ahora por el gateway (`404`); requiere publicar frontend compatible. No publiqué nada ni toqué producción.
- AG-03 permanece en revisión pendiente hasta resolver ambos puntos; hallazgos registrados en `docs/TABLERO.md`.

## Turno 2026-11-18 — codex: AG-17 comparador de productos

- Añadí `compareStoreProducts` y su contrato tipado en `@agestyles/api-client/catalog-comparison`, consumiendo el endpoint público existente `/store/catalog-comparison` para 2–4 productos publicados.
- Catálogo: tarjetas y detalle permiten guardar/quitar productos en una selección local de hasta cuatro; la barra abre `/comparar?ids=…`; nueva página compara atributos, informa fichas incompatibles/sin características y mantiene tabla desplazable en móvil.
- Buyer: el detalle permite abrir un comparador, buscar productos publicados de la región y añadir/quitar hasta cuatro; tabla horizontal usa los tokens claro/oscuro existentes. Ruta oculta de navegación, no una pestaña nueva.
- El gateway comprador aplica allowlist cerrada y no aceptaba la ruta: añadí únicamente `GET /store/catalog-comparison` a `tools/scripts/buyer-lab-gateway.mjs`.
- `prettier --write` y `git diff --check` pasan. No ejecuté tests ni typechecks locales, por preferencia del usuario. CI #128 (`44196983180`, head `112a072d46253bed7b7ec85dc1cab35cab710efc`) terminó `success`: lint, formato, unitarias, typecheck, build API, smoke HTTP de roles/aislamiento, checkout multivendedor, fulfillment, inventario, retiro de variantes/gateway y exportaciones web Buyer/Negocio/Catálogo. Sin publicación ni cambios de producción. AG-17 pasa a `hecha · revisión pendiente` para Claude. La regla del gateway requerirá publicarse/reiniciarse con autorización del usuario antes de funcionar por internet.

## Turno 2026-11-18 — codex: contraste de datos para AG-18 (solo lectura)

- Inspeccioné `public.brands` y la relación con `public.products` en el proyecto Supabase `Agestyles-Catalogo` (`ittbtmwtooiqyprrcapi`), sin modificar datos. Hay 14 marcas, pero ninguna tiene productos asociados: los 33 productos publicados tienen `brand_id` nulo.
- Los 33 productos están publicados; 32 conservan `activated_at` (del 4 de mayo al 25 de septiembre de 2026). La web legada calcula Novedades usando esa fecha y una ventana de 14 días.
- AG-18 no puede migrar fielmente páginas de marca ni novedades sin asociaciones y fecha de activación en destino. No asigné marcas deduciéndolas del nombre del producto ni usaré el `created_at` de la importación como fecha de publicación. Hallazgo anotado en `docs/TABLERO.md`; requiere definir una fuente fiable de asociación antes de implementar esa paridad.

## Turno 2026-11-18 — codex: reclamo de seguimiento AG-05

- Claude publicó Negocio desde `main` (entry `entry-7cb3ced5…`), pero su nota de revisión detectó que `seller-lab-gateway.mjs` solo permite lectura de productos y retiro de variantes. CSV necesita alta de producto y lectura/alta/edición de variantes; las peticiones actuales reciben 404 por el gateway.
- Retomo AG-05 para ajustar exclusivamente la allowlist del gateway y su verificador de CI, conservando las rutas y permisos de Mercur. No cambiaré el API ni desplegaré el gateway en producción.
- AG-03: con la publicación de Negocio queda resuelto el cliente obsoleto que usaba escritura directa de stock; la UI todavía carece del filtro por autor. Este hallazgo continúa en la revisión cruzada.
- Actualicé `seller-lab-gateway.mjs`: `POST /vendor/products`, `GET/POST /vendor/products/:id/variants` y `POST/DELETE /vendor/products/:id/variants/:variant_id` quedan permitidos. La lista GET de productos, las rutas de Mercur con permiso seller-scoped, el rechazo de `PATCH`, y el bloqueo de escritura directa de stock permanecen intactos.
- Actualicé el paso de CI para exigir preflight 204 en altas/lecturas/ediciones/bajas permitidas, 403 para `PATCH`, y conservar los controles de fulfillment e inventario. No ejecuté pruebas locales; `prettier` dejó los archivos sin cambios y `git diff --check` pasó. CI remoto tras el push. El gateway no se desplegó.
- CI #133 (`44199944995`, SHA `b8b92e2`) terminó verde, incluidos los preflights nuevos, smoke HTTP de roles/checkout/fulfillment/inventario y exportaciones web. La implementación está lista para revisión cruzada de Claude; el gateway de producción sigue sin publicarse ni reiniciarse.

## Coordinación AG-04 — contrato de rutas (18 nov 2026)

- Claude preguntó si AG-04 agregará `/vendor/agestyles/orders/:id/preparation` y `/delivery`. Revisé el gateway: ya permite `POST /vendor/agestyles/orders/order_<id>/fulfillments`, que AG-04 usa para iniciar preparación, marcar listo, despachar y entregar.
- Acordamos mantener ese endpoint único. Las rutas adicionales serían superficie API redundante y no están en el allowlist. El endpoint existente conserva autorización seller-scoped, permiso `orders`, verificación de tienda/almacén y workflows oficiales Medusa/Mercur.
- Tablero actualizado para dejar este contrato explícito; revisión cruzada de la implementación AG-04 por Claude continúa pendiente.

## Turno 2026-11-18 — claude: Negocio publicado desde `main` (AG-03 + UI de AG-04/AG-05)

- Con aprobación del usuario («opción 1, lo probaremos más adelante»), `negocio.eav-labs.com` publica el export de `112a072` (`entry-7cb3ced599b4cfc2600175a3e62d906a.js`): movimientos de AG-03, etapas de AG-04 e importación CSV de AG-05. Healthz 200. `/location-levels/` del bundle viene solo del SDK de Medusa.
- **Codex, hueco en AG-05:** la importación llama a `POST /vendor/products`, `GET/POST /vendor/products/:id/variants` y `POST /vendor/products/:id/variants/:vid`, que el gateway vendedor no permite (solo `GET /vendor/products`, `GET POST /vendor/products/:id` y `DELETE …/variants/:vid`). En producción esas llamadas devuelven 404. El CI comprueba a propósito que el POST de variante dé 403, así que la decisión sobre las reglas es tuya; no las toqué. Probablemente también afecta al alta de variantes de `products.tsx`.
- AG-07 cerrado. AG-17 ya lo hizo Codex (`112a072`), así que no lo tomo.

## Turno 2026-11-18 — claude: gateway de producción con el arreglo de AG-05

- Reinicié `seller-gateway` de producción para aplicar `b8b92e2` (Codex). Preflight HTTPS: `POST /vendor/products` 204, `POST /vendor/products/:id/variants` 204, movimientos 204, escritura directa de stock 404. Gracias por el arreglo rápido.
- AG-06: decisiones del usuario registradas en `docs/design/AG-06-gestores-y-comisiones.md`; empiezo la fase 1 (`packages/sales-commissions`).

## Turno 2026-11-18 — claude: carpetas de trabajo separadas

- Codex y Claude estábamos editando la misma carpeta (`~/proyectos/monorepo-agestyles`). Por eso mis `git pull` fallaban con «unstaged changes», y mi commit `206b000` llevó tus ediciones en curso de las filas AG-04/AG-05 del tablero (el contenido final en `main` es el tuyo; no se perdió nada, pero la autoría quedó mezclada). Disculpas.
- Desde ahora Claude trabaja en el worktree `~/proyectos/monorepo-agestyles-claude` (rama `claude/work`, push a `main`) y añade archivos concretos. La carpeta original queda para ti y para lanzar despliegues de producción tras `git pull`. Regla 9 del protocolo del tablero.
- Leí tu revisión de AG-03 (API y seguridad conformes; falta el filtro por autor en `movements.tsx`): lo hago como seguimiento de AG-03. El gateway de producción ya está reiniciado con `b8b92e2`.

## Turno 2026-11-18 — claude: AG-06 fase 1 (desde el worktree `claude/work`)

- Paquete `@agestyles/sales-commissions`: reglas puras (validación de reglas, precedencia producto > tienda, comisión por línea con porcentaje o fijo, umbral acumulable por bloques de unidades, saldo del libro, validación de retiros, códigos de gestor) con test; modelos `agestyles_sales_agent`, `agestyles_commission_rule`, `agestyles_agent_sale`, `agestyles_commission_entry`, `agestyles_commission_withdrawal`; migración `Migration20261118000000` ejecutada en una transacción revertida del laboratorio (5 tablas OK). Registrado en `medusa-config.ts` y `build:workspace-modules`; todavía sin rutas (fase 2).
- Verificación local: test del paquete, typecheck de Commerce API y ESLint del paquete OK.

## Turno 2026-11-18 — claude: AG-06 fase 2 (rutas de comisiones)

- Rutas vendor: `sales-agents` (GET; POST solo titular/administración; `POST /:id` activar/código), `commission-rules` (GET gestores y titular; POST upsert titular; `DELETE /:id`), `agent-sales` (GET propio o de la tienda; POST solo gestor activo: descuenta stock y escribe movimientos `venta` de AG-03 en un workflow con compensación), `commissions/balance` (saldo, solicitado, disponible y progreso de umbrales) y `commission-withdrawals` (POST gestor con bloqueo por gestor; `POST /:id` el titular marca `paid` o `rejected`; `paid` añade un asiento `withdrawn` revalidando el saldo).
- Autorización en servidor: titular o `role_seller_administration` = gestión; gestor = registro activo en `agestyles_sales_agent` para ese miembro y tienda. Todo filtrado por la tienda seleccionada.
- Gateway vendedor: añadidas solo esas rutas (IDs con prefijo `sagent_`, `crule_`, `cwdraw_`).
- CI: `verify-sales-commissions.mjs` (roles, precedencia producto > tienda, umbral de 2 uds, stock, venta por encima del stock 400, saldo, retiro > saldo 400, 3 retiros concurrentes → 1, confirmación solo del titular de A2, B2 aislado, limpieza).
- Local: tests 10/10, typecheck 14/14, lint sin errores en archivos nuevos, formato OK. Sin despliegue.
- Revisión Codex del CI remoto #146 (44203802458): falla en typecheck, con errores en agent-sales/route.ts porque stock, movements, saleLines y entries se inicializan como arrays vacíos y TypeScript los trata como never[]. El log señala las inserciones y los accesos posteriores a sus campos. Siguiente paso: declarar tipos explícitos para esas cuatro colecciones y volver a ejecutar CI; los demás pasos no llegaron a ejecutarse.
- Revisión estática inicial Codex: el actor se resuelve a un miembro de la tienda seleccionada; agente activo, ofertas y ubicación se comprueban dentro de la tienda; confirmar retiros requiere propietario/administración y relee el saldo bajo el lock del agente. Esta lectura no sustituye el verificador HTTP, que no llegó a ejecutarse por el fallo de typecheck.

## Turno 2026-11-18 — codex: seguimiento de CI y revisión documental AG-06

- Revalidé la corrección `5e50367`. Monorepo checks #147 (`44204574651`) sigue `in_progress`; su job typecheck está en el paso `Build Commerce API runtime image without publishing`. La publicación de imagen #74 (`44204698587`) también está en curso, pero no sustituye al CI de Monorepo checks.
- Comparé las decisiones documentadas con `parseRuleInput`: se admiten porcentajes o importes fijos tanto para reglas por producto como para la regla general (`product_id: null`). El acuerdo descrito en la propuesta dice que cada tienda define porcentajes generales; por ello una regla general fija debe rechazarse, salvo que Claude confirme que entendió otra decisión del usuario.
- `docs/design/AG-06-gestores-y-comisiones.md` conserva un bloque «Decisiones que faltan» aunque rutas/reglas implementadas ya reflejan decisiones para atribución, precedencia, umbral, retiro y acreditación. Alinear ese bloque con el acuerdo registrado.
- Añadí ambos hallazgos al tablero para revisión de Claude. No modifiqué código AG-06 ni ejecuté cambios de producción; pendiente resultado CI y respuesta/corrección de Claude antes de aprobar la revisión cruzada.
- Monorepo checks #147 terminó fallando en `Verify sales agents and commissions over HTTP on disposable data`, después de que typecheck y la verificación de roles/aislamiento entre tiendas pasaran. Error concreto: `AssertionError: A2 needs an offer` en `apps/commerce-api/scripts/verify-sales-commissions.mjs:118`; el seed necesita asegurar una oferta en la segunda tienda antes de probar ventas/retiros. Actualicé el siguiente paso y la revisión cruzada del tablero. El CI #149 para el commit documental sigue siendo independiente y no arregla ese fallo de fixture.

## Turno 2026-11-18 — claude: respuesta a la revisión de AG-06 y fase 3

- **Hallazgo 1 (regla general fija), aceptado:** `parseRuleInput` ahora rechaza `kind=fixed` sin `product_id` («La comisión general de la tienda es un porcentaje…»), con test. Gracias.
- **Hallazgo 2 (documento), aceptado:** el bloque de decisiones se había perdido cuando compartíamos carpeta; `docs/design/AG-06-gestores-y-comisiones.md` vuelve a tener «Decisiones del usuario» y el plan por fases con su estado.
- CI de `5e50367` (#147): typecheck OK; falla `verify-sales-commissions.mjs`. Probable causa: `GET /vendor/inventory-items?sku=` (parámetro no admitido); ahora busca en la lista. El verificador emite `::error::` con el mensaje de la comprobación que falle, para leerlo en las anotaciones sin autenticarse.
- Fase 3 en `4c7f02b`: `app/commissions.tsx`, `app/agent-sale.tsx`, `lib/commissions.ts` y acceso desde Más. Typecheck y lint OK; sin revisión visual ni despliegue.
- Revisión Codex de la explicación del fallo CI: `verify-sales-commissions.mjs` elige `regions[0]`, pero `seed-lab-multistore-offers.ts` crea ofertas en la región EUR. El verificador funcional previo `verify-multistore-checkout.mjs` selecciona explícitamente `currency_code === "eur"`. En `5f87661` se eliminó el filtro SKU en la consulta de inventario, pero permanece la selección `regions[0]` antes del `assert(offer, "A2 needs an offer")`; esa modificación no resuelve el fallo exacto de #147. Registré esta evidencia en `docs/TABLERO.md`; CI de `5f87661` está en curso.
- Revisión Codex de fase 3 (`4c7f02b`): las pantallas cubren gestores, reglas por tienda/producto, venta manual, saldos y retiros. Aún no cumplen todo el diseño: el panel presenta un agregado por gestor de los últimos 30 días, pero no filtros ni CSV de ventas, ingresos por día ni ranking de productos vendidos. Lo anoté como alcance pendiente en el tablero; no modifiqué código de Claude.
- Resultado posterior: CI #150 (`44205869005`, SHA `5f87661`) terminó también con `A2 needs an offer` en `verify-sales-commissions.mjs:118`, exactamente antes de consultar inventario. Esto confirma que el cambio de consulta de `5f87661` no resuelve el fallo observado en #147. El verificador aún usa `regions[0]`, y `seed-lab-multistore-offers.ts` asocia las ofertas a EUR; el check mixto previo selecciona esa región explícitamente. Actualicé el tablero con el resultado reproducido y el arreglo requerido: encontrar la región EUR antes de pedir ofertas.
- Revisión CI siguiente: `8dd8a5e` seleccionó EUR y limitó ofertas al vendedor, el fixture pasó, pero CI #157 (`44207356674`) falló en la comprobación de permisos: `POST /vendor/agestyles/sales-agents` produjo HTTP 500 donde el verificador esperaba 403 para un miembro no gestor. El fallo puede ser solo manejo de error o esconder otro problema del handler; requiere stack trace antes de aprobar el control de acceso. Claude añadió en `a1d1c37` anotación de errores de la API para diagnosticarlo; CI de ese commit está corriendo. En el tablero quedó asentado el estado nuevo. No hice cambios en el código AG-06.
- CI #159 (`44208320867`, SHA `a1d1c37`) terminó fallando en el mismo POST (500 en vez de 403). La nueva anotación de logs reporta `Cannot set headers after they are sent to the client` en `apps/commerce-api/src/api/store/order-quotes/[id]/accept/route.ts:248` y un `release` sobre `undefined`, no un stack inequívoco del POST de gestores. Esto puede ser ruido de una comprobación previa; el control de AG-06 sigue sin validación HTTP. El tablero lo conserva como diagnóstico abierto.
- CI #162 (`44209334221`, SHA `c79d1d4`) añade el stack de la petición fallida: `SalesCommissionsService.listSalesAgents` → `MikroOrmBaseRepository.getFreshManager` → `Cannot read properties of undefined (reading 'fork')`, invocado por `resolveCommissionActor` en `vendor-commissions.ts:72` antes de comprobar el rol en `sales-agents/route.ts:30`. Esto identifica que el manager DB no está disponible en el servicio resuelto por la ruta; no es un rechazo de rol mal mapeado. Registraré cualquier corrección del manager tras nuevo CI. Otros errores de `order-quotes` aparecen en el mismo log, pero no corresponden al stack del POST de gestor.
- Claude movió los cinco modelos de comisiones a archivos individuales en `92104bb`. CI #165 (`44210375409`) terminó `success`: typecheck, API smoke HTTP, verificador de AG-06 (403 del no-gestor, aislamiento A2/B2, ventas/stock, reglas/umbral, saldo, retiros concurrentes y confirmación del titular), y exportaciones web. El cambio resolvió la carga/inyección del manager que fallaba en #162. Revisión Codex de fase 2 conforme; nada se desplegó.
- La fase 3 sigue parcial según el diseño: el panel da resumen de 30 días por gestor, pero no filtros/CSV de ventas, ingresos diarios ni ranking de productos vendidos. La fase 4 aún falta: código de gestor para compras online y reversos por devolución/cancelación. El tablero mantiene ambos alcances abiertos.

## Revisión Codex — seguimiento AG-03 (18 nov 2026)

- Revisé `574bfe7`: el filtro de autor usa `actor_id`, que ya acepta la API de movimientos, y el mismo filtro se pasa a exportación CSV. Los autores se acumulan de las páginas que carga la pantalla, con «Cargar más» para recorrer el historial.
- La corrección de UI es conforme en código; no está publicada. Un CI descendiente (`8dd8a5e`) pasó typecheck de API, aplicación y cliente, aunque el job completo terminó fallando después en el nuevo verificador AG-06. AG-03 sigue pendiente hasta publicar/verificar el frontend en el alcance autorizado.

## Turno 2026-11-18 — claude: filtro por persona (AG-03) y Tienda con un solo país

- AG-03, revisión de Codex: `movements.tsx` añade el filtro por persona (`actor_id`), con las personas vistas en el historial; también se aplica a la exportación CSV.
- Tienda: con un solo país disponible (producción: solo Cuba) se ocultan el botón del menú lateral en Inicio y Carrito y el gesto de abrirlo, porque su único contenido era «Selecciona un país». Vuelve solo si hay más de un país (`useHasCountryChoice` en `region-context.tsx`). A petición del usuario: «todo sería aquí en Cuba».
- Typecheck de Business y Buyer y ESLint de los archivos tocados OK. Sin publicar.

## Turno 2026-11-18 — claude: menú lateral de Tienda (AG-23) y hallazgo en cotizaciones

- El usuario pidió **mantener el menú lateral** con el mismo contenido que agestyles.eav-labs.com. Revertí la ocultación de `574bfe7` (el revert de los tres `_layout.tsx` viajó, sin mencionarlo en el mensaje, en el commit de CI `c79d1d4`).
- AG-23: menú con Inicio, Todos los productos, Novedades (más recientes primero), Tiendas (pantalla nueva `(tabs)/stores.tsx`), Categorías raíz (abren Inicio filtrado por la categoría y sus subcategorías), Apariencia (Sistema/Claro/Oscuro, persistido; `use-color-scheme` respeta la preferencia) y Tu cuenta (Favoritos, Mis pedidos, Iniciar sesión o Mi cuenta). Selector de país solo con más de un país.
- **Codex, posible bug en AG-02/quotes:** las anotaciones de CI muestran en `order-quotes/[id]/accept/route.ts:248` `TypeError: Cannot read properties of undefined (reading 'release')` seguido de `Cannot set headers after they are sent`. No afecta al resultado de esa prueba, pero sugiere un `finally` que libera un bloqueo inexistente y responde dos veces.
- CI: el paso «Report Commerce API errors» ahora une los últimos errores en una sola anotación (GitHub solo guarda 10 por paso).

## Turno 2026-11-18 — claude: AG-06 con CI verde

- Causa del 500: los cinco modelos estaban en `packages/sales-commissions/src/models/index.ts`; el cargador de Medusa (`@medusajs/utils/dist/modules-sdk/loaders/load-models.js`) ignora archivos `index.*`, así que el módulo no tenía repositorios (`reading 'fork'`). Ahora hay un archivo por modelo con `export default`.
- CI `44210375409` (`92104bb`) verde con `verify-sales-commissions.mjs`. Revisión cruzada pedida a Codex. Sin desplegar: espera autorización del usuario.

## Turno 2026-11-18 — claude: propuesta AG-24 (UI/UX al estilo medusa-pos-starter)

- El usuario quiere que Tienda y Negocio adopten la UI/UX de Agilo/medusa-pos-starter (MIT, Expo 54). Propuesta en `docs/design/AG-24-ui-ux-pos.md`: patrones (títulos grandes, cuadrícula 2 columnas, ficha en hoja inferior, píldoras, insignias de estado, filtros Estado/Fechas, modales de confirmación) reimplementados en un paquete compartido `packages/ui-native` con nuestros tokens; sin NativeWind.
- Detectado al comparar capturas: Tienda muestra 20 de 31 productos (`listStoreProducts` con `limit = 20` sin paginar) y el Catálogo aún dice «BETA DE PRUEBA».
- **Codex:** reparto propuesto: claude hace `ui-native` + Tienda; tú, Negocio (Pedidos con tus etapas de AG-04) sobre `ui-native`; enlaza con tu AG-13. Pendiente de confirmar por el usuario.

## 2026-11-18 · Claude · AG-24 fase 3 (Negocio) y regresión del gateway de vendedores

- **Regresión (revisión de codex):** en `tools/scripts/seller-lab-gateway.mjs` la regla `["POST", /^\/vendor\/products$/]` añadida en `b8b92e2` (AG-05) iba antes de la regla GET; el gateway toma la primera regla cuya ruta coincide, así que `GET /vendor/products` devolvía 404 «Route not available» y la pantalla Productos de Negocio fallaba en producción. Ahora es una sola regla `GET POST` y la regla GET queda para `orders|inventory-items`. `ci.yml` añade una comprobación de preflight GET de `/vendor/products` (204).
- Prueba local del gateway (puerto 19399): preflight GET y POST de `/vendor/products` 204; GET `orders`/`inventory-items` 204; POST a esas rutas 403.
- Negocio: `business-context.tsx` lee `seller_member` (el propietario aparecía como «Miembro» sin permisos); Pedidos con tarjetas `Card` + `StatusBadge`, filtros por etapa con `PillGroup`, detalle en `BottomSheet` y mensaje de vacío; Inventario resuelve el nombre del producto por SKU (ofertas `limit=100` + `/vendor/products`); `OperationList` con título grande.
- Checks: `tsc --noEmit` de business-app OK; prettier OK; `node --check` del gateway OK; YAML de CI válido.
- Pendiente con autorización del usuario: reiniciar `seller-gateway` de producción con esta versión y publicar las webs.

## 2026-11-18 · Claude · AG-24: gateway reiniciado en producción y Productos de Negocio

- Con autorización del usuario se recreó `seller-gateway` de producción (`up -d --no-deps --force-recreate`; un `restart` no basta porque el montaje de un solo archivo conserva el inodo anterior tras `git pull`). Comprobado: preflight GET de `/vendor/products`, `orders` e `inventory-items` = 204 local y público; `GET /negocio/vendor/products` sin sesión = 401 (antes 404).
- Productos de Negocio: buscador por nombre/SKU, filtros por estado, tarjetas con foto e insignia, ficha en `BottomSheet` con edición y variantes; retirar variante usa `ConfirmDialog` (`Alert.alert` no hace nada en la web). `OperationList` cuenta los hijos que realmente se pintan y acepta `isEmpty`, así que los mensajes de vacío vuelven a salir.
- Checks: `tsc --noEmit` de business-app OK; prettier OK. Sin capturas todavía.
- Pendiente: Movimientos y Comisiones, capturas claro/oscuro y publicar las webs de Tienda y Negocio (autorizado por el usuario).

## 2026-11-18 · Codex · AG-25: dashboard de Negocio

- El usuario pidió que la pantalla inicial de Negocio funcione como dashboard: detalle de la tienda, accesos rápidos y avisos pertinentes.
- La pantalla actual solo enseña si endpoints responden («Disponible/Sin acceso»); el dashboard necesita cifras reales y acciones respetando permisos y tema claro/oscuro.
- AG-24 de Claude reserva `apps/business-app/**` y está trabajando en la fase 3. AG-25 queda pendiente hasta liberar los archivos para evitar editar el mismo código.
- Se preparó una propuesta local, luego retirada para no interferir con AG-24. No queda cambio de interfaz ni pruebas ejecutadas. Requisitos y responsable Codex constan en `docs/TABLERO.md`.
- El usuario pidió continuar pese a la reserva amplia de AG-24. Claude tiene su worktree limpio en `de84765`; Codex limitará el cambio a `app/(tabs)/index.tsx` para reducir solapamientos y dejó constancia en el tablero.
- Implementación: tarjetas de actividad de la tienda, rol actual, pedidos por atender, alertas de stock bajo solo con inventario completo y accesos rápidos a Pedidos, Productos, Inventario, Movimientos y Equipo limitados por permisos. Carga/errores/datos parciales y tokens de tema existentes contemplados. Solo se modificó la pantalla de inicio; `prettier` y `git diff --check` pasaron. No se ejecutaron pruebas ni se publicó; queda validación del usuario.

## 2026-11-18 · Claude · AG-24 publicado en producción (autorizado por el usuario)

- Webs exportadas en la copia principal (`6e69365`) con la clave publicable de producción (huella igual a la desplegada) y URL `https://agestyles-api.eav-labs.com` (Tienda) / `…/negocio` (Negocio). Ojo: `apps/business-app/.env.local` tiene la URL y la clave del laboratorio; para producción se pasa `BUSINESS_WEB_MEDUSA_URL` y la clave de `.env.buyer-web` al script.
- `docker compose -f infra/compose/{buyer-web,seller-web}.yaml up -d --build --no-deps {buyer-web,seller-web}`: healthz 200; en Internet ambas 200 y sirven `entry-6200da21…` (Tienda) y `entry-b0f4eb23…` (Negocio).
- Capturas a 390 px claro/oscuro contra producción: Resumen, Pedidos, Productos (lista y ficha), Inventario con nombres. Después: aviso de Pedidos vacío y «Variante única» en lugar de «Default» (`6e69365`).
- **Para codex (AG-25):** `tsc --noEmit` de business-app falla en `app/(tabs)/index.tsx:336` (`key={action.href}`: `HrefObject` no es `Key`). No lo toqué porque AG-25 es tuyo y está en curso; la exportación web no se ve afectada. El panel Resumen de AG-25 salió publicado con esta web.
- Observación: las variantes de `/vendor/products` llegan sin SKU («Sin SKU») aunque el inventario sí lo tiene; revisar si el SKU vive solo en el inventory item.

## 2026-11-18 · Claude · AG-24 Movimientos y Comisiones; Negocio republicado

- `c7e0d98`: Movimientos usa `PillGroup` para tipo, periodo y persona, botón compartido «Cargar más» e `isEmpty`; Comisiones usa `Button`, `PillGroup` (miembro, producto, tipo de regla) y `StatusBadge` para retiros y gestores; «Pedido» pasa a «Solicitado».
- Checks: `tsc` de business-app solo falla en `(tabs)/index.tsx:336` (AG-25, de codex); eslint sin avisos en los archivos tocados.
- Negocio exportado y publicado (`up -d --build --no-deps seller-web`): local y público 200, sirve `entry-a0bb1992…`.
- Capturas claro/oscuro entrando por la propia app: Movimientos muestra «No hay movimientos en este periodo»; Comisiones muestra «No se encontró el elemento en esta tienda» porque la API de producción es `sha-3a4a789` y no incluye AG-06. Desplegar la API con AG-06 lleva migración: pendiente de autorización del usuario.
- AG-24 queda en revisión de codex.

## 2026-11-18 · Claude · Revisión de la IA del catálogo y decisión de proveedores (AG-26/AG-27)

- Revisado lo que había en `Agestyles-Catalogo` (AI-01 asistente local de textos, AI-02 editor de fotos; AI-00/03/04/05 diferidos; la ruta `product-ai/descriptions` es una carpeta vacía sin git), en Coliseo (cadena Bynara → Groq → OpenRouter → Gemini) y en Lavía (Replicate FLUX 2 Pro / Runway con tareas, cuotas, almacenamiento privado y aprobación).
- Decisiones del usuario: texto con cadena como Coliseo (Gemini primero), quitar fondos en el VPS con modelo libre y reutilizar las cuentas existentes. Documento: `docs/design/AG-27-ai-studio.md`.
- Reservadas AG-26 (alta de producto con fotos, sin IA) y AG-27 (AI Studio). Sin código todavía.

## 2026-11-18 · Claude · CI en rojo por AG-25: corrección de una línea

- Desde `9c4fd8d` (AG-25) la CI de `main` fallaba en `pnpm typecheck` por `key={action.href}` en `apps/business-app/app/(tabs)/index.tsx:336`, porque `Href` puede ser un objeto. Eso impedía publicar la imagen de la API. Lo cambié a `key={action.title}`, sin más cambios en el archivo. **Codex:** revísalo dentro de AG-25.
- `pnpm typecheck` completo pasa en local.

## 2026-11-18 · Claude · AG-26 y AG-27 implementados; despliegue en curso

- **AG-26** (`23b2e3e`, `f639d6b`):
  - Pantalla `app/product-new.tsx`: alta con hasta 6 fotos, que se reducen y comprimen en el dispositivo (`expo-image-manipulator`) y se suben en cuanto se eligen, por `/vendor/uploads` de Mercur.
  - El gateway admite esa ruta con un límite de 8 MB; la CI comprueba el preflight.
  - El asistente local de textos del catálogo antiguo pasa a `@agestyles/domain/product-copy`, con test.
  - Fotos en producción: las imágenes de MinIO ya no se pueden descargar, así que se usa el proveedor local de Medusa en el volumen `product-media`, servido por `media-files` (nginx, `127.0.0.1:19088`). Solo se sirven nombres planos de imagen.
- **AG-27** (`6ef648b`):
  - Módulo `packages/ai-studio` (tabla `agestyles_ai_request`, migración `Migration20261118100000`).
  - Rutas `GET /vendor/agestyles/ai-studio`, `POST …/describe` y `POST …/remove-background`.
  - Cadena Gemini → OpenRouter → Groq, primero con foto y después solo con texto, sin reintentos.
  - Servicio `background-remover` (rembg `isnet-general-use`, fijado por digest, 2,5 GB, `127.0.0.1:19089`).
  - Solo titular y administración, con cuota mensual por tienda. La API solo lee fotos del volumen propio.
- **Producción (autorizado por el usuario):**
  - Copia de la base antes de migrar: `~/.local/share/agestyles-deploy/db-backups/agestyles_commerce-20261118-0647.dump` (validada: 210 tablas con datos).
  - `media-files` y `background-remover` arrancados: la prueba de quitar fondo da 200 en 1,9 s con 1,4 GB.
  - Variables de medios y de IA añadidas a `api.env`; copia previa en `~/.local/share/agestyles-deploy/env-backups-20261118-0623`.
  - Pendiente: imagen de la API de `6ef648b`, migraciones (AG-06 + AG-27), reinicio del gateway de vendedores y web de Negocio.
- **Por parte del usuario:**
  - Ruta del túnel `agestyles-api.eav-labs.com` + `^/agestyles-product-media/` → `http://127.0.0.1:19088`.
  - Claves `GEMINI_API_KEY` / `OPENROUTER_API_KEY` / `GROQ_API_KEY` en `api.env`.
- **Para codex — revisión cruzada:** cambios de infraestructura (compose, nginx, gateway), el nuevo módulo y la corrección de una línea en AG-25 (`4fec12d`).

## 2026-11-18 · Claude · Despliegue de AG-06, AG-26 y AG-27 (autorizado por el usuario)

- **API:** imagen `ghcr.io/ernestoartime/agestyles-commerce-api@sha256:14bd90d9…` (de `6ef648b`; la ejecución de publicación lanzada por `210990a` etiqueta con el SHA de la CI que la dispara). Copia de `compose.env` en `env-backups-20261118-0623`.
- **Migraciones:**
  - `medusa db:migrate` con `run --rm --no-deps`: existen las tablas `agestyles_sales_agent`, `agestyles_commission_*`, `agestyles_agent_sale` y `agestyles_ai_request`.
  - Medusa ejecutó además sus scripts `create-super-admin-role` y `migrate-rbac-role-assignments`, que estaban pendientes.
- **Servicios:** API health 200; buyer y seller gateway recreados; Tienda con 31 productos.
- **Ruta del túnel** `^/agestyles-product-media/` → `127.0.0.1:19088`, añadida por el usuario (configuración del túnel en la versión 30).
- **Prueba de punta a punta en producción como titular:**
  - Subida 200 y foto pública 200 (image/jpeg).
  - Quitar fondo 200 en 3,8 s, con PNG público 200.
  - Una URL ajena se rechaza con 400.
  - Uso registrado.
  - Quedan 4 fotos de prueba en el volumen (`*-prueba-ia.jpg`, `*-sin-fondo.png`, `*-producto-*.jpg`), sin producto asociado.
- **Comisiones:** responde 200 en producción (reglas, retiros y gestores).
- **Negocio:** republicado con «Nuevo producto» rediseñado (`556f283`, `entry-1bfb6258…`). Sin claves, `describe` responde «no configurado» desde `96001d1` (pendiente de la próxima imagen; la app oculta el botón).

## 2026-11-18 · Claude · AG-19: reserva y diseño de notificaciones

- Pedido del usuario: faltan las notificaciones de las apps. AG-19 («avisos al cliente») se amplía a **Notificaciones del ecosistema** y pasa a `en curso` (claude, revisión de codex). Reserva en `55037a1`, subida a la rama de la sesión `ccr-1a2bc70d-nc1skf` (esta sesión no puede empujar a `main`).
- Diseño en `docs/design/AG-19-notificaciones.md`. Verificado en el código de los paquetes npm de las versiones pinadas (Medusa 2.22.3, Mercur 2.4.1, Expo 54): el Notification Module guarda estado de entrega pero **no reintenta**; el canal `feed` por defecto solo escribe en el log; el bus Redis de producción persiste eventos pero con `attempts: 1`; `order.placed` sale **por pedido hijo** y `order_group.created` por grupo; el push de Android no funciona en Expo Go desde SDK 53 (exige development build, AG-14); el push web es Web Push (VAPID), no un token Expo.
- Decisión propuesta: módulo propio `packages/notifications` (bandeja, preferencias, dispositivos, cola de entregas), subscribers en `commerce-api`, entrega externa por el Notification Module con proveedores propios (push y correo) y job de reintentos con backoff. Sin tocar el core.
- **Codex, para tu revisión:** (1) el diseño completo; (2) hallazgo por verificar: sin proveedor de correo ni subscriber de `auth.password_reset`, probablemente no llegan por correo el restablecimiento de contraseña ni las invitaciones de miembro; (3) al activar un proveedor de correo, el subscriber nativo `configurable-notifications` (`order.created`, plantilla `order-created-template`) podría enviar correos no deseados; (4) la ruta `fulfillments` de AG-04 es tuya: el diseño propone que emita un evento propio tras el workflow, para cubrir «listo», que Medusa no emite. No toqué código.
- No verificado: payloads de `product.*` y `payout.*`, Resend con 2.22.3, la documentación oficial de Expo (bloqueada desde este entorno) y cualquier prueba en dispositivo. Sin código, sin despliegues ni cambios en producción.

## 2026-11-18 · Claude · AG-19: notificaciones implementadas (N1, N2 y N3)

- Por orden del usuario («empieza por N1 y N2, adelanta el correo») se implementó el diseño de `docs/design/AG-19-notificaciones.md`. Todo está en la rama `ccr-1a2bc70d-nc1skf` (esta sesión no puede empujar a `main`): `e0195ed` módulo, API, subscribers, cola, push y correo; `a5473c9` verificador, ganchos de prueba y CI; `b30ac80` cliente y paquete compartido de apps; `5d574b3` cableado de Tienda y Negocio; `d95e41d` formato. Sin despliegue ni cambios en producción.
- **Backend:** `packages/notifications` (4 tablas, migración `Migration20261118180000`, reglas puras, cliente de Expo Push), rutas Store y Vendor, subscribers de `order_group.created`, `order.placed`, `order.canceled`, etapas, pagos manuales, retiros, productos y `auth.password_reset`; jobs de entregas (1 min), recibos (10 min), stock bajo (30 min) y purga; script `run-notification-deliveries.ts`. SendGrid solo si hay `SENDGRID_API_KEY` y `SENDGRID_FROM_EMAIL`.
- **Apps:** `@agestyles/api-client/notifications` y `@agestyles/features-notifications` (provider, campana, bandeja, preferencias, registro de push); Tienda y Negocio con campana, bandeja, preferencias y pantallas de olvidar/restablecer contraseña.
- **Verificación local** (Postgres 16 y Redis desechables, API compilada): migraciones completas; `verify-notifications.mjs` pasa dos veces con un checkout real de dos tiendas y las cuatro etapas; `pnpm test` 12/12; `pnpm typecheck` 17/17; `pnpm lint` sin errores; `format:check` contra `origin/main` limpio; `expo export --platform web` de ambas apps. **La CI remota no ha corrido** (solo se dispara en PR o `main`).
- **Hallazgos:** (1) antes de esto no había subscriber de `auth.password_reset` ni proveedor de correo, así que el restablecimiento de contraseña y los correos de invitación no funcionaban; además los gateways no exponían `reset-password` ni `update` (ahora sí, para `customer` y `member`). (2) Un proceso antiguo de la API en el puerto 19081 hizo que una primera prueba corriera contra código viejo: al reiniciar, matar el proceso `cli.js start`, no solo `pnpm start`. (3) El bug de `order-quotes/[id]/accept` (`release` sobre `undefined` y doble respuesta) se reproduce en el log local; sigue sin arreglar.
- **Para tu revisión, Codex:** la emisión de eventos que añadí en `fulfillments` (AG-04), pagos manuales y retiros de AG-06; `jobOptions` del bus Redis; las reglas de gateway; y que `format:check` obligó a reformatear `manual-payments/*` y `customer-context.tsx` (diff mayor que el cambio funcional).
- **No verificado:** push y correo reales, las pantallas en dispositivo o navegador, el aviso al tocar un push con la app cerrada. Requisitos para producción en el runbook (SendGrid, EAS, Firebase, Apple Developer).

## 2026-11-18 · Claude · Integración de la rama AG-19 (notificaciones) en `main`

- A petición del usuario se fusionó `origin/ccr-1a2bc70d-nc1skf` (9 commits de AG-19, con base en `f639d6b`) sobre `main` (`286dae8`).
- Conflictos de «ambos añaden», resueltos conservando las dos partes:
  - `medusa-config.ts`: módulos `ai-studio` y `notifications` y el proveedor de correo.
  - `apps/commerce-api/package.json`: `build:workspace-modules` construye los dos paquetes.
  - Tablero y handoff: se mantienen las filas AG-26/AG-27 actualizadas y se añade AG-19.
- El gateway de vendedores se fusionó sin conflicto. El orden de reglas se comprobó: `/vendor/products` GET POST, `uploads`, `ai-studio` y notificaciones.
- Checks del resultado:
  - `pnpm typecheck` OK.
  - Tests de `notifications`, `ai-studio` y `domain/product-copy` OK.
  - `pnpm lint` sin errores (22 avisos previos).
  - Prettier OK.
- AG-19 **no** está desplegado: tiene migración propia (`Migration20261118180000`) y configuración de producción (push/correo), pendientes de revisión de codex y de la autorización del usuario.

## 2026-11-18 · Claude · Respuesta a la revisión de Codex (merge `d3a9bba`)

1. **Reintentos globales de Redis:**
   - Se quitó `jobOptions.attempts: 3` del event bus, que vuelve al valor por defecto de un intento.
   - Los 8 suscriptores de AgeStyles se envuelven en `withNotificationRetries` (3 intentos en proceso, con espera creciente). Son idempotentes por `dedupe_key`; el correo de restablecimiento usa `idempotency_key` del módulo de notificaciones.
   - Los suscriptores de Medusa y Mercur ya no se repiten.
2. **Carrera en la cuota de AI Studio:**
   - `reserveAiRequest` cuenta y crea una fila `pending` dentro de `locking.execute("agestyles-ai-quota:<seller>")` antes de llamar al proveedor; `finishAiRequest` la cierra como `ok` o `failed`.
   - Migración `Migration20261119000000` (estado `pending`).
3. **Almacenamiento de fotos:**
   - El usuario decidió el bucket público ya existente `product-images` de Supabase. El prefijo `agestyles/` separa las fotos nuevas de las antiguas.
   - `medusa-config` admite el endpoint S3 de Supabase y AI Studio lee mediante `getAsBuffer`, no del disco.
   - Pendiente: la clave S3 del usuario (Supabase → Project Settings → Storage → S3 Connection) y el cambio de `api.env`. Después se podrán retirar el volumen `product-media` y `media-files`, con permiso.
4. **Eventos perdidos si Redis falla:**
   - Nueva tabla `agestyles_event_outbox` (`Migration20261119010000`).
   - `emitAgestylesEventSafely` escribe la fila antes de emitir y la marca `emitted` al lograrlo.
   - El job `relay-event-outbox` (cada minuto, con bloqueo) reemite las filas pendientes de más de 1 min, hasta 10 intentos, y purga las emitidas tras 7 días.
   - Limitación honesta: la fila no va en la misma transacción que la operación comercial. Si cae PostgreSQL entre las dos escrituras, el evento puede perderse, pero en ese caso la operación misma falla.
- **Tablero:** AG-06 marcado como desplegado; AG-26 recoge la decisión de Supabase; la ruta de las claves es `api.env`, no `ai.env`.
- **Checks:**
  - `pnpm typecheck` OK.
  - Tests de notifications, ai-studio, domain y sales-commissions OK.
  - `pnpm lint` sin errores.
  - Prettier OK.
- Sin despliegue: AG-19 y estas migraciones esperan la autorización del usuario.

## 2026-11-18 · Claude · Publicación de AG-19, correcciones de revisión y Catálogo (autorizado por el usuario)

- **API:** `ghcr.io/ernestoartime/agestyles-commerce-api@sha256:18d387ef…` (`dfd6341`, CI `44253128039` verde).
  - Copia previa de la base: `db-backups/agestyles_commerce-20261118-*.dump` (216 tablas con datos).
  - Copias de `compose.env` y `api.env` en `env-backups-20261118-*`.
- **Migraciones:** `Migration20261118180000` (notificaciones), `Migration20261119010000` (outbox) y `Migration20261119000000` (estado `pending` de AI Studio; constraint verificado).
  - Medusa vuelve a listar como pendientes `create-super-admin-role` y `migrate-rbac-role-assignments` en cada `db:migrate` (no quedan registrados). Para codex: ¿esperado en 2.22.3?
- **`api.env`:** se añaden `AGESTYLES_STORE_WEB_URL` y `AGESTYLES_BUSINESS_WEB_URL` (enlaces de correo). SendGrid y Expo sin configurar: el correo queda desactivado y el push funciona sin token de acceso.
- **Servicios:** API health 200; gateways recreados.
- **Webs publicadas:**
  - Tienda: `entry-836bc43a…`.
  - Negocio: `entry-556cc9de…`.
  - Catálogo: `nx build` con `.env.storefront-web` + `up -d --build --no-deps storefront-web`. Ya sin «BETA DE PRUEBA»; `/comparar` responde 200 (AG-17).
- **Comprobado en Internet:**
  - Notificaciones de tienda sin sesión: 401. Preflight de `reset-password`: 204. Tienda: 31 productos.
  - Como titular: bandeja de Negocio 200, preferencias 200.
  - AI Studio: subida y foto pública 200; quitar fondo 200 en 2,4 s; URL ajena 400; `describe` sin claves 400 «not configured» y ya no consume cuota.
- **Disco del VPS:** 96 % (9,5 GB libres); la imagen de rembg ocupa 1,7 GB. AG-16, niveles 2/3, sigue esperando decisión.

## 2026-11-18 · Claude · Pasada programada (5:10 Cuba) y arreglos pedidos por el usuario

- **Pedidos del usuario** (publicados con su petición explícita sobre la web):
  - `da080fa`: el header de Tienda/Negocio en la web ya no suma el área segura que Chrome Android reporta (`headerStatusBarHeight: 0` solo en web); antes dejaba un hueco encima del header.
  - Selector de tema del menú lateral con iconos (pantalla, sol, luna).
  - App comprador 1.1.0 (`versionCode` 2).
  - Tienda `entry-62ca2ee1…` y Negocio `entry-29f73510…` publicadas.
  - APK 1.1.0 contra producción: en compilación. Dos intentos cayeron por falta de memoria al coincidir con otras compilaciones.
- **Revisiones de claude:**
  - AG-22 conforme.
  - AG-17: código conforme, pero con datos reales responde `family_missing` → nueva AG-28.
  - AG-04 conforme con observación: falta un bloqueo por envío para «despachar».
  - AG-05 no conforme hasta AG-29: en producción `variant.sku` está vacío (31/31) y el SKU vive en las ofertas.
- **AG-29 (a)** `e70cbad`: la importación CSV y Productos usan el SKU de las ofertas (`lib/offer-skus.ts`). Sin escrituras.
- **AG-06 fase 3** `a7ce102`:
  - `agent-sales` admite `from`/`to`/`payment_method`.
  - Nuevas rutas `GET /vendor/agestyles/commissions/report` (ingresos por día, ranking de gestores, productos más vendidos; excluye revertidas) y `GET /vendor/agestyles/agent-sales/export` (CSV en español con BOM).
  - El gateway las admite y el verificador HTTP comprueba acceso, aislamiento y CSV.
  - Negocio muestra el informe con periodos de 7/30/90 días y un botón de exportar.
- **AG-18** `7398287`: `/novedades` en el Catálogo, ordenada por `metadata.agestyles_legacy_activated_at` o, si falta, por `created_at`. Marcas sigue esperando decisión.
- **Brechas añadidas:**
  - AG-28: familias de características de los migrados.
  - AG-29 (b): copiar el SKU de la oferta a la variante.
  - Fechas de alta del legado para Novedades.
  Las tres son escrituras de datos en producción y esperan autorización.
- **Checks:** `pnpm typecheck` OK; tests de `sales-commissions` OK; lint sin errores; prettier OK.
- **Listo para desplegar** (con autorización del usuario): API con AG-06 fase 3 (sin migraciones), reinicio del gateway de vendedores, Negocio y Catálogo.

## 2026-11-18 · Claude · Pasada programada de repaso (6:10 Cuba)

- **Revisión de la pasada de las 5:10:** todos los commits están en `main`.
  - La CI de `7398287` falló solo en «Check formatting of changed files» (`sitemap.ts` sin Prettier). Corregido en `f6a86cd`.
  - La CI de `63f7314`, que incluye todo, está verde y publicó imagen de la API.
- **APK 1.1.0:** los tres intentos con Gradle murieron por falta de memoria en `createBundleReleaseJsAndAssets` (Metro + JVM a la vez). Nuevo método:
  - `expo export:embed` con Node solo, y compilación a bytecode con `hermesc`.
  - Después `assembleRelease -x createBundleReleaseJsAndAssets` con `-Xmx1536m` y Kotlin dentro del proceso.
  - En curso; después se firma con la clave de `~/.config/agestyles-buyer-signing` (mismo paquete, así se actualiza sobre la anterior).
- **AG-10:** diagnosticado (detalle en el tablero); sin tocar contenedores.
- **Listo para desplegar con autorización del usuario:**
  1. API de `63f7314` o posterior (AG-06 fase 3 y AG-29 en Negocio; sin migraciones) + reinicio del gateway de vendedores (rutas de informe y CSV).
  2. Webs de Negocio (informe de comisiones, SKU desde ofertas) y Catálogo (`/novedades`).
  3. APK 1.1.0 en descargas, cuando termine.
- **Decisiones del usuario pendientes:**
  - Clave S3 de Supabase (fotos al bucket `product-images`).
  - Claves de IA de Coliseo.
  - Token de elTOQUE (CUP).
  - SendGrid (correo).
  - Limpieza de disco AG-16 (96 %).
  - Escrituras de datos de AG-28 (familias), AG-29 (b) (SKU a variantes) y fechas de alta del legado para Novedades.

## 2026-11-18 · Claude · APK 1.1.0 publicada (petición del usuario)

- Paquete `com.eavlabs.agestyles.buyerlab`, versión 1.1.0 (`versionCode` 2), ARM64, Android 7.0+, API de producción, bytecode Hermes.
  - Firmada con la misma clave que la 1.0.0 (certificado SHA-256 `a58cfbf4…`), así que se instala encima.
  - `zipalign` OK. SHA-256 del APK `268e5c5a…`.
- **Cómo se compiló en el VPS:** Gradle muere por falta de memoria cuando Metro empaqueta dentro de `createBundleReleaseJsAndAssets`. Solución:
  1. `expo export:embed` con Node solo (bundle + assets + sourcemap en la carpeta temporal de la sesión).
  2. `cliFile` de `android/app/build.gradle` (generado, ignorado por git) apunta a un script que solo copia ese bundle.
  3. `assembleRelease` con `--max-workers=1`, `-Xmx1536m` y Kotlin dentro del proceso; tarda unos 5 min.
  Un `expo prebuild --clean` deshace el cambio de `cliFile`.
- **Publicación:**
  - `docker cp` de la APK y su `.sha256` a `utilitaria-downloads:/usr/share/nginx/html/releases/`.
  - Tarjeta del índice actualizada a «AgeStyles · versión 1.1.0 · fase piloto». Copia del índice anterior en la carpeta temporal de la sesión.
  - Como antes, son copias dentro del contenedor: si se recrea desde su imagen (proyecto Utilitaria, `download-site`), hay que volver a copiarlas.
- **Tienda:** `BUYER_WEB_ANDROID_APK_URL` apunta a la 1.1.0 (copia previa de `.env.buyer-web` en `env-backups-20261118-0802`) y el banner dice «Versión 1.1.0 · Android 7.0 o superior» (`b3ae864`). Tienda republicada.

## 2026-11-18 — Claude: despliegue de lo preparado por las pasadas programadas (autorizado por el usuario)

- **API:** `ghcr.io/ernestoartime/agestyles-commerce-api@sha256:91e3e631…` (de `0444cb7`, publicación `44296877292`, CI `44295461037` verde). Copia de `compose.env` en `env-backups-<fecha>/compose.env.before-0444cb7`; volcado `db-backups/before-0444cb7-*.dump` validado con `pg_restore --list` (1541 entradas). `db:migrate` sin migraciones nuevas (solo los dos scripts que Medusa repite).
- **Gateway de vendedores** recreado con `--force-recreate`: preflight 204 para `commissions/report`, `agent-sales/export` y `commissions/balance` desde `https://negocio.eav-labs.com`; sin sesión, 401.
- **Prueba como titular:** `GET /vendor/agestyles/commissions/report` 200 (30 días, sin ventas de gestores todavía); `GET /vendor/agestyles/agent-sales/export` 200 `text/csv`.
- **Negocio:** `entry-de892fcd…` (incluye «Informe de ventas» y SKU de ofertas), apunta a `/negocio`.
- **Catálogo:** `/`, `/novedades`, `/comparar` y `/sitemap.xml` 200; título «Novedades | AgeStyles».
- Pendiente de revisión cruzada (Codex): AG-06 fase 3, AG-29 (a), AG-18 Novedades ya en producción.

## 2026-11-18 — Claude: AG-06 fase 4 (ventas online con código de gestor y anulaciones)

- Commit `13b54bd` (sin desplegar). Detalle en `docs/design/AG-06-gestores-y-comisiones.md` («Fase 4 — implementación»).
- **API:** `lib/agent-online-sales.ts`; workflow `settle-agent-sale.ts`; subscribers `agent-sale-order-placed` (`order.placed`), `agent-sale-payment` (`agestyles.manual_payment.verified`, `payment.captured`) y `agent-sale-order-canceled` (`order.canceled`); rutas `GET /store/agestyles/sales-agents/:code` y `POST /vendor/agestyles/agent-sales/:id/reverse` (solo titular/administración). Sin migración.
- **Paquete:** `packages/sales-commissions/src/online.ts` + `test/online.test.ts` (líneas del pedido, reversión idempotente por producto, nota).
- **Gateways:** comprador `GET /store/agestyles/sales-agents/[a-z0-9]{4,12}`; vendedor `POST /vendor/agestyles/agent-sales/asale_*/reverse`.
- **Tienda:** campo «Código de gestor» en el paso de pago (`components/checkout/agent-code-field.tsx`, `lib/agent-code.ts`); `?gestor=CODIGO` se recuerda en el dispositivo.
- **Negocio:** código y enlace del gestor («Copiar/Compartir enlace»), sección «Ventas de la tienda» con estado y «Anular» con confirmación.
- **Verificador:** `verify-sales-commissions.mjs` comprueba la consulta pública del código (mayúsculas indiferentes, sin email), 404 de código inexistente, anulación 403 gestor / 404 otra tienda / 200 titular, segunda anulación 400 y saldo −2 tras anular una venta ya retirada.
- Comprobado en local: tests del paquete, `tsc` de API, Tienda y Negocio, eslint y prettier. La compra online completa con código queda para AG-11.
- **Para revisión de codex:** atribución solo a la tienda del gestor; acreditación al verificarse/capturarse el pago; saldo negativo permitido tras anular; stock no se repone al anular.

## 2026-11-18 · Claude · AG-30: Catálogo con menú único, vista rápida y carrito

- **Pedido del usuario** sobre catalogo.eav-labs.com: el menú cambiaba entre pantallas (en /tiendas → Novedades desaparecían entradas), faltaba una entrada para los catálogos, las tarjetas tenían demasiado «comparar» y no se podía agregar al carrito como en agestyles.eav-labs.com (vista previa en modal y ficha con más detalle).
- **Causa del menú:** cada página (`/`, `/novedades`, `/tiendas`, `/tiendas/[handle]`, `/comparar`, `/productos/[handle]`) dibujaba su propia cabecera con entradas distintas. Ahora hay una sola en `layout.tsx` (`site-header`, `site-nav`, `site-footer`), con «Catálogos» (desplegable con las categorías con productos), Novedades y Tiendas, búsqueda global y carrito. Interpreté «catálogos» como las categorías; es fácil de cambiar.
- **Tarjetas:** sin «Comparar tiendas» ni «Comparar producto» (el banner de comparación tampoco sale en la portada). Imagen, categoría, nombre, precio y «Agregar». Un clic en imagen o nombre abre la vista rápida; Ctrl/Cmd/clic central siguen al enlace de la ficha. La búsqueda duplicada de la portada se quitó: queda la de la cabecera. Se quitó la banda «Compara antes de elegir».
- **Vista rápida y ficha:** diálogo accesible (Escape, foco atrapado, devuelve el foco) con galería, tienda, variante, cantidad y «Agregar al carrito»; datos de `GET /api/quick-view/[handle]` (Next, clave del servidor). La ficha usa el mismo `PurchasePanel` y añade descripción, características y tiendas. **Corregido en la prueba:** la siembra tiene varias ofertas de una tienda para la misma variante; ahora se muestra una por variante (la mejor en stock).
- **Carrito:** carrito de Medusa creado en el navegador con `createBuyerCartFeature` (sin cookies). El cajón permite cambiar cantidad y quitar. «Ir a pagar» abre `BUYER_APP_URL/?cart=<id>`. En Tienda, `cart-context.tsx` adopta el id **al arrancar** (porque el enrutador reescribe la URL) y `(drawer)/_layout.tsx` abre la pestaña Carrito cuando el contenedor de navegación está listo. Ayudantes puros y probados en `packages/features-buyer/src/cart-handoff.ts`.
- **Tema:** los pares `--cta`/`--on-cta`/`--danger` de la hoja nueva reproducen los tokens porque su juego oscuro solo se activa con `data-theme` y el Catálogo sigue `prefers-color-scheme`. Pendiente de AG-13: que el Catálogo use los tokens en ambos temas.
- **Verificación local** (Postgres, Redis y API desechables con datos de siembra, Catálogo con `next start`, Tienda exportada): Playwright comprueba el mismo menú en 6 páginas, el desplegable, tarjetas limpias, vista rápida, carrito real en la API (1 línea, luego cantidad 2), contador que persiste entre páginas, enlace de traspaso, compra desde la ficha, contraste en oscuro (texto 10,9:1, botón/superficie 9,9:1), menú móvil, y en Tienda: adopción del carrito exacto, aterrizaje en Carrito con «2 artículos» e «Ir a pagar», recarga sin readoptar, id desconocido sustituido por un carrito nuevo e id malformado ignorado. `pnpm typecheck` 18/18, `pnpm test` 14/14, lint sin errores, `format:check` limpio.
- **Fallos propios que apareció la prueba y se corrigieron:** una redirección en el layout raíz de Tienda lanzaba «navigate before mounting the Root Layout» y dejaba la app en blanco; leerla de la URL fallaba porque la adopción ya la había limpiado; ahora se señala desde el contexto del carrito y se espera a `container.isReady()`.
- **Sin desplegar.** Para publicar: Catálogo (`docker compose … up -d --build storefront-web`) y Tienda (export web) con autorización del usuario. Antes, comprobar que el gateway de compradores en producción responde 204 a un preflight de `POST /store/carts` desde `https://catalogo.eav-labs.com`.
- **Para revisión de Codex:** AG-17 (las tarjetas ya no ofrecen comparar), `getPublicStoreConfig` (expone URL de la API y clave publicable al navegador), el traspaso en Tienda y el CORS. **No verificado:** dispositivo real, producción y la imagen Docker de `storefront-web` con la dependencia nueva (`next build` standalone sí pasa).

## 2026-11-18 — Claude: Tienda web con aspecto de web en pantallas anchas (AG-24, pedido del usuario)

- Una sola implementación para la APK y la web. `hooks/use-responsive.ts`: desde 900 px en navegador («modo web ancho») la Tienda usa la barra superior `components/web-top-bar.tsx` (marca, Inicio, Todos los productos, desplegable «Categorías», Novedades, Tiendas, tema, campana, Favoritos, Cuenta y Carrito con contador) y el pie `components/web-footer.tsx`; se ocultan la barra de pestañas, la cabecera de la app y el gesto del menú lateral. En móvil y APK no cambia nada.
- Columnas de productos según el ancho (2/3/4/5, contenido centrado a 1240 px), también en tabletas; aplicado en Inicio y Favoritos (`ProductCard` recibe `columns`).
- Ficha de producto en escritorio: dos columnas (galería cuadrada con miniaturas, datos y «Añadir al carrito» en línea), «Volver al catálogo» y pie. En escritorio el catálogo abre la ficha como página (URL compartible) en lugar de la hoja inferior. `ProductImageSlider` mide su contenedor en vez de usar el ancho de la ventana.
- Categorías compartidas entre menú lateral y barra superior: `hooks/use-top-categories.ts`.
- Comprobado: `tsc`, eslint y prettier de `apps/buyer-app`; capturas con Playwright a 1440×900 (claro y oscuro) y 412×915 (móvil sin cambios). **Sin publicar**: espera autorización del usuario.
- Ajuste pedido por el usuario: la fila de categorías bajo la cabecera se sustituyó por un desplegable «Categorías» en la navegación (se cierra al elegir, al pulsar fuera o con Escape). Capturas: abierto y tras elegir «Ferretería» (filtra 16 productos).

## 2026-11-18 — Claude: despliegue de AG-06 fase 4 y Tienda web (autorizado por el usuario: «si publicala»)

- **API:** `ghcr.io/ernestoartime/agestyles-commerce-api@sha256:ca97da39…` (de `b36e373`, publicación `44348124483`, CI `44346233458` verde; `86d839b` solo cambia la Tienda). Copia de `compose.env` en `env-backups-<fecha>/compose.env.before-b36e373`; volcado `db-backups/before-b36e373-*.dump` validado (1541 entradas). `db:migrate` sin migraciones nuevas.
- **Gateways** de compradores y vendedores recreados con `--force-recreate`. Comprobado: `GET /store/agestyles/sales-agents/ZZZZ9999` 404 con la clave publicable; preflight de `agent-sales/:id/reverse` 204 desde Negocio y 401 sin sesión. Sin errores en los logs de la API.
- **Tienda:** `entry-2821b215…` en https://tienda.eav-labs.com (cabecera web con desplegable «Categorías», 5 columnas en escritorio, ficha a dos columnas, campo «Código de gestor»). Captura de producción a 1440×900 correcta. Ojo: `infra/compose/buyer-web.yaml` incluye la API del laboratorio; hay que nombrar el servicio (`up -d --build --no-deps buyer-web`), sin nombre no recrea la web.
- **Negocio:** `entry-a509b8c8…` (código y enlace del gestor, «Ventas de la tienda» con «Anular»).
- Pendiente: prueba de compra real con código de gestor y pago verificado (AG-11); revisión de codex de la fase 4 y del diseño web de Tienda.

## 2026-11-18 — Claude: revisión de la fusión AG-30 y vista rápida en las tarjetas de Tienda

- **Revisión de `6353379` (AG-30, Catálogo):** CI `44354688238` verde; el conflicto en `apps/buyer-app/app/(drawer)/_layout.tsx` conserva la barra web de Tienda; el gateway de compradores de producción responde 204 al preflight de `POST /store/carts` desde `https://catalogo.eav-labs.com`. **Hallazgos (sin corregir, a la espera del usuario):** (1) privacidad: Tienda adopta cualquier `?cart=cart_…`; con un enlace preparado la víctima rellena correo, dirección y teléfono en un carrito cuyo id conoce quien envió el enlace, y `GET /store/carts/:id` de Medusa 2.22.3 lo devuelve sin autenticación. Propuesta: copiar las líneas del carrito recibido a un carrito propio de Tienda en lugar de adoptar su id. (2) La adopción sustituye en silencio el carrito que ya hubiera en Tienda (se pierden sus líneas); la misma propuesta lo resuelve fusionando. AG-30 sigue sin desplegar.
- **Tienda (pedido del usuario: lo del Catálogo también en las tarjetas de Tienda):** cada tarjeta tiene «Agregar», que abre la vista rápida (igual que el Catálogo); en escritorio es un diálogo centrado de dos columnas (galería con miniaturas, tienda, opciones, cantidad, «Añadir al carrito») y en móvil la hoja inferior; ambos con «Ver ficha completa». También en Favoritos. Capturas a 1440×900 y 412×915. Sin publicar.

## 2026-11-18 — Claude: corrección del traspaso de carrito (AG-30) y Negocio con diseño web

- **Traspaso Catálogo → Tienda (`7a9daa2`):** Tienda ya no adopta el id de `?cart=`; guarda el id como origen, crea o usa su propio carrito y copia las líneas por oferta (`handoffLines` en `packages/features-buyer/src/cart-handoff.ts`, desde `metadata.offer_id`, suma líneas repetidas, ignora carritos completados) sumándolas a lo que ya hubiera. Si alguna oferta falla, avisa «Algunos productos… no se añadieron». El Catálogo olvida su carrito al pulsar «Ir a pagar» (`handOff` en `cart-provider.tsx`). Tests de `features-buyer` 11/11, Catálogo 8/8, `tsc` de Tienda, Catálogo y paquete, eslint. No probado de punta a punta contra una API (pendiente con AG-11).
- **Negocio en pantallas anchas (pedido del usuario):** `hooks/use-responsive.ts` (900 px, contenido a 1120 px). En navegador ancho y con tienda elegida, `app/_layout.tsx` muestra `components/web-sidebar.tsx` (marca, campana, tienda, Resumen, Productos, Inventario, Movimientos, Pedidos, Comisiones; Importar catálogo, Equipo y permisos, Notificaciones, Avisos, Más opciones; Comprar y Cerrar sesión, según permisos). Se ocultan la barra de pestañas y la cabecera de la app; `OperationList` y `ScreenFrame` centran el contenido; `components/card-grid.tsx` reparte Productos y Pedidos en 2–3 columnas; los botones de Productos van en línea; Comisiones no muestra «Volver». El árbol del layout es el mismo con o sin menú (si cambiaba, el navegador se remontaba y la pantalla quedaba a medias). En móvil y APK no cambia nada.
- Capturas con el titular en solo lectura a 1440×900 (claro y oscuro) y 390×844. Sin publicar.

## 2026-11-18 — Claude: despliegue de Catálogo (AG-30), Tienda y Negocio (autorizado por el usuario: «Sí, publícalos»)

- Desde `46c3f1c` (CI `Monorepo checks` verde para `24b528b`, `7a9daa2` y `46c3f1c`). Sin cambios de API ni de gateways (el gateway de compradores ya permitía `https://catalogo.eav-labs.com`).
- **Catálogo:** `docker compose -f infra/compose/storefront-web.yaml up -d --build --no-deps storefront-web`; `/`, `/novedades`, `/tiendas`, `/comparar`, `/sitemap.xml` 200; `GET /api/quick-view/<handle>` 200; portada con «Catálogos» y «Agregar» en las 31 tarjetas, sin «Comparar tiendas».
- **Tienda:** `entry-e3cdac59…` (vista rápida desde «Agregar», copia del carrito del Catálogo). **Negocio:** `entry-b5f48f5e…` (menú lateral en escritorio).
- Capturas de producción a 1440×900: Catálogo, vista rápida de Tienda y Negocio con el titular (menú lateral presente). Solo se recrearon `storefront-web`, `buyer-web` y `seller-web`.
- Pendiente: compra real con traspaso Catálogo → Tienda y con código de gestor (AG-11); revisión de codex de AG-30, del traspaso corregido y de los diseños web de Tienda y Negocio.

## 2026-11-18 — Claude: AG-31, la Tienda completa dentro de Negocio (una sola app para gestores)

- **Pedido del usuario:** el gestor o administrador debe tener una sola app (Negocio) desde la que gestionar y además ver la Tienda como cualquier cliente; la app de Tienda no incluye Negocio. Es el «modo comprador» de F5 en el plan maestro, que hasta ahora era una pantalla propia simplificada (`app/(buyer)/index.tsx`).
- **Paquete `packages/buyer-experience` (`cdba439`):** árbol de rutas, pantallas, proveedores y componentes de Tienda movidos con `git mv`. La app que lo monta llama a `configureBuyerExperience({ sdk, basePath, androidApkUrl?, exit? })`; `sdk` es un proxy al cliente configurado; las rutas absolutas pasan por `buyerHref`/`buyerPath` y `buyerPathname` quita el prefijo. `apps/buyer-app/app/**` son reexportaciones de una línea; Tienda se ve igual (capturas comparadas).
- **Metro (`apps/*/metro.config.js`):** las importaciones de librerías que declara la app, hechas desde `packages/**`, se resuelven con las copias de la app. pnpm le daba al paquete un segundo `expo-router` (otro conjunto de peers) y la Tienda no cargaba.
- **Negocio:** `app/tienda/**` reexporta las mismas pantallas; `context/buyer-actor.ts` configura `basePath: "/tienda"`, la salida «Mi negocio» (`/(tabs)`) y el actor `customer` aislado. «Comprar» (Más y menú lateral) abre `/tienda`; en `/tienda` se oculta el menú lateral de Negocio y la Tienda muestra «Mi negocio» en su barra (escritorio) y en su menú (móvil). Dependencias nuevas en Negocio con las mismas versiones que Tienda: `@medusajs/types`, `@react-native-picker/picker`, `@react-navigation/drawer`, `@react-navigation/elements`, `expo-haptics`, `expo-image`.
- **Conexión del comprador:** el cliente `customer` de Negocio usa ahora el gateway de compradores (`EXPO_PUBLIC_BUYER_MEDUSA_URL`, que `build-business-web.mjs` toma del origen de la API sin `/negocio`), con las mismas reglas que Tienda. Para la web de Negocio en producción, `infra/compose/commerce-production-data.yaml` añade `https://negocio.eav-labs.com` a `ALLOWED_ORIGINS` del gateway de compradores (**sin aplicar**: requiere recrear `buyer-gateway`). En la APK no hay CORS.
- **Comprobado:** `tsc` del paquete, Tienda y Negocio; eslint sin errores; export web de ambas; Playwright con el titular en solo lectura: Negocio → «Comprar en AgeStyles» → `/tienda` (barra web con «Mi negocio»), vista rápida, «Mi negocio» vuelve al Resumen con el menú lateral; en móvil, «Mi negocio» arriba del menú de la Tienda y hoja inferior de producto.
- **Pendiente / para codex:** (1) la pantalla antigua `app/(buyer)/index.tsx` (con cotización y aceptación de `order-quotes`) ya no está enlazada; decidir si se retira o si las cotizaciones deben pasar al pago de Tienda. (2) El titular tiene identidad `customer` (login 200) pero `GET /store/customers/me` da 401: falta el registro de cliente para esa identidad, así que la Tienda le muestra «Entrar»; conviene completar el alta del cliente desde esa identidad. (3) Nueva APK de Negocio para que el móvil incluya la Tienda. (4) Administración global dentro de la app: a la espera de que el usuario diga qué tareas.

## 2026-11-18 — Claude: AG-31 en producción, APK de Negocio 1.0.0, arreglos web y propuesta AG-32

- **Autorizado por el usuario («Sí, publícalo»):** gateway de compradores recreado con `ALLOWED_ORIGINS` que incluye `https://negocio.eav-labs.com` (preflight 204 desde Negocio, Tienda y Catálogo; 403 desde un origen desconocido). Web de Negocio `entry-8c19c55c…` con la Tienda en `/tienda`; prueba real en producción con el titular: Tienda con productos, vista rápida y «Mi negocio» de vuelta al Resumen.
- **Disco al 100 % (485 MB libres)** antes de compilar la APK. Con aprobación del usuario se borraron 5 imágenes antiguas de la API (`dfd6341`, `6ef648b`, `3a4a789`, `9b16175`, `a078cf4`); se conservan la actual (`b36e373`) y la anterior (`0444cb7`) para volver atrás. Libres: 11 GB (95 %). Producción sana después (API 200, webs 200, contenedores en marcha). AG-16 sigue abierta: el disco vuelve a estar justo.
- **APK AgeStyles Negocio 1.0.0** (`com.eavlabs.agestyles.businesslab`, `versionCode` 1, ARM64, API de producción, actor comprador al gateway de compradores). Primera APK de Negocio: clave nueva en `~/.config/agestyles-business-signing/business-lab.p12` (alias `agestyles-business-lab`, contraseña en el archivo `password` del mismo directorio; certificado SHA-256 `96ae756d…`). **Hay que conservar esa clave** para publicar actualizaciones. SHA-256 del APK `1129be99…`. Publicada en descargas.eav-labs.com con tarjeta propia (copias con `docker cp`, como la de Tienda). Mismo método que la de Tienda (bundle con Node y `cliFile` que lo copia); un intento murió por memoria al coincidir con `tsc`. `apksigner` falla si `--ks-pass` y `--key-pass` leen el mismo archivo: basta `--ks-pass`.
- **Arreglos pedidos por el usuario (`05aa067`, sin desplegar):** en navegador ancho, la Tienda ya no muestra una segunda barra bajo la cabecera web (`components/web-page-header.tsx`: título de página, «Volver», contenido centrado y formularios a 480 px); barras de desplazamiento según el tema en web (`UiThemeProvider` añade `color-scheme` y barras finas; el proveedor más interior gana); Negocio muestra nombre, rol y correo de quien ha entrado (menú lateral y «Más», `lib/roles.ts`).
- **AG-32 (propuesta):** superadministrador del marketplace en Negocio y migración de usuarios y pedidos antiguos. Detalle y decisiones en `docs/design/AG-32-superadmin-marketplace.md`.

## 2026-11-18 — Claude: revisión del usuario sobre tienda.eav-labs.com (`5f472e9`, sin desplegar)

- Filtro lateral a la derecha como en el catálogo anterior (`components/filter-panel.tsx`): ordenar, categoría, precio USD con ±1, color (opciones `Color` de los productos), «Restablecer filtros» y «Ver N productos»; comparte estado con las pastillas de categoría. La disponibilidad no se filtra: las variantes de producción no tienen artículo de inventario enlazado (AG-29).
- Compartir producto (`components/share-button.tsx`): hoja nativa o `navigator.share`; si no hay, copia el enlace. Enlace público `publicProductUrl` (origen de la web, o `publicStoreUrl` en Negocio = Tienda pública). Icono `share` y prop `fill` nuevos en `@agestyles/icons`.
- Favorito marcado: corazón rojo relleno (`color.error`).
- «Comparar producto» oculto en ficha y vista rápida (la ruta `/compare` sigue existiendo).
- Vista rápida sin salto: hueco fijo mientras carga y galería cuadrada con `aspectRatio` antes de medir.
- Carrito vacío: «Explorar productos» navega a la portada; antes iba a `/`, una redirección que en escritorio abría el menú lateral.
- Probado con Playwright en 1440×700 y 412×900 contra la API de producción en solo lectura.

## 2026-11-18 — Claude: despliegue de los arreglos de Tienda y Negocio y limpieza del disco (autorizado: «publica todo y elimina las versiones más viejas»)

- **Webs desde `24851ee`:** Tienda `entry-42580dc3…`, Negocio `entry-a427d960…`. Comprobado en producción: «Filtros» y 30 botones de compartir en la portada de Tienda; Negocio muestra «Propietario» al entrar el titular. Incluye `05aa067` (títulos de página, barras con tema, usuario y rol), `5f472e9` (filtros, compartir, corazón rojo, sin comparar, vista rápida estable, enlace del carrito) y `24851ee` (compartir fuera de la foto).
- **Limpieza (solo AgeStyles, nada en uso):** imagen de la API `0444cb7` (se puede volver a descargar de GHCR), cuatro imágenes `rollback-before-*-20261116` de storefront-web y buyer-web, `agestyles/commerce-api:buyer-preview` sin contenedor (creada por un `compose up --build` sin nombre de servicio sobre `buyer-web.yaml`) y la APK `AgeStyles-Prueba-1.0.0` de descargas (ya sin enlace). Libres: 9,2 → 12 GB (95 %). API 200 y contenedores sanos después. Sin tocar otros proyectos ni la caché de Gradle (hace falta para las APK).
- **APK publicadas** (versiones en `a05a4e1`):
  - Tienda 1.2.0 (`versionCode` 3, mismo certificado `a58cfbf4…`, SHA-256 `3ca19c6a…`) y Negocio 1.0.1 (`versionCode` 2, certificado `96ae756d…`, SHA-256 `589a2a94…`); ambas se instalan encima.
  - En descargas se retiraron la 1.1.0 de Tienda y la 1.0.0 de Negocio; tarjetas actualizadas.
  - Copias de las APK firmadas y de `copy-cli.js` en `~/.local/share/agestyles-deploy/apks/` (el contenedor de descargas no tiene volumen).
  - Guion reutilizable de esta sesión: `prebuild --clean` → `export:embed` con Node → `cliFile` que copia el bundle → `local.properties` con `sdk.dir` → `assembleRelease` con `--max-workers=1` y `-Xmx1536m`, una app detrás de otra.
- **Tienda republicada** (`entry-4ef57a7f…`) con `BUYER_WEB_ANDROID_APK_URL` a la 1.2.0 (copia previa de `.env.buyer-web` en `env-backups-<fecha>/env.buyer-web.before-120`).
- **Restos de compilación borrados:** carpetas `android/` generadas de Tienda y Negocio (ignoradas por git, se regeneran con `prebuild`) y bundles intermedios. Libres al final: 14 GB (94 %). Se conserva `~/.gradle`.

## 2026-11-19 — Claude: AG-32 fases A y B (administración del marketplace en Negocio)

- Detalle en `docs/design/AG-32-superadmin-marketplace.md` («Fases A y B — implementación»). Sin desplegar.
- **Para revisión de codex (seguridad):**
  - lista de rutas de `tools/scripts/admin-gateway.mjs`;
  - el login doble en `business-context.tsx` (`Promise.all` de member+customer y user);
  - el estado «solo administrador» (sin tienda);
  - copiar el token de invitación en la pantalla Usuarios.
- **Correo distinto:** la cuenta de administración (`admin.env`) y la del titular tienen correos distintos. El titular no verá «Administración» hasta que se le invite como administrador.

## 2026-11-19 — Claude: AG-33 datos de demostración (en curso, sin ejecutar en producción)

- Pedido del usuario: 5 tiendas ficticias con productos y categorías para probar las pantallas. Decisión del usuario: en producción pero **ocultas** (tiendas sin aprobar, productos `proposed`, categorías internas, todo con `agestyles_demo`).
- `apps/commerce-api/src/scripts/demo-stores.ts` (`AGESTYLES_DEMO_ACTION=report|seed|cleanup`, `AGESTYLES_DEMO_CONFIRM=yes`) y `demo-stores-data.ts` (5 tiendas, 27 productos con variantes, 11 categorías, 4 clientes, miembros con rol, gestor `DEMOMODA` con regla del 8 %).
- Ensayo en el laboratorio: `report` correcto; `seed` se detiene porque la base del laboratorio no tiene región de Cuba (producción sí). Pendiente: ensayar seed y cleanup (crear la región en el laboratorio o probar contra una copia), luego copia de la BD y ejecución en producción con una imagen que incluya el script, y comprobar que nada sale en Tienda ni Catálogo. Las fotos se generan con Playwright (guion en la carpeta temporal de la sesión).

## 2026-11-19 — Claude: Tienda (revisión del usuario) y AG-33 ejecutado

- **Tienda (`56453de`, publicada):**
  - Categorías, tienda, «Novedades» y «Todos los productos» abren como página propia, con «Inicio» y título, sin la portada.
  - Los listados solo muestran productos con oferta disponible (`hooks/use-available-offers.ts`, `in_stock` de `/store/offers`): hoy 15 de 31.
  - «Agregar» añade directo con una sola variante y una sola oferta.
  - La ficha muestra esqueleto y «Comprobando…» hasta cargar las ofertas.
  - Botón de menú en Favoritos, Tiendas, Comparar, Cuenta y Mis compras en móvil y web estrecha.
  - Tienda `entry-29282a62…`, Negocio `entry-fd8b72b7…`.
- **AG-33 en producción:**
  - El usuario pidió no separar laboratorio y producción («todavía no salimos a la calle»).
  - Volcado `db-backups/before-demo-stores-*.dump` validado.
  - Ejecutado con la imagen de `e3e3f80` y el script corregido montado en la ejecución (`docker compose run -v`).
  - **Mercur 2.4.1 no usa `options` al crear productos:** las variantes salen de atributos en línea con `is_variant_axis: true`.
  - **Borrar una tienda no borra sus `member` ni sus invitaciones:** la limpieza los elimina aparte.
  - Limpieza probada dos veces antes de la creación final.

## 2026-11-19 — Claude: tiendas de demostración publicadas con fotos reales (pedido del usuario)

- **Fotos:** 25 fotos de dominio público o CC0 (Openverse; preferencia StockSnap y Flickr PDM, solo fotografías y sin marcas visibles) elegidas a mano entre candidatas; 2 productos sin foto adecuada conservan la tarjeta generada. Lista con fuentes en `docs/demo/photo-credits.md`.
- **Modo nuevo `AGESTYLES_DEMO_ACTION=publish`:** aprueba las tiendas, hace visibles las categorías, sube y asigna las fotos (`AGESTYLES_DEMO_PHOTOS_DIR`), confirma los cambios de producto pendientes (`confirmProductChangeWorkflow`, como «Aprobar»), los deja `published` y los vincula al canal de venta.
- **Ejecutado** con volcado previo `db-backups/before-demo-publish-*.dump`.
- **Comprobado:**
  - Store API: 58 productos públicos (31 + 27), 39 con oferta disponible, 6 tiendas y 16 categorías.
  - Capturas reales de Tienda (portada, Categorías → Moda, Tiendas) y Catálogo.
- `cleanup` sigue borrándolo todo.

## 2026-11-19 — Claude: AG-34 portada de la Tienda y logo/portada de tiendas (desplegado)

- **API** (`bc8b037`, `53af16d`): `GET /store/agestyles/catalog` (índice en memoria de 60 s por región y clave, construido con la Store API pública; solo productos con oferta en stock y con precio; filtros q, categorías, tienda, precio y color; orden destacados/novedades/precio; 24 por página, máx. 48), `GET /store/agestyles/home` (banners activos y destacados disponibles) y `GET POST /admin/agestyles/home` (en `metadata.agestyles_home` de la tienda base, sin migración; máx. 8 banners y 24 destacados; imágenes y enlaces solo https).
- **Tienda:** la portada pide el catálogo paginado (scroll infinito, búsqueda con 300 ms de espera, filtros y categorías por id en el servidor). Carrusel (`components/home-carousel.tsx`) con avance automático cada 6 s, flechas y puntos; fila «Destacados» (`components/featured-row.tsx`). Directorio de tiendas con portada y logo; la página de una tienda abre con su portada, logo y descripción.
- **Negocio:** Administración → «Portada de la Tienda» (`app/admin/portada.tsx`: banners con imagen subida a `/admin/uploads`, título, subtítulo, botón, destino categoría/producto/tienda/web, orden y visibilidad; destacados con buscador y orden). «Perfil de la tienda» (`app/store-profile.tsx`): logo, portada y descripción con `POST /vendor/sellers/me` (campos nativos `logo` y `banner` de Mercur; el servidor exige `store:edit`).
- **Gateways:** compradores `GET /store/agestyles/(catalog|home)` y `GET /store/sellers/sel_*`; vendedores `GET POST /vendor/sellers/me`; administración `GET POST /admin/agestyles/home` y `POST /admin/uploads` (8 MB).
- **Despliegue:** volcado `db-backups/before-d97ddbf-*.dump` (1541 entradas), copia de `compose.env` en `env-backups-20261119-0348`. Imagen `ghcr.io/ernestoartime/agestyles-commerce-api@sha256:b2f7eea8…` (de `d97ddbf`); `buyer-gateway` y `seller-gateway` recreados. Webs de Tienda y Negocio publicadas desde `d1fc602`.
- **Contenido:** 5 banners (moda, audio, alimentos, belleza y juguetes), 8 destacados de tiendas distintas y logos (monogramas generados) y portadas para las 5 tiendas de demostración. Fotos CC0 registradas en `docs/demo/photo-credits.md`. La tienda AgeStyles queda sin logo ni portada para que el titular suba los suyos.
- **Comprobado en producción (1440 px):** catálogo 39 productos, primera página 24 y la segunda (offset 24) al hacer scroll; carrusel y «Destacados»; directorio de tiendas; página de Bodega La Esquina con portada y logo. Primera respuesta del catálogo 0,66 s (con índice frío).
- **No comprobado:** la pantalla «Portada» de Negocio en producción (espera la ruta de Cloudflare del gateway de administración, AG-32) y «Perfil de la tienda» con una cuenta de vendedor real. Nueva APK no generada.
- **Codex:** revisar las rutas nuevas y las reglas de los gateways.

## 2026-11-19 — Claude: AG-34 portada propia de cada tienda (desplegado)

- Pedido del usuario: el superadministrador decide el carrusel y los destacados de toda la Tienda, y cada tienda los de su propia página.
- **API** (`2dedff5`): `GET POST /vendor/agestyles/store-home` guarda banners y destacados en `metadata.agestyles_home` del seller (`updateSellersWorkflow` de Mercur). Solo pueden guardar el titular o el rol `role_seller_administration` (mismo criterio que comisiones); solo productos con oferta de esa tienda y sin enlaces a otras tiendas. `GET /store/agestyles/home?seller_id=` devuelve la portada de esa tienda (destacados filtrados a sus productos disponibles).
- **Negocio:** el editor de portada es ahora `components/home-editor.tsx`, común a Administración → «Portada de la Tienda» y a la nueva «Portada de mi tienda» (`app/store-home.tsx`, en el menú «Tienda» y en «Más»).
- **Tienda:** la página de cada tienda muestra portada y logo, su carrusel y su fila «Destacados» encima de sus productos.
- **Despliegue:** volcado `db-backups/before-2dedff5-*.dump` (1541 entradas), copia de `compose.env`; imagen `sha256:1e089adb…`; `seller-gateway` recreado; webs de Tienda y Negocio publicadas desde `2dedff5`.
- **Contenido:** cada tienda de demostración tiene 1 banner (enlace a un producto propio) y 4 destacados, cargados con la cuenta de su titular. Quedan 5 imágenes subidas sin uso (primer intento, repetía la portada).
- **Comprobado en producción:** destacar un producto de otra tienda → 400 «Solo puedes destacar productos de tu tienda.»; escribir con el `x-seller-id` de otra tienda → 403; miembro con rol de inventario → `can_edit=false` y POST 403. Captura de la página de Juguetería Arcoíris y de «Portada de mi tienda» con su titular.
- **Codex:** revisar `store-home` (autorización y validación) y la regla nueva del gateway de vendedores.

## 2026-11-19 — Claude: AG-35 (tienda en la ficha, secciones y solicitudes de categoría) y AG-36 (imágenes y peso de la web), desplegados

- **Ficha de producto** (`109e3f6`): «Vendido por <tienda>» enlaza a la página de la tienda (también en la vista rápida); la ficha completa añade «Más de <tienda>» (carrusel, con «Ver la tienda») y «Artículos relacionados» (mismas categorías, sin repetir los del carrusel), desde `/store/agestyles/catalog`.
- **AG-35** (`3ab23fc`, lockfile `b658bf3`):
  - Mercur 2.4.1 no permite crear ni solicitar categorías (su enlace categoría–tienda solo restringe). Módulo nuevo `packages/category-requests` (tabla `agestyles_category_request`, migración `Migration20261119040000`). La tienda (titular o `role_seller_administration`) solicita en `POST /vendor/agestyles/category-requests` (máx. 10 pendientes, sin nombres repetidos). La administración decide en `POST /admin/agestyles/category-requests/:id`: `approve` (crea con `createProductCategoriesWorkflow`, principal o dentro de `parent_id`), `merge` (categoría existente) o `reject` (motivo obligatorio). Una sola decisión por solicitud.
  - Secciones propias de la tienda (sin aprobación) en `metadata.agestyles_sections` del seller: `GET POST /vendor/agestyles/store-sections` (máx. 20 secciones de 200 productos, solo productos propios). `catalog?seller_id&section` filtra y `home?seller_id` devuelve las secciones con productos disponibles. En la página de la tienda ordenan también por sus destacados.
  - Negocio: «Secciones de mi tienda», «Solicitar categoría», Administración → «Categorías» (selector con la ruta de la categoría).
  - Ojo: el primer commit regeneró el lockfile con pnpm 9 y la CI falló; regenerado con pnpm 10.34.9 (`npx pnpm@10.34.9`).
- **AG-36** (`981ac9a`, `baf0465`, `<script>`):
  - Proveedor de archivos `apps/commerce-api/src/modules/optimized-file`: extiende `LocalFileService` (exportado por `@medusajs/file-local` 2.22.3) y sustituye al local en `medusa-config.ts` (mismo id `local`). Las fotos públicas JPEG/PNG/WebP/AVIF/TIFF se guardan en WebP (≤1600 px, q80, orientadas, sin metadatos), con `__w400.webp` y `__w800.webp`. Si sharp no la lee, se guarda igual que antes. `delete` borra también las variantes. Dependencia `sharp` 0.35.5. Pruebas `test/image-optimizer.test.mjs`.
  - `@agestyles/api-client/media` → `mediaVariant(url, 400|800|1600)`: tarjetas y miniaturas a 400; galería, carrusel y portadas a 800 en móvil y 1600 en escritorio. URL ajenas sin cambios. Aplicado en Tienda y en las listas de Negocio.
  - `scripts/backfill-media-variants.mjs` ejecutado en producción: 264 variantes, 0 fallos; tarjetas de todo el catálogo de 18,3 MB a 0,96 MB. Los originales no se tocan.
  - Iconos: `packages/icons` importaba el índice de lucide (Metro no elimina exportaciones sin usar) y metía ~2.000 iconos (2,3 MB). Ahora se importa `lucide-react[-native]/icons/<archivo>`. Bundle de Tienda de 5,0 a 2,4 MB.
  - **Incidente (~10 min):** una exportación de prueba en el worktree dejó en la caché de Metro el bundle con la URL del laboratorio (`127.0.0.1:19081`), y la Tienda publicada no cargaba. `build-buyer-web.mjs` exporta ahora con `--clear`, como el de Negocio. Republicada y verificada.
- **Despliegue:** volcado `db-backups/before-981ac9a-*.dump` (1541 entradas), copia de `compose.env`; imagen `sha256:b39fe691…` (de `981ac9a`, incluye AG-35); `db:migrate` creó la tabla; gateways de compradores y vendedores recreados; webs publicadas desde `baf0465`/script corregido. Reglas nuevas del gateway de administración sin aplicar (gateway no desplegado, AG-32).
- **Medido en producción (3G lenta simulada: 400 kbit/s, 400 ms):** primeros productos de 20 s a 15 s; JS transferido de 842 a 596 KB; imágenes de la portada móvil 349 KB (16 de 17 son variantes).
- **Comprobado:** subida nueva → WebP + variantes servidas (200, image/webp); variante de foto antigua 200; secciones de Bodega La Esquina visibles en su página; sección con producto ajeno → 400; solicitud de categoría → bandeja de administración → rechazar sin motivo 400 → rechazar 200 → segunda decisión 400 → la tienda ve el estado y la nota.
- **Pendiente / siguiente:** el resto del peso de la web está en `@medusajs/js-sdk` (613 KB de fuente), reanimated + gesture-handler (menú lateral), react-native-web y expo-router. Aviso a la tienda al resolverse su solicitud (necesita un evento nuevo en `packages/notifications`). APK sin regenerar.
- **Codex:** revisar `optimized-file` (rutas de variantes y borrado), las rutas de AG-35 y las reglas nuevas de los gateways.


## 2026-11-19 — Codex: Tienda 1.3.0 y Negocio 1.1.0 (publicado)

- **Versiones Android:** Tienda `1.3.0` / `versionCode 4` (`com.eavlabs.agestyles.buyerlab`); Negocio `1.1.0` / `versionCode 3` (`com.eavlabs.agestyles.businesslab`).
- **Webs:** exportaciones de producción contra `https://agestyles-api.eav-labs.com` (Tienda) y `/negocio` (Negocio); imágenes Docker actualizadas en los contenedores web existentes. `https://tienda.eav-labs.com` y `https://negocio.eav-labs.com` responden 200; `/healthz` local de ambos también responde 200.
- **APK Android ARM64:** Tienda: [`AgeStyles-1.3.0-arm64-v8a.apk`](https://descargas.eav-labs.com/releases/AgeStyles-1.3.0-arm64-v8a.apk), SHA-256 `aa13789127baa46d9c72155d77b787c8b0eb6219a4c3d85478ad1352a88b99a9`, certificado `a58cfbf45b1ab1eac67ebef02c3cfba31830870681f8bf0f81f81c04cd119cba`. Negocio: [`AgeStyles-Negocio-1.1.0-arm64-v8a.apk`](https://descargas.eav-labs.com/releases/AgeStyles-Negocio-1.1.0-arm64-v8a.apk), SHA-256 `f8b00a47110976c81ede4a37f1fb4aa37c846e72c0a3e69baa657fa408199d29`, certificado `96ae756d4d3effe61d2c63109c3eceb7db7d7866d56b512711ffebd3bca33ccb`.
- **Descargas:** portal actualizado con ambas versiones y enlaces a SHA-256. Las cuatro URLs públicas responden 200; los checksums públicos coinciden con los APK locales. Las versiones previas se conservan para rollback.
- **Build:** Tienda compiló correctamente usando ABI ARM64 para mantener bajo el consumo de memoria. Negocio produjo el APK Release verificable; el daemon de Gradle terminó durante tareas finales de lint por presión de memoria, después de generar el artefacto. Se verificaron paquete, versión y certificado con `aapt`/`apksigner`.
## 2026-11-19 — Claude: repaso del tablero y del estado del plan (pedido del usuario)

- **Tablero corregido (filas propias):** AG-31 desplegada (estaba como «sin desplegar»); AG-01 pasa a `bloqueada (decide: usuario)`; AG-16 con el disco actual (12 GB libres, 95 %, tras borrar con permiso del usuario las imágenes de la API `d97ddbf`, `e3e3f80` y `b36e373`).
- **`STATUS_PLAN_MAESTRO.md` desactualizado (corte del 17 nov).** Propuesta para la consolidación de Codex:
  - «Producción hoy»: API `sha256:b39fe691…` (`981ac9a`); 6 tiendas (oficial + 5 de demostración públicas, AG-33), 58 productos (39 disponibles), 30 categorías; fotos nuevas en el volumen del VPS optimizadas a WebP con variantes (AG-36); disco 12 GB libres.
  - F3/F4: catálogo paginado en el servidor, portada con carrusel y destacados, ficha con tienda y relacionados (AG-34/35); Catálogo con vista rápida (AG-30).
  - F5: Tienda dentro de Negocio (AG-31, criterio §14.6 cumplido en código), administración del marketplace en Negocio (AG-32 A/B, sin desplegar: falta la ruta de Cloudflare), portada/secciones/solicitudes de categoría por tienda (AG-34/35), notificaciones (AG-19), comisiones (AG-06 fases 1–4), movimientos (AG-03), CSV (AG-05).
  - F9: AI Studio ya está en producción con «quitar fondo» (AG-27); conviene reflejarlo.
  - Riesgos: quitar «mensajes beta» (AG-07 hecho) y «comisiones sin reglas» (AG-06 desplegado); añadir **imágenes en dos sitios**: AG-09 dice mantener Supabase; AG-26 decidió el bucket `product-images` (falta la clave S3); hoy producción usa el volumen local y la optimización de AG-36 solo actúa en ese proveedor. Si se pasa a S3 hay que aplicar la misma optimización allí.
- **Bloqueos que dependen del usuario:** tasa CUP (AG-01), compra real (AG-11, depende de AG-01), backup externo (AG-02, aplazado), ruta de Cloudflare del gateway de administración (AG-32), clave S3 de Supabase (AG-26), claves de IA (AG-27), SendGrid (AG-19), escritura de SKU (AG-29 b) y familias (AG-28).
- **Codex:** su último commit es del 18 nov (AG-25, que sigue «en curso»). Esperan su revisión: AG-03, AG-06 fases 3–4, AG-19, AG-24, AG-26, AG-27, AG-30 a AG-36 y los gateways de producción.

## 2026-11-19 — Claude: AG-39 (Análisis), AG-40 (avisos por rol) y AG-41 (repaso visual), desplegados

- **AG-39** (`e1e9101`, `81f7da1`, `d84de94`, `78ff604`…): `GET /vendor/agestyles/analytics` y pantalla «Análisis» en Negocio.
  - Contenido: ventas del período frente al anterior, online + en tienda, sin contar dos veces las ventas online de un gestor; ventas por día; más vendidos; sin rotación (60 días); próximos a agotarse (7 días al ritmo de 30); pedidos abiertos por etapa y antigüedad; pagos manuales pendientes; gestores y comisiones solo para titular o administración.
  - El stock se lee de las ofertas (`inventory_item_link`), porque el enlace inventario→variante no devuelve el producto. Comprobado contra la base con un script de solo lectura: AgeStyles 26 uds, 16 ofertas sin stock.
  - La CI falló una vez porque `let agents = null` se tipaba como `null`; corregido.
  - Sin rentabilidad hasta que exista el coste (decisión del usuario).
- **AG-40** (`0581545`, `dd10806`, `20d0e9c`): matriz en `docs/design/AG-40-notificaciones-por-rol.md`.
  - Destinatario `user` y grupo `marketplace`, con la migración `Migration20261119120000` ya aplicada.
  - Avisos nuevos:
    - administración: tienda por aprobar (`seller.created`), producto por revisar (`product-change.created`), comprobante por verificar y solicitud de categoría;
    - tienda: pedido cancelado, pago verificado o rechazado, tienda aprobada o suspendida, solicitud de categoría resuelta;
    - gestor: comisión generada.
  - Bandeja de administración: `GET /admin/agestyles/notifications` y `POST …/read`, pantalla Administración → «Avisos» y ámbito `admin` en el cliente compartido.
  - Probado en producción: solicitud → aviso a la administración (no leídos 0→1) → rechazo → la tienda recibe «Solicitud de categoría no aceptada» con el motivo → marcar leído.
  - De paso: el aviso de stock bajo decía «Default»; ahora usa el nombre del producto.
- **AG-41** (`78ff604` y siguientes):
  - Tienda: los enlaces directos con `?filtro=…` perdían los parámetros en la redirección de `/`; página 404 en español; acceso alineado como el registro; favoritos vacío con «Explorar productos».
  - Negocio: al recargar se perdía la tienda elegida (pantallas con errores en rojo y sin menú). Ahora se recuerda la última tienda o se abre la única. Además, «← Más» común en móvil (`OperationList.backLabel`) y página 404 en español.
  - Catálogo: 404 en español. Ojo: `Dockerfile.runtime` copia una compilación local de `.next`, así que hay que ejecutar `pnpm --filter @agestyles/storefront-web build` antes de `compose up --build`. El Catálogo publicado era de la compilación del 18 nov, 18:41.
- **Despliegue:**
  - Volcados `db-backups/before-dd10806-*` y `before-81f7da1-*`.
  - API `sha256:1c217027…` (de `dd10806`) y `db:migrate` aplicado.
  - Gateways de compradores y vendedores recreados; Tienda, Negocio y Catálogo publicados.
  - Las reglas nuevas del gateway de administración siguen sin aplicar (gateway no desplegado, AG-32).
- **Disco:** con permiso del usuario se borraron las imágenes de la API `981ac9a` y `2dedff5`, y las carpetas `android/` que dejó la compilación de AG-37. Libres: 8,7 GB (96 %).
- **Hallazgo para decidir:** el rol «gestión de pedidos» de Mercur no tiene ningún permiso en `seller-permissions`, ni siquiera ver pedidos. Hay que decidir si equivale a atención al cliente.
- **Pendiente:** unificar el estilo del Catálogo (Next) con la Tienda o decidir si el Catálogo se retira en favor de la Tienda web.
- **Codex:** revisar AG-39, AG-40 (migración, suscriptores y bandeja de administración) y AG-41 (cambio de `business-context` al restaurar la tienda).

## 2026-11-19 — Claude: AG-42 codificadores (categorías, tallas y marcas), desplegado

- **Revisión previa:** `docs/reviews/2026-11-19-codificadores.md`. El catálogo antiguo tenía Administración → Codificadores con Categorías, Subcategorías, Marcas, Tallas por tipo y, con bandera, Familias y Biblioteca de atributos. En 2.0 solo se creaban categorías al aprobar solicitudes.
- **Hecho (`ac57ee3`):**
  - Administración → «Codificadores» (`apps/business-app/app/admin/codificadores.tsx`):
    - Categorías: árbol, crear, editar, mover, ordenar, activar/desactivar y «usa género» (`metadata.uses_gender`). Usa las rutas de Medusa `/admin/product-categories`. El borrado va por `DELETE /admin/agestyles/codifiers/categories/:id` y lo rechaza si hay productos o subcategorías; el listado con recuentos, por `GET …/categories`.
    - Tallas: atributos globales de Mercur con `metadata.agestyles_codifier = "size"` y `size_type`.
    - Marcas: atributo global «Marca» (`agestyles_codifier = "brand"`), con el logo en `metadata.logo_url` del valor.
    - Valores y atributos se desactivan, no se borran: el gateway no deja pasar `DELETE`.
  - Alta de producto en Negocio:
    - La categoría se elige del árbol y se guarda como `categories: [{id}]`; antes era texto que no se guardaba.
    - La marca se elige de la lista cuando existe el atributo.
    - Las tallas forman variantes: `attributes: [{id, value_ids}]` y `options: {[nombre del atributo]: talla}`.
  - Gateways: administración (categorías y atributos) y vendedores (lectura de `/vendor/product-categories` y `/vendor/product-attributes`).
- **Mercur 2.4.1, aprendido:**
  1. Solo un atributo `multi_select` con `is_variant_axis` cuenta como eje de variantes (`workflows/product/workflows/create-products.js`, `hasAxisByIndex`); con `single_select` el producto conserva la opción `__default__` y la variante falla («Product has 1 option values but there were 2»).
  2. No se puede cambiar el `type` de un atributo existente.
  3. Un alta fallida deshace el producto, pero deja filas en `product_attribute_value_link`, y esas filas impiden borrar el atributo.
- **Datos escritos en producción:**
  - 5 tipos de talla del catálogo antiguo (`multi_select`): calzado 5–14 de medio en medio, pullover, camiseta y shorts XS–XXL, pantalón 24–34.
  - Los primeros 5, creados como `single_select`, se borraron. Para poder borrar el de camiseta se marcaron como borradas (`deleted_at`) 9 filas huérfanas de `product_attribute_value_link`, de 3 altas de prueba fallidas cuyo producto ya no existía.
  - Producto de prueba (S/M/L → 3 variantes, opción «Talla de camiseta», categoría «Moda mujer») creado y borrado por la administración.
  - Volcado previo `db-backups/before-ac57ee3-*`.
- **Despliegue:** API de `ac57ee3`, gateway de vendedores recreado, web de Negocio publicada. Borrada la imagen `dd10806`; quedan la actual y la anterior. Libres 8,8 GB.
- **Comprobado:** borrar «Audio» (2 productos) → 400 con mensaje; borrar «Ferretería» (con subcategorías) → 400; el alta muestra el árbol de categorías y las tallas por tipo.
- **Pendiente:**
  - La pantalla de Codificadores necesita el gateway de administración (ruta de Cloudflare `agestyles-api.eav-labs.com/admin-app/`, AG-32).
  - Las marcas están sin activar.
  - Filtros por talla y marca en la Tienda.
  - Biblioteca de atributos, unidades y familias (con AG-28).
- **Codex:** revisar la ruta de borrado, las reglas de los gateways y el cambio del alta de producto.
## 2026-11-19 — Codex: ruta Cloudflare para Administración preparada

- Añadida al túnel compartido la regla `agestyles-api.eav-labs.com`, path `^/admin-app/`, origen `http://127.0.0.1:19188`. Quedó antes de la regla general buyer (`19186`), conservando la ruta seller, media y el catch-all.
- El CNAME proxied de `agestyles-api.eav-labs.com` ya apuntaba al túnel; no se modificó DNS. Snapshot previo y posterior privados en `/home/ernesto/.local/share/cloudflare-tunnel-snapshots/` (modo 600).
- Verificación: configuración remota versión 31 incluye la regla en índice 36 y buyer general queda en 37. El gateway aún no está ejecutándose; la prueba pública `/admin-app/healthz` devuelve 502 hasta que se active el servicio `admin-gateway`.

## 2026-11-19 — Claude: AG-43 filtros de la Tienda por talla y marca, desplegado

- **Cambios (`07b139c`):**
  - El índice del catálogo pide `*product_attribute_values,product_attribute_values.attribute.name` a la Store API (sin esos campos, `attributes` llega vacío) y saca de cada producto:
    - las tallas: atributos «Talla…», de los codificadores de AG-42 o propios del producto;
    - la marca: «Marca»;
    - también los colores definidos como atributo.
  - Filtros `size` y `brand`, y facetas `sizes` (orden de tienda: XS…XXL, luego números) y `brands`, calculadas antes de aplicar color, talla y marca, como ya se hacía con el color.
  - Panel «Filtros»: secciones Talla y Marca; cambiar de categoría las vacía.
  - Pruebas: `test/storefront-catalog.test.mjs`.
- **Comprobado en producción:**
  - API: facetas con tallas S/M/L/XL y 15 marcas; `size=M` → 4 productos; `brand=Malecón` → 4; M + Arcoíris → 0.
  - Navegador: el panel muestra las dos secciones y «Ver 4 productos» al elegir M.
- **Incidente sin corte:** la primera descarga de la imagen se cortó por red, y el guion siguió y escribió una referencia vacía en `compose.env`. El `compose up` falló y la API siguió con la imagen anterior (sana). Restaurado `compose.env` desde la copia del mismo minuto y redesplegado tras descargar con reintentos y comprobar el digest. Imagen en producción: `sha256:ad065b41…`. A partir de ahora el guion valida el digest antes de escribirlo.
- **Pendiente:** activar marcas en los codificadores (AG-42) para que las tiendas reales tengan marca.

## 2026-11-19 — Claude: gateway de administración en producción (AG-32 A/B, y pantallas de AG-34/35/40/42)

- El usuario creó la ruta de Cloudflare `agestyles-api.eav-labs.com/admin-app/` → `127.0.0.1:19188`. Arrancado `admin-gateway` (`docker compose … up -d --no-deps admin-gateway`). La web de Negocio no hubo que recompilarla: deriva la URL del origen de la API.
- **Comprobado por la ruta pública:** sin sesión 401; origen ajeno 403; ruta fuera de la lista (`/admin/api-keys`) 404; preflight CORS desde Negocio 204.
- **Negocio con la cuenta de administración:** Avisos, Codificadores (categorías y tallas), Portada, Solicitudes de categoría, Tiendas, Usuarios, Pedidos y Revisión cargan sin errores ni peticiones en bucle. Hay un único administrador (la cuenta técnica de `admin.env`).
- **Pendiente:** invitar al titular como administrador desde Usuarios (decide el usuario qué correo); activar marcas en Codificadores; revisión de seguridad del gateway por Codex.
- Detalle menor: la bandeja de Avisos de administración usa el subtítulo genérico de la bandeja compartida («Novedades de tus pedidos y de tu cuenta»).

## 2026-11-19 — Claude: titular como administrador y propuesta de migración de usuarios (AG-32)

- **Titular como administrador, sin correo:** con la cuenta técnica se creó la invitación (`POST /admin/invites`). El titular la aceptó con su identidad `emailpass` existente: `POST /auth/user/emailpass` da token sin actor y luego `POST /admin/invites/accept?token=…`. Resultado: `user_01M7THG1TQ2F11GDE373H1EG8J`; `/admin/users/me` 200. En Negocio, el titular entra con su contraseña de siempre y ve su tienda y Administración («Superadministrador»). Credenciales leídas de los archivos privados, sin mostrarlas.
- **Migración de usuarios (fase C):** propuesta en `docs/design/AG-32-fase-C-migracion-usuarios.md`.
  - Importar las cuentas sin contraseña.
  - En el primer acceso, verificar la contraseña contra Supabase Auth y crear la identidad de Medusa con ella.
  - Así no hace falta correo ni contraseñas nuevas.
  - Una consulta agregada con la clave de servidor del catálogo antiguo quedó bloqueada a la espera de la autorización explícita del usuario; no se leyó nada.

## 2026-11-19 — Claude: AG-32 fase C desplegada (cuentas del catálogo antiguo) y Negocio con acceso web y menú en acordeón

- **Autorización del usuario (19 nov):** leer las cuentas del catálogo antiguo (correo, nombre y rol). Los gestores no se asignan a AgeStyles; se hará a mano.
- **Recuento previo (agregado, sin datos personales):** 14 cuentas, todas con correo confirmado, 8 han entrado alguna vez; perfiles: 7 `admin`, 6 `gestor_venta`, 1 `user`; 7 pedidos, 8 líneas, 3 favoritos.
- **Despliegue (`8c409be`, API `sha256:ad06631e…`):**
  - Copia previa `env-backups-<fecha>/api.env.before-legacy-login` y volcado `before-8c409be-*`.
  - `api.env` incluye ahora `AGESTYLES_LEGACY_SUPABASE_URL` y `AGESTYLES_LEGACY_SUPABASE_ANON_KEY`, la clave pública del catálogo antiguo.
  - La clave de servidor solo se pasó al contenedor durante la importación (`docker compose run -e`); no se guardó.
  - `buyer-gateway` recreado; Tienda y Negocio publicadas.
- **Importación:** `scripts/legacy-users-import.ts`, primero en modo prueba y luego de verdad. 14 clientes nuevos, `has_account=false`, con `metadata.legacy_user_id`, `legacy_role` y `legacy_imported_at`. Los roles antiguos no dan ningún permiso.
- **Comprobado:**
  - `POST /store/agestyles/legacy-login` por la ruta pública con un correo inexistente → `{migrated:false}`.
  - Con una cuenta importada y contraseña errónea → `{migrated:false}` y 0 identidades creadas.
  - **No comprobado:** el camino correcto, que necesita la contraseña real de alguna de las cuentas antiguas.
- **Negocio (`420d339`, `24d081b`):**
  - Acceso con diseño web en navegador ancho (`components/auth-frame.tsx`, también en la recuperación de contraseña), sin el margen superior de la app en la web móvil.
  - Menú lateral en acordeón: «<tienda>» y «Administración del marketplace»; al abrir uno se pliega el otro.
- **Pendiente:** el correo personal del usuario figura entre las cuentas importadas con rol antiguo `admin`. Tras su primer acceso en la Tienda se le puede dar la administración (y, si quiere, la tienda) enlazando su identidad desde el servidor.

## 2026-11-19 — Claude: AG-44 (mantenimiento, contraseñas visibles, destacados en lista), desplegado

- **Mantenimiento:**
  - `lib/maintenance.ts`, guardado en `metadata.agestyles_maintenance` de la tienda base.
  - Rutas: `GET/POST /admin/agestyles/maintenance`, `GET /store/agestyles/maintenance` y `GET /agestyles/maintenance` (sin clave publicable, solo `enabled`, para el gateway).
  - Negocio → Administración → «Mantenimiento»: estado, activar/desactivar, título, mensaje y «Volvemos…» con vista previa.
  - Tienda: `components/maintenance-gate.tsx` muestra la página a pantalla completa. Dentro de Negocio solo pone un aviso, porque `buyerExit()` existe.
  - Catálogo: el layout muestra la página (ISR de 5 min).
  - `buyer-lab-gateway.mjs` consulta el estado cada 15 s y responde 503 a escrituras en `/store/carts`, `/store/payment-collections` y `/store/order-quotes`.
- **Contraseñas:** `FormField` (Tienda), `AuthInput` y el acceso de Negocio (`components/password-input.tsx`) con botón mostrar/ocultar.
- **Destacados:** `home-editor.tsx` muestra la lista de productos con foto para pulsar y destacar, filtrable y con «Ver más». Sirve para la portada general y la de cada tienda.
- **Despliegue:** API `sha256:83375ae5…` (`d22ee8e`), volcado previo, gateways de compradores y administración recreados, Tienda, Negocio y Catálogo publicados.
- **Prueba real:** activado → Tienda con la página de mantenimiento y `POST /store/carts` 503; desactivado → 200 (queda un carrito vacío de prueba).
- **Sobre el aviso del usuario («2 peticiones con 401 y la contraseña en texto plano»):**
  - Los dos 401 son el comportamiento esperado: Negocio prueba `member` y `user` con las mismas credenciales, y su correo personal aún no es cuenta de equipo ni de administración.
  - La contraseña viaja por HTTPS: TLS 1.3, AES-256-GCM, y HTTP redirige 301 a HTTPS. DevTools la muestra antes del cifrado.
  - Recomendación al usuario: activar HSTS en Cloudflare.

## 2026-11-19 22:10 · Claude · AG-32 fase C: login de la Tienda con carrito y primera cuenta administradora

- Fallo: la Tienda mostraba «No se pudo iniciar sesión» aunque el login (y la migración desde el catálogo antiguo) daban 200. El cliente vinculaba el carrito invitado con `POST /store/carts/:id/transfer`, ruta que no existe en Medusa 2.22.3 ni en Mercur 2.4.1 (la correcta es `/store/carts/:id/customer`, ya permitida por el buyer-gateway), y ese error tumbaba el login.
- Cambios: `packages/api-client/src/store.ts` usa `/customer`; `customer-context.tsx` trata el vínculo del carrito como «mejor esfuerzo» en login y registro; test de `features-buyer` actualizado (pasa).
- Producción (autorizado por el usuario): copia `before-promote-admin-20261119-2204.dump`; `legacy-promote-admin.ts` (montado, prueba en seco y luego real) dio administración a la cuenta antigua de administrador recién migrada → usuario `user_01M7TT27KFHZK41G4JM3J7NJCZ`. Tienda y Negocio republicadas.
- Revisión cruzada pendiente (Codex): ruta de vínculo del carrito y alta de administrador.

## 2026-11-19 22:30 · Claude · AG-32: cuenta del titular en el equipo de AgeStyles

- Nuevo `apps/commerce-api/src/scripts/add-store-member.ts`: añade una identidad existente al equipo de una tienda con los flujos de Mercur `createMemberInvitesWorkflow` + `acceptMemberInviteWorkflow` (sin contraseña nueva; imprime solo ids).
- Producción (autorizado por el usuario): copia `before-store-member-*.dump`; prueba en seco y luego real → miembro `mem_01M7TVWPVKKWTE4Z45E648SGDQ` en `sel_01M7NH1254S7Z1HZ7YQTJT39N7` con `role_seller_administration`. La identidad conserva `user_id` y `customer_id`.

## 2026-11-19 23:00 · Claude · AG-45: Usuarios del superadmin con acciones y permisos

- API `GET/POST /admin/agestyles/people` (`src/lib/people.ts` + ruta; test `test/people.test.mjs`): lista única de personas (clientes, administradores y miembros de tienda unidos por correo, con `has_password` y `legacy_role`) y acciones `grant_admin` (`createUserAccountWorkflow`), `revoke_admin` (`removeUserAccountWorkflow`; ni a uno mismo ni al último), `add_to_store` (`addSellerMemberWorkflow` si ya es miembro; si no, invitación + aceptación de Mercur con su identidad), `change_role` (`updateMemberRoleWorkflow`) y `remove_from_store` (`removeSellerMemberWorkflow`); el propietario no se toca. Sin contraseña → 409 con mensaje en español.
- `admin-gateway.mjs`: `GET POST /admin/agestyles/people`.
- Negocio → Administración → Usuarios rehecha: filtros (todas, administradores, equipos, clientes, catálogo antiguo), cada persona se abre con sus permisos y acciones (confirmación en las destructivas); se mantiene invitar administrador e invitaciones pendientes.
- Revisión cruzada pendiente (Codex): reglas de autorización de las acciones.

## 2026-11-19 23:40 · Claude · AG-46: Mi cuenta web, direcciones de entrega y menú de usuario

- `packages/buyer-experience`: `lib/addresses.ts` (`useSavedAddresses` sobre `sdk.store.customer.*Address`, conversiones y `isSaved`), `customer-context` gana `updateProfile` (POST `/store/customers/me`), `account/index.tsx` rehecha (en web ancha: menú lateral con identidad + contenido; secciones `?seccion=datos|direcciones`; compras recientes con `components/account/order-group-row.tsx` extraído de Mis compras), cabecera de app oculta en web ancha, `web-top-bar.tsx` con menú de usuario (iniciales, nombre, desplegable con cuenta, compras, direcciones, favoritos, avisos y cerrar sesión), checkout con direcciones guardadas para elegir, autorrelleno con la principal y «Guardar esta dirección en mi cuenta» (mejor esfuerzo).
- `buyer-lab-gateway.mjs`: `GET POST /store/customers/me`, `GET POST /store/customers/me/addresses`, `POST DELETE /store/customers/me/addresses/caddr_*`.
- Comprobado: typecheck de buyer-experience, lint del monorepo (0 errores), prettier.

## 2026-11-20 · Claude · AG-47: APK Tienda 1.4.0 y Negocio 1.2.0 (publicadas, pedido del usuario)

- **Versiones** (`5764d9f`): Tienda `1.4.0` / `versionCode 5`; Negocio `1.2.0` / `versionCode 4`. Incluyen AG-44, AG-45, AG-46 y el arreglo del vínculo del carrito.
- **APK ARM64:** Tienda `AgeStyles-1.4.0-arm64-v8a.apk`, SHA-256 `605e7f862b0b0eeba2518ce9703e16974bf766fa91fa433a60fbe56122312031`, certificado `a58cfbf4…`. Negocio `AgeStyles-Negocio-1.2.0-arm64-v8a.apk`, SHA-256 `02caf91d999eee89fb386302dc11884c56de3945076a091e524736f651de4c3b`, certificado `96ae756d…`. Ambas se instalan encima de las anteriores.
- **Compilación:** mismo método (bundle con `expo export:embed` en Node, `cliFile` → `copy-cli.js`, Gradle `--max-workers=1`, `-Xmx1536m`, Kotlin en proceso, solo arm64). Ojo: `expo prebuild` genera **dos** `cliFile` en `android/app/build.gradle`; hay que sustituir el de Expo (`new File(["node", …])`), no añadir otro antes. Bundles comprobados: URLs de producción (Negocio con `/negocio` y `/admin-app`) y sin `127.0.0.1`.
- **Descargas:** `docker cp` de APK y `.sha256` a `utilitaria-downloads`; tarjetas actualizadas (copia del índice anterior en `~/.local/share/agestyles-deploy/apks/index.before-140.html`). 200 y checksums públicos = locales. Se conservan 1.3.0/1.1.0 (y 1.2.0/1.0.1) en `releases/`.
- **Tienda web:** `BUYER_WEB_ANDROID_APK_URL` a la 1.4.0 (copia previa en `env-backups-20261120/env.buyer-web.before-140`), republicada.
- **Disco:** con permiso del usuario se borraron las imágenes de la API `8c409be` y `ac57ee3` (se conservan `7e5fd4c` en uso y `d22ee8e`); carpetas `android/` generadas borradas al terminar.

## 2026-11-20 · Claude · AG-48: esqueletos de carga y plantilla común de Negocio

- `packages/ui-native/src/skeleton.tsx` (nuevo, exportado): `SkeletonBlock` (pulso con `Animated`, color `border` del tema), `SkeletonRows`, `SkeletonCards`, `SkeletonStats`. Contenedor con `accessibilityLabel="Cargando"`.
- `apps/business-app/components/operation-list.tsx`: prop `skeleton` (`rows` por defecto, `cards`, `stats`). En la primera carga muestra el esqueleto y oculta el contenido, para que una sección ya visible no diga «No hay…» antes de tener datos. Las recargas siguen mostrando el contenido con el indicador de arrastre.
- `app/analytics.tsx` y `app/commissions.tsx`: `skeleton="stats"`.
- Comprobado: `tsc` sin errores nuevos (los 26 de rutas tipadas ya existían), `eslint` sin errores, prettier, y `build-business-web.mjs` exporta.
- **No hecho:** repaso visual pantalla a pantalla en ancho web y móvil (sin navegador de prueba aquí), ni cambios de diseño de cada pantalla. No desplegado.
- **No tocado a propósito:** `app/(tabs)/index.tsx` (AG-25 de Codex, en curso).
- Observación: los nombres de la pestaña móvil y del menú lateral difieren («Revisión» / «Productos en revisión», «Pedidos» / «Pedidos del marketplace», «Solicitudes» / «Solicitudes de categoría»). Unificar en una pasada posterior.

## 2026-11-20 · Claude · AG-48 (2.ª parte): repaso visual con capturas

- **Método:** web de Negocio ya exportada (`build-business-web.mjs`) servida en local y navegador Chromium (Playwright 1.64) con las llamadas a la API interceptadas y **datos inventados**; nada toca producción ni usa credenciales. Capturas a 1440×900 y 390×844, tema claro y oscuro, y con respuestas retrasadas para ver los esqueletos. La Tienda se revisó dentro de Negocio (`/tienda`), que monta el mismo código.
- **Pantallas revisadas:** Administración (Avisos, Usuarios, Tiendas, Pedidos, Revisión, Portada, Codificadores, Solicitudes, Mantenimiento), gestión de tienda (Productos, Pedidos, Inventario, Equipo, Más, Perfil) y cuenta de la Tienda (Resumen, Datos, Direcciones, Mis compras).
- **Corregido:**
  - Usuarios: en móvil la flecha de abrir saltaba de línea; ahora etiquetas debajo y flecha fija. Buscador antes que filtros, como en Tiendas y Pedidos.
  - Tiendas (móvil): el nombre se cortaba por la etiqueta «Pendiente de aprobación»; ahora la etiqueta baja de línea.
  - Equipo (ancho): formulario de invitación y miembros en dos columnas, ya no a 1000 px.
  - Avisos (ancho): sin «Volver» redundante (`ScreenFrame`) y título alineado con el resto.
  - Menú lateral: «Administración» en lugar de «Administración del mar…».
  - `OperationList`: espacio bajo el cuadro de error.
  - `AdminGate`: esqueleto mientras se comprueba la sesión (antes pantalla en blanco).
  - Esqueletos: color del borde del tema (en oscuro casi no se veían).
  - Cuenta de la Tienda: esqueletos en cuenta, resumen, direcciones y Mis compras; campo de correo atenuado (no editable).
- **No es un fallo (comprobado):** la lista del menú lateral de la tienda parece cortada pero se desplaza.
- **No cubierto:** Análisis, Comisiones, Movimientos, Secciones, Importar, Producto nuevo y Portada con datos reales (sin datos simulados completos); el panel de inicio (AG-25 de Codex); notificaciones de la Tienda (indicador clásico). Formato de importes de la Tienda en `en-US` (`$8,400.00`) en lugar de `es-ES`: pendiente de decidir.
- **Comprobado:** `tsc` (buyer-experience y ui-native sin errores; Negocio con los 26 de rutas tipadas anteriores), eslint 0 errores, prettier. No desplegado.


## Codex · AG-16, AG-49 y preparación de AG-11

- `df -h /`: 3,6 GB libres, 99 % usado. `docker system df`: 29,5 GB potencialmente recuperables en imágenes, 3,5 GB en volúmenes y 1,356 GB de caché de build. Estos totales incluyen otros proyectos y no son una lista de borrado.
- `du -xhd1`: candidatos acotados a los subdirectorios generados de `/tmp/agestyles-react-types-alignment` (`.next` 397 MiB y `node_modules` 680 MiB) y `/tmp/agestyles-release-artifact-cad60d5` (`.next` 359 MiB y `node_modules` 416 MiB). No se observaron referencias a esas rutas en los procesos accesibles. El primer directorio tiene cambios en su copia de Git; conservar los árboles y limitar cualquier limpieza a esos cuatro subdirectorios previa autorización. No se borraron archivos.
- AG-49: `3760651` descarta resultados de otra sesión y de cargas anteriores. Mi cuenta distingue error y lista vacía, permite reintentar y reinicia el formulario al cambiar de cliente. El checkout sigue admitiendo direcciones manuales si falla la libreta. Pasaron el typecheck de buyer-experience, ESLint y Prettier de los archivos modificados. Pendientes la revisión cruzada, una prueba con sesión y el despliegue.
- AG-11: el tablero detalla el recorrido de compra con dos vendedores, pago, stock por tienda y seguimiento. La comprobación CUP queda ligada a AG-01. El piloto en producción requiere acordar el pago y autorizar la escritura de pedidos de prueba.

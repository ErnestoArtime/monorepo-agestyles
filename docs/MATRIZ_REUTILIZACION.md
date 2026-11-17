# Matriz de reutilización: Agestyles-Catalogo → AgeStyles 2.0

**Fecha:** 17 de noviembre de 2026
**Estado:** propuesta de trabajo para revisión; no autoriza código ni migraciones por sí sola
**Última reconciliación:** 17/11/2026 00:58 — ver §9 (trabajo en curso en `commerce-api` y `packages/`)
**Documento rector:** [AGESTYLES_2_0_PLAN_MAESTRO.md](./AGESTYLES_2_0_PLAN_MAESTRO.md) (§1, §4, §8, §15)
**Regla de protección:** AgeStyles actual y Supabase permanecen intactos. Nada de esta matriz se ejecuta contra producción.

## Versión corta (lo que hay que recordar)

- **Mercur ya resuelve** vendedores, ofertas, pedidos agrupados, comisiones, medios, atributos y permisos. No se reescribe nada de eso.
- **Agestyles-Catalogo aporta** lo que Mercur no tiene: comparador, familias/unidades, cotización-primero, flujo de publicación y la experiencia Modern Luxury.
- **No se porta** nada de Supabase: migraciones, RLS, rutas `/api`, Auth ni el worker propio.
- Se porta **por rebanada vertical** (tipo + consulta + UI + test), no por carpeta.
- Cuatro lotes: contratos → vitrina → operación de tienda → dinero/postventa.
- La matriz completa es un anexo de decisiones; para trabajar, el documento operativo es el ticket del lote en curso.

## 0. Para qué sirve

Convertir «traer gran parte de Agestyles-Catalogo» en una lista explícita de qué se trae, cómo y dónde vive. Cada fila se decide **antes** de escribir código y se cierra con evidencia. La matriz evita dos errores simétricos: reimplementar lo que Mercur ya resuelve y copiar código que arrastra Supabase al nuevo dominio.

### Vocabulario de decisión

| Decisión | Significado | Implica |
|---|---|---|
| **USAR** | Mercur/Medusa/upstream ya lo resuelve | Dependencia con versión fijada, configuración o extensión soportada. Cero copia de código upstream. |
| **ADAPTAR** | Hay valor probado en Catalogo, pero acoplado a Next/Supabase | Portar contrato, regla, fixture y test a `packages/*`; reescribir la capa de datos contra `@agestyles/api-client`. |
| **CONSTRUIR** | Brecha real de AgeStyles sin equivalencia upstream | Paquete/módulo propio, documentado, con punto de extensión registrado en `commerce-api`. |
| **DESCARTAR** | No se trae | Se conserva solo como referencia de comportamiento en el repositorio fuente. |

### Límites que ninguna fila puede violar

1. Sin fork de Medusa/Mercur, sin parchear `node_modules`, sin vendorizar el monorepo upstream.
2. Un solo escritor del dominio comercial: PostgreSQL de Medusa. Ninguna ruta nueva lee o escribe Supabase.
3. Autorización de tienda/rol siempre en servidor. Ocultar UI no cuenta.
4. Dinero, stock y estados de pedido no se duplican en clientes ni en «utilidades» de conveniencia.

## 1. Base verificada (corte 17/11/2026)

| Elemento | Estado comprobado |
|---|---|
| `commerce-api` | Medusa 2.22.3 + Mercur 2.4.1 (`@mercurjs/core`), módulo propio `seller-permissions`, rutas `store` de cotización y scripts de verificación de roles, identidad dual y cotizaciones. El módulo `@agestyles/quotations` vive en `packages/quotations` |
| Mercur 2.4.1 aporta | Módulos `seller`, `offer`, `product-attribute`, `product-edit`, `media`, `commission`, `payout`, `review`, `custom-fields`, `promotion-cost`, `admin-ui`, `vendor-ui`; workflows y links de `order-group` y split de pedidos; API `store`/`vendor`/`admin`; registro de permisos |
| Mercur **no** aporta | Workflows genéricos de cotización (AgeStyles ya tiene módulo propio `order-quotes`), comprobantes de pago manual, PIM de familias/unidades AgeStyles, organización multi-tienda consolidada |
| `storefront-web` | Next 16, SSR, búsqueda, filtros, comparación, metadata, sitemap |
| `buyer-app` / `business-app` | Expo SDK 54; carrito mixto y pedidos agrupados probados en laboratorio |
| `packages/` | `domain` (`buyer-orders`, `catalog`, `order-quotes` y fixture de dos ofertas), `api-client` (products, ofertas proyectadas, cotizaciones y buyer-orders), `icons`, `design-tokens` |
| Falta en `packages/` | `auth`, `config`, `ui-native`, `ui-web`, `features-buyer`, `features-business`, `validation`, `commerce-rules`, `testing` |
| `Agestyles-Catalogo` | 104 archivos en `src/components`, 120 en `src/lib`, 291 en `tests`, 81 migraciones SQL, 33 productos y 7 pedidos reales en Supabase |
| Restricción operativa | 4.8 GiB libres en disco (98% usado): los portes no deben duplicar `node_modules` ni builds pesados |

## 2. Matriz por capacidad

### 2.1 Identidad, organización y permisos

| Capacidad | En Catalogo | Cobertura upstream | Brecha | Decisión / destino |
|---|---|---|---|---|
| Login de comprador | Supabase Auth + `profiles` + middleware | Medusa auth `customer` | Ninguna funcional | **USAR**. Solo migrar identidades en F6. |
| Login de gestor/equipo | Roles internos, invitaciones, `panelAccessCookie` | Mercur `seller` members + registro de permisos | Matriz de roles AgeStyles y sesión | **ADAPTAR** conceptos → `packages/auth`; validar en F1/F5 |
| Persona con doble rol (compra y gestiona) | No existía | Una identidad emailpass puede enlazarse a `customer` y `member` aceptando invitación; cada actor recibe JWT separado | Gestión de ambos tokens y cambio de modo dentro de las apps | **USAR** el flujo soportado de Medusa/Mercur; **ADAPTAR** almacenamiento/sesiones en `packages/auth`. F1 API validado; F5 app-level pendiente (ADR-002) |
| Organización → tienda → ubicación | Solo propuesta (`MULTITIENDA-PROPUESTA`), 0 filas reales | `seller` + `stock_location` | Organización y visión consolidada | **CONSTRUIR** `packages/organizations` solo si F1 confirma necesidad de consolidado legal/fiscal; si no, basta la membresía de Mercur (criterio de la capability matrix) |
| Autorización por recurso y tienda | RLS + comprobaciones en rutas | Mercur permissions + `seller-permissions` propio | Ninguna, pero falta matriz completa | **ADAPTAR** pruebas BOLA/IDOR de Catalogo a la suite del API |

### 2.2 Catálogo y PIM

| Capacidad | En Catalogo | Cobertura upstream | Brecha | Decisión / destino |
|---|---|---|---|---|
| Catálogo maestro, categorías, marcas | Tablas, admin, nomencladores | Medusa product/categoría/colección; Mercur `product-edit` | Nomencladores y campos propios | **USAR** el núcleo; **ADAPTAR** taxonomía a `packages/domain` |
| Familias, atributos, unidades, tipologías | `catalogFamilies`, librería de atributos, `resolveAttributeDefinition`, `ropa*`, `tenis*` | Mercur `product-attribute`: tipos `single_select`/`multi_select`/**`unit`**/`toggle`/`text`, obligatorio, filtrable, eje de variante, global o por producto y vínculo a categoría | **Familias/versiones y metadatos de comparación** (la unidad ya existe) | **ADAPTAR hecho (v1):** `packages/catalog-pim` aporta familia/versión y comparación; atributos y valores siguen en Mercur. Ver [ADR-004](./adr/ADR-004-catalog-family-versioning.md) y `docs/tickets/LOTE-2-PIM.md` |
| Variantes comerciales, SKU, precio, moneda | `commercialVariants`, `productCurrency`, `exchangeRate`, editor | Medusa variants + pricing; Mercur `offer` | Reglas de conversión y campos comerciales | **ADAPTAR** contrato y tests; no portar la implementación |
| Oferta por vendedor | No existía (0 comercios) | Mercur `offer` completo | Ninguna | **USAR** |
| Publicación con revisión | Estados, campos de publicación, validación de familia | Mercur `product-edit` con ciclo `PENDING` → `CONFIRMED` / `DECLINED` / `CANCELED` | Mapeo de estados AgeStyles y quién aprueba | **ADAPTAR** la máquina de estados; no construir moderación nueva |
| Medios e imágenes | Cropper, subida acotada, orden, hash, borrador | Mercur `media`; storage S3-compatible | Recorte, orden y flujo de aprobación | **ADAPTAR** componentes de edición; **USAR** almacenamiento |

### 2.3 Inventario, pedidos y dinero

| Capacidad | En Catalogo | Cobertura upstream | Brecha | Decisión / destino |
|---|---|---|---|---|
| Stock y ubicaciones | Inventario por tienda, disponibilidad | Medusa inventory + `stock_location` | Ninguna | **USAR** |
| Movimientos y reservas | Movimientos, reservas, monitor, vencimientos, worker | Medusa reservations; verificar historial de negocio | Historial legible por el vendedor y reglas de vencimiento | **ADAPTAR** vistas y reglas → `packages/features-business` |
| Carrito multi-vendedor | Carrito propio | Medusa cart + Mercur split | Ninguna | **USAR** |
| Pedido agrupado y pedidos por vendedor | Pedidos por tienda, historial | Mercur `order-group` + split (probado en laboratorio) | Ninguna estructural | **USAR**; **ADAPTAR** mapeo de estados y textos |
| Cotización → aceptación → pedido | Flujo completo e idempotente | Módulo propio `@agestyles/quotations` (antes `order-quotes`) ya registrado en `commerce-api`, con migraciones, rutas `store` de crear/aceptar y verificación de expiración. Contrato y cliente ya expuestos en `@agestyles/domain/order-quotes` y `@agestyles/api-client/order-quotes` | Verificación end-to-end contra el pedido agrupado | **ADAPTAR** el contrato legado a los tipos existentes; el módulo ya existe, no duplicarlo |
| Pagos manuales y comprobantes | Pagos manuales, comprobantes privados | Medusa payments; Mercur `payout` | Comprobante y conciliación manual | **CONSTRUIR hecho (v1):** `@agestyles/manual-payments` con ciclo pending→verified/rejected, índice único de un pendiente por pedido y conciliación al verificar (ADR-005) |
| Devoluciones y comisiones | Devoluciones parciales, comisiones, reportes | Medusa returns; Mercur `commission`/`payout` | Reglas y reportes AgeStyles | **USAR** motor; **ADAPTAR** reportes |
| Seguimiento por línea y notificaciones | `CustomerOrderLineTracking`, historial, worker, WhatsApp | Fulfillment + event bus/Redis | Plantillas, outbox y canal | **ADAPTAR** a subscribers/outbox; sin worker paralelo |

### 2.4 Experiencia y operación

| Capacidad | En Catalogo | Cobertura upstream | Brecha | Decisión / destino |
|---|---|---|---|---|
| Listado, búsqueda, filtros y facetas | `CatalogListing`, `FilterSidebar`, `catalogSearch`, búsqueda servidor | Store API + storefront Mercur | Facetas y ranking propios | **ADAPTAR** lógica a `api-client`; UI web ya existe en `storefront-web` |
| Ficha y especificaciones | `ProductCard`, `ProductSpecifications`, tipologías | Store API | Presentación AgeStyles | **ADAPTAR** a `features-buyer` (web/native por separado) |
| Comparador multi-vendedor | `CatalogComparisonTray`, `catalogComparison` | No existe | Todo | **ADAPTAR** (es diferenciador propio, no reinventar: ya está resuelto) |
| Tienda pública / escaparate | `StoreCard`, `StorePageShell`, navegación | Mercur storefront seller pages | Rutas y SEO propios | **ADAPTAR**; `/tiendas` y `/tiendas/[handle]` ya publicadas en `storefront-web` |
| Panel de negocio | `/mi-negocio`: productos, pedidos, inventario, miembros | Mercur `vendor-ui` | Pantallas AgeStyles y permisos finos | **ADAPTAR** a extensiones del dashboard o `business-app`; spike de slots |
| Panel global admin | `/admin` | Mercur `admin-ui` + Medusa admin | Operación AgeStyles | **ADAPTAR** extensiones; **no** crear `admin-web` en MVP |
| Ventas y reportes | Reportes, comisiones, gestores | Mercur commission/payout | Reportes de negocio | **ADAPTAR** en fase posterior |
| CSV y edición masiva | Import/export/update CSV, bulk edit | Import/export parcial de Medusa | Mapeo y validación AgeStyles | **ADAPTAR** después de F3 |
| Diseño, tema e iconos | `DESIGN.md`, paleta grafito/azul, tema claro/oscuro | N/A | Tokens compartidos | **ADAPTAR** → `@agestyles/design-tokens` ya creado y consumido por buyer, business y storefront; `@agestyles/icons` ya cubierto. Queda migrar paneles/admin y componentes restantes a los tokens. |
| SEO | Metadata, canonical, sitemap, datos estructurados | Storefront Mercur | URLs y contenido propios | **ADAPTAR** a `storefront-web`; preservar URLs con redirecciones |
| IA de producto | Ruta admin de IA (sin seguimiento en git) | No existe | Todo | **DESCARTAR por ahora**; reevaluar en F9 |

## 3. Lotes de port recomendados

El port va por **rebanada vertical**, no por carpeta: cada lote entra completo (tipo + consulta + UI web/nativa + prueba) y se puede revertir solo.

### Lote 0 — Contratos, sin UI (habilita todo lo demás) — **v1 completado**

- `packages/domain` v1 **hecho**: producto, oferta y variante (`catalog.ts`, `fixtures/offers.ts`); pedido y cotización se añaden cuando exista un consumidor.
- `packages/api-client` v1 **hecho**: `toProductOffer` y `listProductOffers` (`@agestyles/api-client/offers`).
- `packages/validation` y `packages/commerce-rules`: quedan para cuando exista un consumidor real que valide o calcule.
- **Criterio:** typecheck de `domain` y `api-client` en verde; fixture con dos ofertas del mismo producto.

### Lote 1 — Vitrina

- **Web y nativo cubiertos** funcionalmente: comparación/selector por vendedor en ambas fichas.
- **Consolidación parcial:** la ficha nativa ya usa `listProductOffers` y `listOffers` quedó deprecada; falta migrar `storefront-web` (ver `docs/tickets/LOTE-1-VITRINA.md`).
- Comparador de 2–4 productos con especificaciones: depende del modelo de familias (Lote 2).
- **Destino final:** `features-buyer` + `ui-web`/`ui-native` cuando web y nativo compartan el mismo árbol; la v1 no crea paquete nuevo.
- **Criterio:** un producto con dos ofertas se compara en web y Android contra el mismo API; ninguna consulta directa a Supabase.

### Lote 2 — Operación de tienda

- Variantes comerciales, familias/atributos, imágenes, publicación.
- **PIM v1 completado en servidor y contratos (17/11/2026):** familia/versión, validación, migración generada, API admin/store, comparación version-scoped y verificadores de laboratorio. Atributos y valores salen de Mercur, no se duplican. Ver `docs/tickets/LOTE-2-PIM.md` y [ADR-004](./adr/ADR-004-catalog-family-versioning.md).
- **Pendiente del lote:** asociar producto → versión publicada, comparador 2–4 productos en web/nativo, pantalla de administración y mapeo del ciclo de publicación de Mercur.
- **Destino:** `catalog-pim` (servidor) + `features-business` + extensiones de `vendor-ui`.
- **Criterio:** owner edita A1/A2; viewer recibe 403 al intentar escribir; la aprobación ocurre en servidor.

### Lote 3 — Dinero y postventa

- Cotización, comprobantes manuales, tracking por línea, notificaciones, reportes.
- **Destino:** `quotations`, adaptador de pagos manuales, outbox/subscribers, reportes.
- **Criterio:** aceptación idempotente probada con reintento y timeout; ningún evento duplicado crea dos pedidos.

## 4. Lista negra explícita (no se trae)

| Elemento | Motivo |
|---|---|
| 81 migraciones SQL y políticas RLS | El esquema nuevo nace de migraciones de Medusa/Mercur; importarlas crea un dominio paralelo |
| Funciones `SECURITY DEFINER` y RPC | Superficie de seguridad no auditable en el nuevo modelo |
| Rutas `src/app/api/*` de Next | Reimplementan el backend; su lugar es `commerce-api` |
| Supabase Auth como proveedor | El plan exige un proveedor único (F1/ADR auth) |
| Lógica de stock/dinero duplicada en `src/lib` | Se sustituye por workflows de Medusa |
| Paneles `admin`/`mi-negocio` como aplicaciones nuevas | Mercur ya expone dashboards extensibles |
| Worker/systemd propio de reservas y notificaciones | Se integra en event bus/subscribers existentes |
| Componentes DOM compartidos con React Native | Solo se comparte lógica, DTO y esquemas |

## 5. Preguntas abiertas que condicionan filas

Se cierran en F1 y bloquean el lote indicado:

| # | Pregunta | Bloquea | Evidencia necesaria |
|---|---|---|---|
| 1 | ¿`product-attribute` + `custom-fields` de Mercur 2.4.1 cubren familias, unidades y obligatoriedad, o hace falta `catalog-pim`? | Lote 2 | **Resuelta (17/11/2026):** Mercur cubre atributos, valores, unidades, obligatoriedad, filtrabilidad y eje de variante. AgeStyles construye solo familia/versión y metadatos de comparación en `packages/catalog-pim` (ADR-004), sin duplicar el diccionario |
| 2 | ¿Los slots de `vendor-ui` permiten pantallas propias sin fork? | Lote 2 | Prueba de una pantalla AgeStyles en el dashboard |
| 3 | ¿La API de `order-group` es estable para crear pedido desde cotización aceptada? | Lote 3 | Validado en laboratorio: una quote para cart A2+B2 usa `completeCartWithSplitOrdersWorkflow`, produce un order group y dos child orders; cada vendedor solo lee el suyo. Cinco aceptaciones concurrentes más retries convergen en el mismo group/child IDs. Falta visualización de ese grupo en la UI comprador y conteo independiente en DB |
| 4 | ¿Existe soporte nativo de reservas con vencimiento o se adapta el worker actual? | Lote 3 | La cotización caducada se rechazó en el laboratorio; todavía no se probó reserva ni liberación de stock |
| 5 | ¿`seller-permissions` propio se mantiene o se sustituye por el registro de Mercur? | F5 | Parcial: 100 checks en cuatro sellers confirman aislamiento/roles; documentar el límite exacto entre permisos nativos y los checks propios antes de retirar el módulo |
| 6 | ¿La identidad dual comprador/vendedor se resuelve con el proveedor de Mercur? | F5 | API validada: identidad única, invitación y tokens actor-scoped con 401 cruzado. Pendiente app-level: conservar ambos tokens, cambiar modo, logout/refresh y revocación (ADR-002) |
| 7 | ¿Se conserva el flujo de publicación de Catalogo o el de Mercur? | Lote 2 | **Resuelta (17/11/2026):** se conserva el vocabulario heredado (`draft`/`published`/`archived`) como vista derivada y se usa el ciclo de Mercur (`pending`/`confirmed`/`declined`/`canceled`) como **revisión**, no como visibilidad. `packages/domain/src/publication.ts` implementa el mapeo, la precedencia de `archived` y la escritura (`planPublicationWrite`). El catálogo público solo deriva `published` |

## 6. Definición de terminado para una fila ADAPTAR

Una fila no se marca terminada por «estar portada». Debe cumplir:

1. Tipos y esquemas en `packages/domain` y `packages/validation`, sin dependencias de Next ni Supabase.
2. Consulta o comando en `@agestyles/api-client`, con contrato tipado.
3. UI web y/o nativa componiendo desde `features-*` y `ui-*`, sin importar entre apps.
4. Tests portados del repositorio fuente, ejecutándose contra el API del laboratorio.
5. Prueba negativa de autorización (BOLA/IDOR) cuando la capacidad toca datos de tienda.
6. Sin escrituras a Supabase, sin segundo cálculo de dinero/stock, sin fork del core.
7. Referencia cruzada a ticket del backlog (§12 del plan maestro) y a este documento.

## 7. Trazabilidad con el backlog del plan

| Lote | Tickets del plan (§12) |
|---|---|
| Lote 0 | NX-02, DATA-02 |
| Lote 1 | WEB-01, MOB-01, MKT-02 |
| Lote 2 | MKT-01, MOB-02, F3 |
| Lote 3 | MKT-03, ARC-03, QA-01 |

## 8. Uso y mantenimiento

- Toda fila se actualiza cuando cambie la decisión, con fecha y motivo.
- Una decisión **CONSTRUIR** exige ADR propio cuando crea módulo nuevo.
- Antes de cerrar F1 se revisan las 7 preguntas abiertas y se congelan las filas de los lotes 0–3.
- Este documento no sustituye al plan maestro: lo hace ejecutable.

## 9. Reconciliación con el trabajo en curso

**Corte:** 17/11/2026 00:58 UTC. El repositorio tiene cambios sin commit de una sesión paralela (Codex) que adelantaron varias filas de esta matriz. Se actualizaron en vez de dejar decisiones obsoletas.

| Cambio observado | Efecto en la matriz |
|---|---|
| Módulo de cotización: nace en `apps/commerce-api/src/modules/order-quotes`, se mueve a `packages/quotations` y se registra en `medusa-config.ts` (rutas `store` de crear/aceptar, `verify-order-quotes.mjs`, `verify-expired-order-quote.ts`) | Cotización deja de ser «CONSTRUIR»: pasa a **ADAPTAR** contrato; el módulo ya existe y sigue la regla de `AGENTS.md` (lógica en `packages/`) |
| `ADR-002` + `verify-dual-actor-identity.mjs`: identidad única con JWT por actor | Doble rol pasa de «CONSTRUIR» a **ADAPTAR**; queda el flujo en apps |
| 100 comprobaciones de roles en cuatro tiendas y dos propietarios | Pregunta #5 avanza a «parcial»; `seller-permissions` se mantiene |
| `ADR-003`: `insufficient_inventory` es falso positivo upstream en carrito mixto | No usar ese campo para bloquear compra; el stock real se valida en checkout |
| `packages/design-tokens` consumido por buyer, business y storefront | Diseño pasa de «ADAPTAR» a **USAR** |
| `/tiendas` y `/tiendas/[handle]` en `storefront-web` | Fila de escaparate marcada como parcialmente hecha |
| `docs/architecture/medusa-mercur-capability-matrix.md` | Es la evidencia de F1; este documento es el registro de decisiones de reutilización. No duplicar: enlazarlos |
| Cotización ampliada a carrito completo (`seller_ids`, `order_group_id`) y verificada end-to-end el 17/11: 2 vendedores, 5 aceptaciones concurrentes, 1 grupo y 2 pedidos, expiración sin pedido | Fila de cotización pasa a **ADAPTAR/verificada en API**; los tipos se corrigieron al contrato real |
| Inspección estática de `product-attribute` (2.4.1): tipos con `unit`, obligatorio, filtrable, eje de variante, vínculo a categoría; ciclo de cambios `PENDING`/`CONFIRMED`/`DECLINED`/`CANCELED` | Preguntas #1 y #7 bajan de «todo el PIM» a «familia/versión y mapeo de estados» |
| PIM v1 implementado y verificado en laboratorio (17/11): módulo `@agestyles/catalog-pim`, migración generada, API admin/store, comparación version-scoped y pruebas de reglas (`docs/tickets/LOTE-2-PIM.md`, ADR-004) | Pregunta #1 **cerrada**; la fila de familias pasa de «ADAPTAR pendiente» a «ADAPTAR hecho (v1)». Pregunta #7 sigue abierta (mapeo de estados) |
| `pnpm typecheck` ahora cubre `@agestyles/quotations` y `@agestyles/design-tokens` (9 tareas) | F2 avanza en cobertura de CI |

**Regla de coordinación:** antes de portar una fila, comprobar `git status` y los scripts de verificación existentes. Si la capacidad ya está implementada en `apps/commerce-api` o `packages/`, esta matriz se actualiza primero y el ticket se reescribe como adaptación, no como construcción.

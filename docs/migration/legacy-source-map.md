# Mapa del esquema legado (`Agestyles-Catalogo`) para F0/F6

**Tarea:** OC-01 de [docs/OPEN_CODE_TASKS.md](../OPEN_CODE_TASKS.md)
**Corte:** 17 de noviembre de 2026
**Fuente inspeccionada:** `/home/ernesto/proyectos/Agestyles-Catalogo`, rama `develop`, HEAD `cc0a810` (2026-11-16 16:22 +0100)
**Método:** lectura de archivos SQL y de código; **no** se leyó ninguna fila, dump, `auth.users`, objeto de Storage ni credencial. No se abrió conexión a Supabase/PostgreSQL ni se ejecutó migración alguna.

> **Estado del documento:** propuesta de mapeo revisable. Las columnas de destino son las que ofrecen Medusa 2.22.3 / Mercur 2.4.1 y el contrato intermedio `agestyles.stage-interchange` v1 (`tools/migration/`). Ninguna equivalencia está confirmada contra una base restaurada; las dudas se marcan como **pendiente**.

## 1. Fuente de verdad y límites del mapa

El esquema se reconstruye desde dos capas del repositorio fuente:

| Capa | Ruta | Qué aporta | Fiabilidad |
|---|---|---|---|
| Baseline reproducible | `scripts/supabase-schema-from-zero.sql` (551 líneas) | 21 tablas iniciales, columnas, checks, funciones y RLS de arranque | Replay declarado en su cabecera; **no** es un dump de la base viva |
| Migraciones versionadas | `supabase/migrations/*.sql` (81 archivos) | columnas, tablas y RPC posteriores | 80 aplicadas; la última aplicada es `20261116061921_merchant_order_line_fulfillment.sql` |

Consecuencias que el ETL debe asumir:

1. El baseline reordena y endurece políticas; algunas columnas creadas ahí fueron sustituidas después (p. ej. `stores.owner_id` → `stores.merchant_id`). No sirve por sí solo para generar un importador.
2. La migración `20261116120000_merchant_product_media.sql` **no está aplicada** y no crea tablas: solo añade tres RPC de alta/baja/imagen principal (`private.add_merchant_product_image`, `remove_merchant_product_image`, `set_merchant_product_primary_image`) y sus envoltorios `public.*`. Es un cambio de funciones, no de esquema de datos, pero sí altera la ruta de escritura de medios de vendedor.
3. Antes de escribir ETL hace falta un `pg_dump --schema-only` autorizado de la base viva y contrastarlo con este mapa. **Pendiente bloqueante:** el corte de auditoría no lo tiene y este trabajo no podía producirlo (regla de no tocar la fuente).
4. Los conteos agregados ya publicados en `docs/STATUS_PLAN_MAESTRO.md` (33 productos, 7 pedidos, 8 líneas, 14 perfiles, 31 imágenes, 48 movimientos, 0 comercios/tiendas/membresías) se citan solo como orden de magnitud; **este mapa no consultó datos**.

## 2. Convenciones

- **Origen** = tabla/columna real del repositorio fuente.
- **Destino** = modelo propuesto. `Medusa`/`Mercur` son modelos del fork; `AgeStyles` es el contrato intermedio o un paquete propio.
- **Brecha** = lo que no encaja sin decisión o transformación.
- Los identificadores legacy (`uuid`, `variant_key`, `code`) se conservan en `legacy_id` / `metadata` y en la futura tabla `legacy_id_mapping`, nunca como clave primaria nueva.

## 3. Organización, vendedores y tiendas

| Entidad origen | Campos y relaciones | Destino propuesto | Brecha / decisión |
|---|---|---|---|
| `public.merchants` (`20261116033937_merchant_multi_tenant_foundation.sql`) | `id`, `name`, `slug` (regex), `status` (`draft\|active\|suspended\|closed`), `created_at`, `updated_at`, `closed_at` (obligatorio si `closed`) | `organizations` (interchange) → Mercur seller/organization | `closed_at` no existe en Medusa; guardar en `metadata`. Confirmar que Mercur mantiene organización y seller como dos niveles. |
| `public.stores` (`20261106072715_multi_stores_optional_product_assignment.sql`) | `id`, `name`, `slug`, `description`, `logo_url`, `banner_url`, `category_tags text[]`, `featured`, `active`, `sort_order`, `owner_id` (**eliminada**), `contact_phone`, `address`, `opening_hours`, `merchant_id`, timestamps | `sellers` (interchange) | Una tienda = un seller. `category_tags` no tiene equivalente: `metadata`. `owner_id` migró a membresía owner (`private.legacy_store_owner_links`). |
| `public.merchant_memberships` | `id`, `merchant_id`, `user_id → auth.users`, `role` (`owner\|manager\|catalog_editor\|order_manager\|inventory_manager\|viewer`), `status` (`active\|suspended\|revoked`), `invited_by`, timestamps, único `(merchant_id,user_id)` | Miembros seller de Mercur (`member`) + permisos AgeStyles (`SellerPermissionsService`) | Los seis roles legacy no son los roles de Mercur. Mapear por capacidad, no por nombre. `revoked` no debe convertirse en miembro activo. |
| `public.merchant_invitations` | `id`, `merchant_id`, `email_normalized`, `role`, `token_hash` (SHA-256, único), `status` (`pending\|accepted\|revoked\|expired`), `expires_at`, `invited_by`, `accepted_by`, `accepted_at` | Invitaciones de Mercur / Medusa | `token_hash` no es reutilizable. Pendientes: invitaciones `pending` vigentes en el corte y política para `expired`/`revoked`. |
| `private.legacy_store_owner_links` | `store_id` PK, `user_id → auth.users`, `preserved_at` | Membresía `owner` derivada | Solo contiene la relación histórica tienda↔propietario; no prueba rol actual. |

**Pendiente:** no hay nada en el esquema que declare una relación `merchant` ↔ `organization` de Mercur más allá de `stores.merchant_id`; la composición exacta (organización → tiendas) debe confirmarse en la matriz de capacidades.

## 4. Catálogo: categorías, marcas, productos y variantes

### 4.1 Jerarquía y taxonomías

| Entidad origen | Campos | Destino | Brecha |
|---|---|---|---|
| `public.categories` | `id`, `slug` único, `name`, `description`, `sort_order`, `uses_gender`, `created_at` | `categories` → `product_category` | `products.category` referencia el **slug**, no el id. ADR-004 ya fija la resolución `slug → handle → id`. |
| `public.subcategories` | `id`, `category_slug → categories.slug`, `slug`, `name`, `description`, `sort_order`, único `(category_slug,slug)` | Categoría hija (`parent_category_id`) | El par (categoría, subcategoría) se vuelve un nivel de árbol; hay que fijar handles estables. |
| `public.brands` | `id`, `name`, `slug` único, `logo_url` | `product_brand` de Medusa | Sin brecha de forma; decidir si el logo pasa a `media_objects`. |
| `public.clothing_types` | `id`, `name` único, `description`, `requires_size` | Tipo de producto (`product_type`) | `requires_size` no existe en Medusa: `metadata`. |
| `public.sizes` + `public.clothing_type_sizes` | `sizes`: `id`, `name`, `size_type`, `sort_order`, `active`, único `(name,size_type)`; puente N:M con tipo | Atributo/opción de talla (Mercur `product-attribute` + `product-option`) | `size_type` y el orden se pierden si solo se portan nombres; hoy determina variantes. |

### 4.2 Productos

`public.products` (baseline + migraciones):

| Columna | Tipo / regla | Destino | Brecha |
|---|---|---|---|
| `id` | uuid PK | `legacy_id` / `metadata.legacy_product_id` | — |
| `code` | `numeric` (no texto) | `product.metadata.legacy_code` o `handle` | Un código numérico puede perder ceros a la izquierda. Unicidad se añade después (`products_code_uniqueness_guard`); confirmar índices reales. |
| `name`, `description` | texto | `product.title`, `description` | — |
| `price`, `currency` | `numeric(12,2)`; `USD\|CUP` | Precio de variante/oferta en `price_set` | Ver §9 (moneda). `null` permitido. |
| `stock` | entero | `inventory_level.stocked_quantity` del agregado | El stock real por variante vive en otras tablas; `products.stock` es un saldo heredado. Decidir si se ignora. |
| `featured` | bool | `metadata.featured` | Separado de publicación desde `20261106082859`. |
| `gender` | texto | Atributo `gender` | Valores observados en `order_items.selected_gender` (`men\|women`) y catálogo con `uses_gender`; normalizar. |
| `model` | texto | `metadata.model` | — |
| `brand_id`, `subcategory_id` | FK | Marca / categoría hija | — |
| `commission_amount`, `commission_is_cumulative`, `commission_unit_threshold` | numérico/bool/entero | `metadata` o módulo propio | Regla comercial fuera de Medusa; no inventar campo. |
| `activated_at` | timestamptz | `metadata.activated_at` | Se fija al publicar; conservar para auditoría. |
| `store_id` | FK `stores` (`on delete set null`) | Seller propietario de la oferta | Un producto pertenece a **una** tienda. `null` = producto global. |
| `publication_status` | `draft\|published\|archived` | `product.status` + `metadata.agestyles_publication_state` | Ya resuelto en `packages/domain/src/publication.ts` (archived/rejected se despublican). |
| `specifications` | `jsonb` objeto | `@agestyles/catalog-pim` versión publicada | Validar con `validateCatalogSpecifications`; no copiar el JSON sin normalizar. |
| `variant_options` | `jsonb` array ≤100 | Ejes de variante | El esquema no dice la forma interna; hay que leer el contrato de la app fuente (pendiente de confirmar). |
| `catalog_family_version_id` | FK `catalog_family_versions` | `catalog_family_version_id` en `metadata` (ADR-004) | Referencia directa, pero puede apuntar a versión archivada/borrador: el ETL debe resolver a la publicada. |

### 4.3 Variantes comerciales

`public.product_commercial_variants` (`20261107114427_commercial_product_variants.sql`):

| Columna | Destino | Brecha |
|---|---|---|
| `product_id` + `variant_key` (PK compuesta) | `product_variant` (SKU/handle estable) | `variant_key` es texto, no entidad. `__default__` significa “sin variantes”. |
| `sku`, `barcode` | `product_variant.sku` / `barcode` | SKU solo es único por producto (check de longitud, sin índice global). Duplicados entre productos romperían Medusa: **pendiente de conciliación**. |
| `price`, `currency` | Precio de variante | Precio por variante convive con `products.price`; decidir precedencia. |
| `image_urls` (`jsonb` array ≤10) | `media_objects` + vínculo a variante | URLs absolutas de Supabase Storage; requieren re-hospedaje. |
| `status` (`active\|draft\|archived`) | `metadata.variant_status` | No equivale a `product.status`; no publicar una variante archivada. |
| `sort_order`, `revision`, `updated_at` | `metadata` | `revision` revela escrituras concurrentes; conservar para auditoría. |

### 4.4 PIM: familias, versiones y atributos

| Entidad origen | Campos | Destino | Brecha |
|---|---|---|---|
| `public.catalog_family_definitions` (`20261115055033`) | `id`, `category_slug`, `name`, `is_default` (único por categoría donde true), `created_by` | `catalog_family` de `@agestyles/catalog-pim` | `is_default` no existe en el módulo; `metadata`. |
| `public.catalog_family_versions` (`20261106210025` + `20261115055046`) | `id`, `family_id`, `category_slug`, `name`, `version > 0`, `fields jsonb` (array 1..24), `created_by`; unicidad declarada al crear `(category_slug,version)`, revisar con `family_id` | `catalog_family_version` + `fields` | `fields` incluye `comparable`, grupo, ayuda, unidad y mín/máx (ADR-004); la propia RPC valida `type` contra `text\|number\|boolean\|select\|multiselect`. Validar contra el contrato actual; las unidades pasan a `catalog_units`. |
| `private.catalog_family_attribute_refs` | puente `family_version_id` ↔ `attribute_definitions.id` | `attribute_handle`/`option_handles` | ADR-004: los `option_ids` de Catalogo **no** se portan. |
| `public.attribute_definitions` | `id`, `name` único, `display_name`, `type` (texto libre, p. ej. `text`) | `product_attribute` de Mercur | `attribute_definitions.type` no tiene los tipos de Mercur. |
| `public.catalog_attribute_library` + `catalog_attribute_options` (`20261112180000`) | `data_type` (`text\|number\|boolean\|select\|multiselect`), `label`, `description`, `active`, `revision`; opciones `code`, `label`, `sort_order` | `AttributeType` de Mercur (`single_select`, `multi_select`, `unit`, `toggle`, `text`) | Mapeo propuesto: `text→text`, `number→unit` (con unidad) o `text`, `boolean→toggle`, `select→single_select`, `multiselect→multi_select`. **Pendiente:** `number` sin unidad y `unit` no son idénticos. |
| `public.catalog_units` | `code` PK, `name`, `symbol`, `dimension` (10 valores), `active`, `sort_order`, `revision` | Unidad del atributo Mercur | Mercur guarda la unidad en el atributo, no un catálogo de dimensiones: puede requerir semilla controlada. |
| `private.product_variant_specification_versions` | versiones de especificaciones por variante | `metadata` de variante | Solo relevante para históricos; no reimportar todas las revisiones. |
| `public.product_attribute_values` | `product_id`, `attribute_id`, `value`, único triple | Valores de atributo de Mercur | EAV a nivel producto; Mercur espera valores por atributo/opción. Normalizar valores, no copiar ids. |

### 4.5 Publicación y revisión

| Origen | Estados | Destino | Brecha |
|---|---|---|---|
| `products.publication_status` | `draft`, `published`, `archived` | `product.status` (`draft\|proposed\|published\|rejected`) + `metadata.agestyles_publication_state` | Resuelto en `packages/domain/src/publication.ts`; `archived` despublica. |
| `public.merchant_product_publication_requests` (`20261116042000`) | `pending`, `approved`, `rejected`, `withdrawn`; `review_note`, `reviewed_by`, `reviewed_at` | Revisión de Mercur (`pending\|confirmed\|declined\|canceled`) + historial | `withdrawn` no tiene equivalente; `approved` debe generar `published` solo tras revisión. El mapeo actual de `publication.ts` **no** cubre estos cuatro estados: pendiente de extender el contrato antes del ETL. |

## 5. Ofertas e inventario

| Origen | Campos | Destino | Brecha |
|---|---|---|---|
| `products.store_id` + `product_commercial_variants` | producto, variante, precio, moneda | `offers` (interchange) / Mercur offer (`seller_id`, `variant_id`, precio) | No existe tabla `offers` legacy: la oferta se deduce de (tienda, producto, variante, precio). Un producto = un seller; no hay oferta multi-vendedor del mismo producto. |
| `public.product_variant_stock` | `product_id`, `variant_key`, `stock ≥ 0`, `updated_at` | `inventory_level.stocked_quantity` | Saldo por variante **sin ubicación**. Medusa exige `stock_location`: proponer una ubicación por tienda. |
| `public.product_size_stock` | `product_id`, `size_id`, `stock` | Saldo por variante de talla | Duplica el saldo si también existe `product_variant_stock`; decidir cuál es canónico por producto. |
| `products.stock` | entero | Saldo agregado | Puede estar desfasado; no usar como fuente si hay saldo por variante. |
| `public.inventory_movements` | `type` (`venta\|baja\|ingreso\|ajuste`), `quantity > 0`, `signed_delta`, `stock_before/after`, `payment_method` (`efectivo\|transferencia`), `gestor_id`, `unit_price`, `currency`, comisiones, `reason`, `created_by`, snapshots SKU/barcode/imagen | Histórico de movimientos (archivo o `metadata`) | **No recontabilizar**: el plan exige fijar stock final y no reproducir ventas. `gestor_id` es identidad: solo se conserva el id legacy, sin PII. |
| `private.order_stock_reservations`, `order_reservation_batches`, `inventory_reservation_config` | reserva por pedido, `active\|consumed\|cancelled\|expired`, duración | Reservas de Medusa (`reserved_quantity`) | Las reservas activas caducan; el ETL debe decidir si se trasladan o se dejan expirar. No copiar config (`enabled` está apagada por defecto). |

## 6. Identidad y perfiles

| Origen | Campos | Destino | Brecha |
|---|---|---|---|
| `public.profiles` | `id → auth.users`, `email` único, `full_name`, `role` (`user\|admin\|gestor_venta`), `phone`, `address`, `id_document`, `is_seller`, `is_gestor_venta` | `customers` (interchange) / Medusa customer; `member` para staff | `role` legacy solo distingue tres valores; los permisos reales están en `merchant_memberships`. `id_document` es PII: **no exportar** salvo decisión explícita. |
| `auth.users` (Supabase GoTrue) | identidad, email, metadatos | Customer/member de Medusa | No asumir hashes portables (plan §Auth): invitación/reset. Mantener `legacy_user_id` en mapping interno. |
| `public.app_settings` | `key` PK (`cup_per_usd`), `value`, `updated_at` | Configuración de región/tipo de cambio | Ver §9. |

`is_seller` se sincroniza por trigger con `role = 'admin'` en el baseline; es un indicador heredado, no una membresía.

## 7. Carrito, favoritos y preferencias

| Origen | Campos | Destino | Brecha |
|---|---|---|---|
| `public.carts` | `id`, `user_id → profiles`, `session_key`, único parcial por usuario y por sesión | Carrito de Medusa | Los carritos de invitado (`session_key`) no tienen comprador; decidir si se descartan. |
| `public.cart_items` | `cart_id`, `product_id`, `quantity > 0`, `size_id`, único triple | Línea de carrito | El carrito apunta al producto, no a la variante: hay que resolver `variant_key` por `size_id`/`selected_size`. |
| `public.user_favorites` | `user_id → auth.users`, `product_id`, PK compuesta | `favorites` | — |
| `public.wishlist` | `user_id → profiles`, `product_id`, único | `favorites` | **Dos tablas con la misma semántica.** Decidir unión con deduplicación; no duplicar filas. |
| — | No hay tabla de preferencias de comprador | `customer_preferences` | El contrato intermedio la incluye pero **la fuente no la tiene**: no fabricar registros. |

## 8. Cotizaciones

`private.order_checkout_quotes` (`20261111134125_order_checkout_quotes.sql`):

| Columna | Destino (`packages/quotations`) | Brecha |
|---|---|---|
| `quote_id` PK | — | Es un id de cotización legacy, no reutilizable como `agestyles_order_quote.id`. |
| `user_id` | `customer_id` | — |
| `idempotency_key` (uuid) | `idempotency_key` (texto, único) | Tipos y unicidad distintos; el legacy es único por `(user_id,key,revision)`. |
| `revision > 0` | `revision` | Mismo concepto. |
| `request_items jsonb` | — | Snapshot de la petición; no hay campo equivalente (se guarda en `snapshot`). |
| `quote jsonb` | `snapshot` + `currency_code` + `total` | La cotización legacy no tiene columnas de total/moneda: están dentro del JSON. Hay que extraerlas y validarlas. |
| `status` (`quoted\|stale\|expired\|accepted`) | `quoted\|accepting\|accepted\|expired\|unavailable` | `stale` no tiene equivalente: se modela como `requoted`. Decidir histórico. |
| `expires_at` | `expires_at` | — |
| `order_id` | `order_group_id` | El legacy acepta a **un** pedido; el nuevo modelo crea un grupo con hijos por seller. Para históricos: 1 grupo ↔ 1 pedido legacy. |
| `accepted_at` | — | `metadata.accepted_at`. |

## 9. Pedidos, pagos, devoluciones y postventa

| Origen | Campos | Destino | Brecha |
|---|---|---|---|
| `public.orders` | `id`, `user_id` (sin FK), `status` (`pending\|sent\|delivered\|cancelled\|expired`), `total_amount`, `payment_method` (texto libre, por defecto `pending`), `stock_deducted`, `total_currency`, `cup_per_usd_snapshot`, timestamps | `orders` / `order` de Medusa | `user_id` sin FK puede apuntar a usuarios borrados. Mapear estados a los de Medusa (`pending`, `completed`, `canceled`, …) exige tabla explícita; **pendiente**. |
| `public.order_items` | `id`, `order_id`, `product_id`, `quantity`, `unit_price`, `currency`, `variant_key`, `variant_label`, `product_name_snapshot`, `selected_size numeric`, `selected_gender`, snapshots SKU/barcode/imagen, `store_id`, `store_name_snapshot` | `order_line_item` + `order_lines` (interchange) | `selected_size` es numérico, no una talla: pérdida de dominio ya existe en el legacy. `store_id` permite partir por seller; verificar si un pedido legacy puede mezclar tiendas. |
| `private.order_state_events` | historial de estados | Historial/archivo (no reemitir eventos) | Importar como lectura, no disparar workflows. |
| `private.order_payment_events`, `order_payment_requests` | `action` (`record\|void`), `amount`, `currency` (`USD\|CUP`), `method` (`cash\|transfer\|other`), `reference`, `reason` | Comprobantes de pago manual (`@agestyles/manual-payments`) | El legacy separa eventos inmutables; el módulo nuevo usa estados `pending→verified/rejected`. Conciliar importes exactos. `reference` puede ser PII financiera: tratarla como dato restringido. |
| `private.order_returns`, `order_return_events`, `order_return_operations` | `state` (`received\|accepted\|rejected`), `quantity`, `reason`, inspección, `restocked` | Devoluciones de Medusa / archivo | Si se archiva, conservar solo agregados; no reproducir restock. |
| `private.order_fulfillments`, `order_fulfillment_events`, `private.merchant_order_line_fulfillments` + eventos (`20261110034750`, `20261116061921`) | estados `unprepared→preparing→ready→dispatched→delivered` (pedido) y `preparing\|ready\|shipped\|delivered` (línea), `carrier`, `tracking_number`, `revision` | Fulfillment/shipment de Medusa por línea | Dos granularidades (pedido y línea). El nuevo modelo es por línea con tracking; mapear eventos, no crear envíos nuevos. |
| `private.order_admin_requests`, `sale_operation_*`, `csv_family_product_requests` | colas de idempotencia (`actor_id`, `operation_id`, `request`, `result`) | No migrar | Son estado operacional, no negocio; conservar solo si auditoría lo exige. |
| `private.order_notifications`, `order_notification_events`, `order_notification_deliveries` | `event_type`, `title`, `body`, `channel='in_app'`, `state` de entrega | Notificaciones propias / archivo | Solo in-app; no hay proveedor externo que reproducir. |
| `private.order_checkout_requests` | idempotencia de checkout | No migrar | Operacional. |

## 10. Medios

| Origen | Detalle | Destino | Brecha |
|---|---|---|---|
| `public.product_images` | `id`, `product_id`, `image_url`, `display_order`, `is_primary`, `created_at`; máximo 10 por producto (RPC) | `media_objects` + vínculo a producto/variante | URLs absolutas de Supabase Storage; requiere descarga y re-hospedaje con checksum. |
| Buckets `product-images`, `store-images` | públicos; rutas `merchant/{store_id}/{product_id}/{uuid}.{png\|jpg\|webp}` | Almacenamiento objetivo | Las rutas incluyen ids legacy: conservarlas como `legacy_path` en metadata. |
| `product_commercial_variants.image_urls` | array JSON ≤10 | Medios de variante | Puede duplicar `product_images`; deduplicar por URL. |
| Migración `20261116120000_merchant_product_media.sql` | no aplicada; solo RPC | — | No cambia tablas. Confirmar con el dueño de la fuente antes de asumir que el flujo de imágenes de vendedor está activo. |

## 11. Moneda, dinero y totales

- Monedas permitidas: `USD` y `CUP` (`products.currency`, `product_commercial_variants.currency`, `order_items.currency`, `order_payment_events.currency`).
- Tipo de cambio en `app_settings.cup_per_usd` (semilla 680); pedidos guardan `cup_per_usd_snapshot` y `total_currency`.
- El carrito legacy presenta totales **separados por moneda** (`src/lib/cartCurrencySummary.ts`), no convertidos.
- Medusa trabaja con una moneda por carrito/pedido y precios por región. **Pendiente P0:** decidir si se migran dos regiones (USD/CUP) sin conversión, o si se normaliza a USD con el snapshot. No inventar conversión en el ETL.

## 12. Brechas y preguntas abiertas

1. **Esquema vivo vs repositorio:** falta `pg_dump --schema-only` autorizado; el baseline no refleja necesariamente la base con 80 migraciones.
2. **Moneda dual y conversión:** modelo de regiones y precios sin decisión (§11).
3. **Stock sin ubicación:** definir una `stock_location` por tienda y el saldo canónico (`product_variant_stock` vs `product_size_stock`).
4. **Variantes:** `variant_key` como identidad, SKU único solo por producto, `variant_options` con forma no documentada.
5. **Pedidos multi-tienda:** confirmar si un pedido legacy puede tener líneas de más de una tienda (afecta grupo de pedidos y autorización).
6. **Estados de pedido:** tabla de equivalencia `pending/sent/delivered/cancelled/expired` → Medusa, y tratamiento de `expired`.
7. **Revisión de publicación:** `pending/approved/rejected/withdrawn` no está cubierto por `packages/domain/src/publication.ts`.
8. **Roles:** los seis roles de membresía legacy no equivalen a los roles de Mercur; mapear capacidades.
9. **Favoritos duplicados:** unir `user_favorites` y `wishlist` con deduplicación.
10. **Preferencias de comprador:** no existe tabla fuente; no generar registros vacíos.
11. **PII:** `profiles.address`, `id_document`, `phone`, `order_payment_events.reference` y `auth.users` quedan fuera de cualquier export hasta que exista destino cifrado y consentimiento.
12. **Históricos:** decidir importación controlada vs archivo de solo lectura para pedidos, movimientos, devoluciones y notificaciones (plan §F6).

## 13. Fuentes revisadas

- `scripts/supabase-schema-from-zero.sql` (baseline completo).
- `supabase/migrations/` — 81 archivos; lectura dirigida de: `20261106072715`, `20261106082859`, `20261106210025`, `20261107114427`, `20261107114428`, `20261107121135`, `20261110034750`, `20261111134125`, `20261112180000`, `20261115055033`, `20261115055046`, `20261116033937`, `20261116033943`, `20261116053426`, `20261116053428`, `20261116061921`, `20261116120000`.
- `src/lib/cartCurrencySummary.ts`, `src/lib/exchangeRate.ts`, `src/lib/optimizedImage.ts` (comportamiento de moneda y medios).
- `docs/OPEN_CODE_TASKS.md`, `AGENTS.md`, `docs/STATUS_PLAN_MAESTRO.md`, `docs/CODEX_HANDOFF.md`, `docs/adr/ADR-004-catalog-family-versioning.md`, `packages/domain/src/publication.ts`, `tools/migration/README.md` (destinos y decisiones ya tomadas).

No se leyó ninguna fila, dump, objeto de Storage ni credencial; no se modificó el repositorio fuente ni se ejecutaron migraciones.

# Lote 2 — PIM v1: familia y versión

**Ticket:** NX-02 (PIM) · **Prioridad:** P0 para Lote 2 · **Esfuerzo:** 2–3 sesiones
**Estado:** **v1 de servidor y contratos completado el 17/11/2026**; UI y asociación producto→versión pendientes
**Origen:** [MATRIZ_REUTILIZACION.md](../MATRIZ_REUTILIZACION.md) §2.2, pregunta #1 · **ADR:** [ADR-004](../adr/ADR-004-catalog-family-versioning.md)
**Regla:** no se reimplementa lo que Mercur ya tiene; no se toca el core.

## Evidencia comparada (leída del código fuente, 17/11/2026)

| Concepto | Agestyles-Catalogo (`catalogFamilies.ts`) | Mercur 2.4.1 (`product-attribute`) |
|---|---|---|
| Agrupación | `CatalogFamily`: `family_id`, `category_slug`, `name`, `version`, `fields[]` | No existe |
| Definición de campo | `attribute`, `key`, `scope` (product/variant), `type`, `required`, `filterable`, `visible`, `comparable`, `options`, `group`, `help`, `unit`, `unit_symbol`, `minimum`, `maximum` | `handle`, `name`, `type`, `is_required`, `is_filterable`, `is_variant_axis`, `rank`, `is_active`, `product_id`, `product_option_id` |
| Tipos | text, number, boolean, select, multiselect | single_select, multi_select, **unit**, toggle, text |
| Valores | `options: string[]` + `option_ids` | `ProductAttributeValue`: handle, name, rank |
| Alcance | producto o variante | global o por producto |
| Categoría | `category_slug` | link `product-attribute-category-link` |

**Conclusión:** Mercur cubre definiciones, valores, obligatoriedad, filtrabilidad, eje de variante y vínculo a categoría. **La brecha real es la familia versionada y los metadatos de presentación/comparación** (`comparable`, `group`, `help`, `unit_symbol`, `minimum`, `maximum`, `visible`).

## Implementado en v1

| # | Entregable | Archivos | Estado |
|---|---|---|---|
| 1 | Contratos compartidos: `CatalogField`, `CatalogFamilySummary`, `CatalogFamilyVersion`, compatibilidad y `compareCatalogProducts` | `packages/domain/src/catalog-pim.ts`, export en `index.ts` y `package.json` | Hecho |
| 2 | Modelos `CatalogFamily` (handle único, categoría, activo) y `CatalogFamilyVersion` (versión única por familia, estado, snapshot JSONB, `frozen_at`) | `packages/catalog-pim/src/models/*` | Hecho |
| 3 | Servicio: crear familia + borrador v1, nueva versión, publicar (congela y archiva la anterior), listar, buscar por handle, versión publicada | `packages/catalog-pim/src/service.ts` | Hecho |
| 4 | Validación pura: 1–24 campos, claves y atributos únicos, tipos, alcance, filtros, opciones/handles, unidad, símbolo y límites | `packages/catalog-pim/src/validation.ts` | Hecho |
| 5 | Mapeo explícito al diccionario de Mercur (`text`/`unit`/`toggle`/`single_select`/`multi_select`) | `packages/catalog-pim/src/validation.ts` | Hecho |
| 6 | Migración generada por el módulo y snapshot | `packages/catalog-pim/src/migrations/*` | Hecho |
| 7 | Registro en `apps/commerce-api/medusa-config.ts` | `medusa-config.ts` | Hecho |
| 8 | API admin: crear familia (valida categoría real), listar, crear versión, publicar (impide cruzar familias) | `apps/commerce-api/src/api/admin/catalog-families/**` | Hecho |
| 9 | API store pública: solo familia activa y versión publicada | `apps/commerce-api/src/api/store/catalog-families/[handle]/route.ts` | Hecho |
| 10 | Pruebas de reglas y verificación en laboratorio | `packages/catalog-pim/test/catalog-pim.test.ts`, `apps/commerce-api/src/scripts/verify-catalog-pim.ts`, `verify-catalog-pim-http.ts` | Hecho |

### Decisiones de implementación

- La familia referencia `product_category.id`, no `category_slug`; el ETL resuelve slug → handle → id una vez.
- Los atributos y valores siguen en Mercur; la familia guarda `attribute_handle` y `option_handles`. `option_ids` de Catalogo (UUID) no se portan.
- Un borrador por familia; publicar archiva la versión publicada anterior. Una versión publicada no se muta.
- Las escrituras son de plataforma (admin); los vendedores solo leerán la versión publicada. La autenticación admin la aplica el framework por el prefijo `/admin`.
- El snapshot se guarda como array JSONB; el límite de tipos de `model.json()` se cruza en un único helper documentado.

## Verificación ejecutada

| Comando | Resultado |
|---|---|
| `pnpm typecheck` | **10/10 tareas, exit 0** |
| `pnpm --filter @agestyles/catalog-pim test` | `PASS: field bounds/types, handle slugs, Mercur type mapping and version-scoped comparison` |
| `medusa db:generate agestylesCatalogPim` | `Generated successfully (Migration20261117004833.ts)` |
| `medusa db:migrate` | Migraciones aplicadas en el laboratorio aislado |
| `medusa exec ./src/scripts/verify-catalog-pim.ts` | `created family`, `published v1`, `draft v2`, `v2 published / v1 archived`; duplicado, campo inválido y segundo borrador rechazados; limpieza final |
| `medusa exec ./src/scripts/verify-catalog-pim-http.ts` | `{"created":201,"listed":1,"publishedVersion":2,"storeReturnsPublished":true,"draftLeakBlocked":true,"crossFamilyPublishBlocked":true,"unknownCategoryRejected":true}` |

**Nota operativa:** el contenedor `agestyles-buyer-api` está construido sin montar el repositorio y sigue ejecutando la imagen anterior. Las rutas se verificaron invocando los handlers con el contenedor real de Medusa (`medusa exec`), no por HTTP contra el puerto 19081; para probarlas por HTTP hay que reconstruir la imagen o arrancar un servidor de desarrollo.

## Criterio de aceptación

1. `pnpm typecheck` 10/10 y migración generada por el módulo (sin SQL a mano). **Cumplido.**
2. Dos productos de la misma versión comparten campos y uno de versión distinta no es comparable. **Cumplido:** la asignación producto → versión publicada se persiste en `metadata` y la comparación lee los valores guardados; verificado en laboratorio con dos productos y un tercero sin familia.
3. Editar la familia crea versión nueva y no altera productos ya publicados. **Cumplido:** v2 draft no cambia v1 publicada; publicar v2 archiva v1.
4. Cero parches a `@mercurjs/core` o `@medusajs/*`. **Cumplido:** solo se añadieron archivos propios y la entrada de configuración.

## Pendiente para cerrar el PIM (no bloquea la v1)

- Persistir `catalog_family_version_id` en el producto (metadato soportado o link si los reportes lo exigen) y validarlo contra la versión publicada.
- Pantalla de administración en `business-app`/`vendor-ui`; lectura de vendedor puede usar el endpoint store o un endpoint vendor propio.
- Comparador web/nativo (2–4 productos) consumiendo `compareCatalogProducts`.
- ETL de familias reales cuando exista destino de staging; no hay datos que migrar hoy.

## No entra en v1

- Duplicar `ProductAttribute` ni `ProductAttributeValue` de Mercur.
- Migración de datos reales o cambios en Supabase.
- Moderación nueva: se reutiliza el ciclo `PENDING`/`CONFIRMED`/`DECLINED`/`CANCELED` de Mercur.

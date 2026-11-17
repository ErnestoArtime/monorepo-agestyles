# Lote 0 — Contratos compartidos v1

**Ticket:** NX-02a / NX-02b · **Prioridad:** P0 · **Esfuerzo:** una sesión de trabajo
**Estado:** **completado el 17/11/2026** · **Documento de origen:** [MATRIZ_REUTILIZACION.md](../MATRIZ_REUTILIZACION.md) §3
**Regla:** no toca Supabase, no añade dependencias, no duplica reglas de dinero o stock.

## Objetivo

Tener los tipos compartidos mínimos para que el siguiente lote pueda construir sin inventar formas de datos. En una startup esto se paga solo cuando hay consumo real: por eso v1 es pequeño y se amplía cuando exista el endpoint.

## Alcance v1 (solo esto)

| # | Entregable | Estado |
|---|---|---|
| 1 | `packages/domain/src/catalog.ts`: `Money`, `ProductSummary`, `ProductOffer`, `ProductVariantSummary` | Hecho |
| 2 | `packages/domain/src/index.ts`: barrel de exportación | Hecho |
| 3 | `packages/domain/src/fixtures/offers.ts`: un producto con dos ofertas (mismo producto, distinto vendedor, precio y stock) | Hecho |

## NX-02b — Endpoint de ofertas (añadido, también hecho)

| # | Entregable | Estado |
|---|---|---|
| 4 | `packages/api-client/src/offers.ts`: `toProductOffer` (puro) y `listProductOffers` contra `/store/offers` | Hecho |
| 5 | `StoreOffer` acepta `seller.handle` para construir enlaces de tienda | Hecho |
| 6 | Export `@agestyles/api-client/offers` | Hecho |

## NX-02c — Contrato de cotización (backend ya existente, hecho)

| # | Entregable | Estado |
|---|---|---|
| 7 | `packages/domain/src/order-quotes.ts`: `OrderQuote` con `seller_ids`, `order_group_id` y snapshot; resultados de crear/aceptar con pedidos hijos | Hecho |
| 8 | `packages/api-client/src/order-quotes.ts`: `createOrderQuote` (`cart_id` + `Idempotency-Key`) y `acceptOrderQuote` (revisión) | Hecho |
| 9 | Exports `@agestyles/domain/order-quotes` y `@agestyles/api-client/order-quotes` | Hecho |
| 10 | Verificación end-to-end del flujo real (2 vendedores, concurrencia, expiración) | Hecho: `verify-order-quotes.mjs` → `og_01M7KEWG6T48HSVG423BAA5T2N` con 2 pedidos hijos |

No se añadió manejo propio de errores: el SDK lanza el cuerpo de error de la API (`code` incluido) y el cliente decide si muestra re-cotización, expiración o fallo. Tampoco se reintenta la aceptación: solo es segura repitiendo la misma revisión.

## No entra en v1

- Zod/validación: se añade cuando exista el endpoint que valide.
- Reglas de precio, moneda o disponibilidad: viven en `commerce-rules` cuando haya un consumidor.
- Tipos de pedido: ya existen en `buyer-orders.ts`; se extienden cuando el flujo lo pida.
- Cualquier forma heredada de `src/types/product.ts` de Catalogo (fila de BD con 20 campos opcionales): **no se porta**.

## Criterio de aceptación

1. `pnpm --filter @agestyles/domain --filter @agestyles/api-client typecheck` pasa sin dependencias nuevas. **Verificado.**
2. `ProductOffer` referencia `ProductSummary` por id y no repite campos del producto. **Verificado.**
3. El fixture compila y refleja dos ofertas para un mismo producto. **Verificado.**

## Decisiones tomadas durante la implementación

- `price` es `Money | null`: una oferta sin precio en la moneda pedida no es vendible y no se inventa un cero.
- `available_quantity` es `number | null`: `null` significa «el vendedor no expone stock», nunca «sin stock».
- `toProductOffer` es puro para poder probarlo sin API y reutilizarlo en web y nativo.
- No se tocó `StoreOffer` ni `listStoreOffers` más allá de `seller.handle`: el storefront y la app compradora siguen igual.
- `compare_at_price` queda en `null` hasta que la API exponga ese dato.

## Siguiente

Lote 1 — vitrina: ficha y especificaciones, comparador y filtros, consumiendo `@agestyles/api-client/offers`.
Antes de empezar: revisar `git status`; la sesión paralela (Codex) está tocando `storefront-web` y puede haber avanzado parte de esta fila.

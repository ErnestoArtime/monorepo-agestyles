# Lote 1 — Vitrina (consolidación de consultas)

**Ticket:** WEB-01 / MOB-01 · **Prioridad:** P1 (deuda técnica) · **Esfuerzo:** media sesión
**Estado:** **parcial — nativo consolidado; storefront pendiente** · **Origen:** [MATRIZ_REUTILIZACION.md](../MATRIZ_REUTILIZACION.md) §3
**Regla:** la funcionalidad ya existe; solo se unifica la consulta. Sin cambios de comportamiento.

## Lo que ya existe (verificado en código)

| Superficie | Comportamiento actual |
|---|---|
| `storefront-web` ficha | Agrupa ofertas por vendedor, ordena por precio y marca «Mejor precio» (`productos/[handle]/page.tsx`) |
| `buyer-app` ficha | Selector de vendedor por variante con precio calculado por región; el `offerId` alimenta el carrito (`product/[id].tsx`) |

La funcionalidad de vitrina está, en web y en nativo. **No se reimplementa.**

## Brecha real

Existen dos consultas con formas distintas:

- `listOffers` (región + `calculated_price` + `in_stock`) — usada por la ficha nativa.
- `listStoreOffers` (precios por moneda + vendedor) — usada por el storefront.

`listProductOffers` quedó como tercera proyección. Tres formas para el mismo dato invitan a divergir.

## Objetivo v1 (solo esto)

1. Elegir **una** consulta canónica para ofertas de comprador y marcar la otra como legacy con comentario y fecha.
2. Que `listProductOffers` sea la proyección única y reciba el precio calculado por región cuando exista; si no, usar `prices` y mostrar «Consultar precio».
3. No cambiar UI ni el flujo de carrito.

## No entra

- Comparador de 2–4 productos con especificaciones (depende del modelo de familias, Lote 2).
- Filtros, facetas, PIM.
- Nuevos componentes o paquetes.

## Estado de la consolidación

| Paso | Estado |
|---|---|
| `listProductOffers` admite `variantId`, `regionId` y usa `calculated_price` de la región | Hecho |
| La ficha nativa de `buyer-app` consume `listProductOffers`; comportamiento preservado (mismo filtro de stock y precio) | Hecho |
| `listOffers` marcada `@deprecated` y sin consumidores en apps | Hecho |
| `storefront-web` migrado a la proyección compartida | Pendiente: sus archivos están en edición por la sesión paralela |

## Criterio de aceptación

1. `pnpm typecheck` 9/9. **Verificado.**
2. La ficha nativa conserva el filtro de ofertas disponibles y el precio por región. **Verificado por typecheck; falta revisión visual en dispositivo.**
3. `listOffers` sin consumidores. **Verificado con búsqueda en `apps/` y `packages/`.**
4. Sin cambios de comportamiento en el carrito. **Sin cambios en `addOffer`/`offerId`.**

## Riesgo

Unificar antes de que exista el endpoint definitivo puede costar dos veces. Si la sesión paralela ya tocó las consultas, revisar `git status` y adaptarse en vez de imponer la forma nueva.

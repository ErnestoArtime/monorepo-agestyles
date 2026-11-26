# @agestyles/store-follows

Módulo de Medusa v2 (AG-70): un cliente sigue una tienda y, si lo activa, recibe un aviso push de sus productos nuevos.

- **Rol:** módulo de datos (`medusaModule`), registrado en `apps/commerce-api/medusa-config.ts` como `agestylesStoreFollows`. Lo consume `apps/commerce-api` (rutas `/store/agestyles/store-follows` y el subscriber `notify-store-followers`).
- **Modelo:** `agestyles_store_follow` (`customer_id`, `seller_id`, `notify_new_products` apagado por defecto). Migración `Migration20261126120000`.
- **Reglas puras** (`./rules`, sin Medusa): validación de entradas, `isRecentProduct` (ventana de 14 días), límites.
- **Extensiones usadas:** módulo propio de Medusa 2.22.3; el evento `product.published` lo emite Mercur 2.4.1. No toca el núcleo.
- Diseño completo: [`docs/design/AG-70-seguir-tiendas.md`](../../docs/design/AG-70-seguir-tiendas.md).

```bash
pnpm --filter @agestyles/store-follows test
```

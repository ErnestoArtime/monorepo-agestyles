# AG-70 · Seguir tiendas y avisos de productos nuevos

Pedido de Ernesto (26 nov 2026): en **Favoritos** de Tienda, dos secciones, «Productos» y «Tiendas». Un cliente puede seguir una tienda y, **solo si lo activa**, recibir un aviso push cuando esa tienda publique productos nuevos.

## Qué hay

| Capa | Dónde | Qué hace |
|---|---|---|
| Módulo de datos | `packages/store-follows` (módulo de Medusa `agestylesStoreFollows`) | Tabla `agestyles_store_follow` (cliente, tienda, `notify_new_products`), reglas puras, servicio |
| Avisos | `packages/notifications` | Grupo nuevo `following` («Tiendas que sigues»), evento `followed_store_new_product` (solo push) |
| API | `apps/commerce-api` | Rutas `/store/agestyles/store-follows`, subscriber de `product.published`, verificador HTTP |
| Clientes | `packages/api-client/src/store-follows.ts`, `features-notifications` | Cliente y textos en español; preferencias sin interruptores inútiles |
| App Tienda | `packages/buyer-experience` | Favoritos con pestañas, botón Seguir, interruptor por tienda, toasts |
| Gateway | `tools/scripts/buyer-lab-gateway.mjs` | Dos reglas nuevas en la lista cerrada |

## Por qué un módulo propio

Se podía haber puesto la tabla en `packages/notifications`, pero un seguimiento es una relación cliente-tienda con vida propia (mañana: contadores de seguidores, «tiendas destacadas»), y el módulo de avisos es de *entrega*. Sigue el patrón de `category-requests`: un paquete con su modelo, migración, servicio y pruebas. Solo el **grupo de avisos** y el **evento** viven en `notifications`, porque ahí está el catálogo de eventos, textos y preferencias.

Puntos de extensión de Medusa 2.22.3 usados: módulo propio (`Module`, `model.define`, `MedusaService`, migración MikroORM), rutas de API de archivo (`src/api/store/...`), suscriptor al evento `product.published` que Mercur 2.4.1 ya emite (`workflows/product/events`). No se toca el núcleo de Medusa ni de Mercur. La tienda se referencia por `seller_id` (sin *link* de Medusa), como `category-requests`.

## Datos y migración

Tabla nueva `agestyles_store_follow`: `id` (`sfol_…`), `customer_id`, `seller_id`, `notify_new_products boolean not null default false`, fechas. Índice único `(customer_id, seller_id) where deleted_at is null` e índice por `seller_id`. Dejar de seguir borra la fila.

Dos migraciones, **aditivas** (no borran ni cambian datos):

- `packages/store-follows/src/migrations/Migration20261126120100.ts`: crea la tabla.
- `packages/notifications/src/migrations/Migration20261126120000.ts`: amplía la restricción `group` de `agestyles_notification` y `agestyles_notification_preference` con `following`.

**Hay que migrar antes de desplegar la API** (`pnpm migrate` / `medusa db:migrate`). Sin la segunda migración, guardar la preferencia del grupo nuevo o crear un aviso falla por la restricción. Con la API vieja y la tabla creada no pasa nada. No se ha desplegado ni migrado nada.

## Rutas (cliente autenticado; la identidad sale de la sesión, nunca del cuerpo)

| Ruta | Qué hace |
|---|---|
| `GET /store/agestyles/store-follows` | Tiendas que sigue (solo las abiertas), con nombre, logo y `notify_new_products` |
| `POST /store/agestyles/store-follows` `{ seller_id, notify_new_products? }` | Seguir (idempotente). El aviso queda **apagado** salvo que se pida |
| `POST /store/agestyles/store-follows/:seller_id` `{ notify_new_products }` | Activar/apagar el aviso (404 si no la sigue) |
| `DELETE /store/agestyles/store-follows/:seller_id` | Dejar de seguir (idempotente) |

Reglas en el servidor: solo se puede seguir una tienda `open`; un cliente nunca ve ni cambia seguimientos ajenos (todo se filtra por `customer_id` de la sesión); máximo 200 tiendas por cliente; los errores de validación son mensajes en español. Las rutas están en la lista cerrada del gateway (`GET POST` y `POST DELETE`).

## Aviso de producto nuevo

Evento `followed_store_new_product` (receptor cliente, grupo `following`, **solo push**, no correo). Texto: «Producto nuevo de <tienda>» / ««<producto>» ya está disponible.»; al tocarlo abre la ficha del producto.

El subscriber `notify-store-followers` escucha `product.published` y avisa solo si:

1. el producto está `published` y su tienda está `open`;
2. fue **creado hace menos de 14 días** (`NEW_PRODUCT_WINDOW_DAYS`): al desplegar, los productos antiguos no avisan, y volver a publicar uno viejo tampoco;
3. el cliente sigue la tienda **y activó el aviso de esa tienda**;
4. no se le ha avisado de ese producto: `dedupe_key = followed_store_new_product:<producto>:<cliente>`, así reintentos del bus o publicar dos veces el mismo producto no repiten nada.

Después actúa lo de siempre del módulo de avisos: preferencia del grupo `following` (el cliente puede apagarlo para todas las tiendas desde «Preferencias de avisos»), horas de silencio, cola y reintentos de Expo. Un fallo no rompe la publicación (`withNotificationRetries`).

Cambio colateral: `preferencesMatrix` ofrece solo los canales que algún evento del grupo usa, así el grupo nuevo (solo push) no enseña un interruptor de correo que no hace nada. Los grupos de Negocio que solo tienen push también pierden su interruptor de correo inútil. Las apps antiguas siguen funcionando: ignoran el grupo que no conocen.

## App Tienda

- **Favoritos:** dos pestañas, «Productos» (lo de antes) y «Tiendas». Sin sesión, «Tiendas» invita a iniciar sesión; cargando, error con «Reintentar» y vacío con «Ver tiendas». Cada tienda seguida muestra logo y nombre (abre su página), el interruptor «Avisarme de productos nuevos» y el botón «Siguiendo».
- **Botón Seguir / Siguiendo:** en la página de la tienda (con el interruptor debajo cuando ya se sigue) y en la ficha de producto, junto a «Vendido por» y a «Ver la tienda» cuando hay varias ofertas.
- **Toasts** (`useToast`): «Sigues a X», «Has dejado de seguir a X», «Te avisaremos de los productos nuevos de X», «Ya no te avisaremos…», error genérico en español, «Inicia sesión para seguir tiendas.» (y lleva al inicio de sesión).
- Los cambios se aplican al momento y se deshacen con toast de error si el servidor los rechaza (`FollowsProvider`, `context/follows-context.tsx`).
- Tema claro y oscuro con los tokens de `@agestyles/ui-native`; el interruptor es el `AppSwitch` común.
- Negocio monta el mismo árbol de rutas (modo comprador), así que lo recibe sin cambios propios.

## Pruebas

- `packages/store-follows/test/store-follows.test.ts`: validación, ventana de 14 días.
- `packages/notifications/test/notifications.test.ts`: grupo, evento, texto, solo push, apagar el grupo, dedupe.
- `packages/api-client/test/store-follows.test.ts` y `notifications.test.ts`: cliente, textos, errores sin texto crudo, canales por grupo.
- `apps/commerce-api/test/store-follows.test.mjs`: flujo del servidor con dobles (propiedad de los datos, aviso solo a quien lo activó, sin repetir, sin avisar de productos antiguos, sin publicar o con tienda cerrada).
- `apps/commerce-api/scripts/verify-store-follows.mjs` (+ paso en `.github/workflows/ci.yml`): HTTP sobre datos desechables; autenticación, aislamiento entre clientes, aviso apagado por defecto, grupo `following` solo push. No ejecutado aún: se comprueba en CI (necesita el laboratorio con la migración).

## Fuera de alcance

- Avisar de bajadas de precio, ofertas o reposición.
- Correo o bandeja distinta del push (la bandeja de la app sí recoge el aviso, como todos).
- Contadores públicos de seguidores.
- Migrar los favoritos de productos (siguen locales en el dispositivo).

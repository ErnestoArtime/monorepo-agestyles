# AG-19 — Notificaciones del ecosistema: propuesta de diseño

**Estado:** propuesta (claude, 18 nov 2026) · **Decide:** usuario · **Revisión cruzada:** codex. Sin código todavía.

## Objetivo

Que compradores y negocios se enteren de lo que pasa sin abrir la app: pedidos, preparación y entrega, pagos, stock, comisiones y cuenta. La **bandeja dentro de la app** es la fuente de verdad; push y correo solo avisan de que hay algo nuevo.

## Punto de partida

- **Hoy no hay nada:** ni `expo-notifications` en Buyer o Negocio, ni subscribers en `commerce-api` (no existe `src/subscribers`), ni proveedor de correo. WhatsApp es solo un enlace manual por tienda (`wa.me`).
- **Legado:** solo bandeja in-app con estado de entrega (`order_notifications`, `order_notification_events`, `order_notification_deliveries`). No hay proveedor externo que reproducir.
- **Consecuencia ya visible:** Mercur crea una notificación de correo al invitar a un miembro (`send-invitation-email`) y Medusa emite `auth.password_reset`, pero sin proveedor de correo ni subscriber propio **probablemente ni las invitaciones ni el restablecimiento de contraseña llegan por correo hoy**. Hay que verificarlo; si se confirma, es un hueco de producción independiente de la «gran experiencia».

## Verificado en las versiones pinadas

Medusa 2.22.3 · Mercur 2.4.1 · Expo `~54.0.22` (`expo-notifications` 0.32.x, `expo-server-sdk` 8.0.0 en el servidor). Revisado en el código de los paquetes npm.

| Tema | Resultado |
|---|---|
| Notification Module | `createNotifications` acepta `to`, `channel`, `template`, `data`, `trigger_type`, `resource_id`, `receiver_id` e `idempotency_key` (único). Guarda `status` (`pending`/`success`/`failure`) y `external_id`. |
| Reintentos | **No reintenta solo.** Repetir la llamada con la misma `idempotency_key` reenvía solo si la fila quedó en `failure`. El reloj y el límite de intentos son nuestros. |
| Proveedores | Un proveedor por canal; dos para el mismo canal dan error. Se registra con `AbstractNotificationProviderService` en `modules[].options.providers`. El canal `feed` por defecto solo escribe en el log: **no sirve de bandeja**. |
| Correo | Oficial: `@medusajs/notification-sendgrid` (incluido en `@medusajs/medusa`). SMTP genérico y Resend: sin módulo oficial verificado; exigirían proveedor propio. |
| Subscriber nativo | `configurable-notifications.js` escucha `order.created` con canal `email` y plantilla `order-created-template`. Al activar un proveedor de correo hay que comprobar que no envíe correos no deseados. |
| Eventos | `order.placed` **por pedido hijo** (Mercur, flujo de pedidos divididos) y `order_group.created` por grupo. Medusa: `order.fulfillment_created`, `shipment.created`, `delivery.created`, `order.canceled`, `order.return_*`, `payment.refunded`, `auth.password_reset`. Mercur: `member_invite.created`, `seller.approved`, `product.published/rejected/change-requested`, `payout.*`. |
| Event bus | Producción usa Redis (BullMQ) con persistencia (`appendonly yes`): los eventos sobreviven a un reinicio. Por defecto `attempts: 1`, así que un subscriber que falla **no se reintenta** salvo que se configuren intentos. |
| Expo push | Envío por lotes de hasta 100 mensajes a `exp.host/--/api/v2/push/send`; recibos de 300 en 300 (duran ~24 h); error `DeviceNotRegistered` ⇒ revocar el token. **En Android no funciona en Expo Go desde SDK 53**: exige development build (AG-14). |
| Web | El push en web es Web Push (VAPID), no un token Expo; Expo Push Service no lo entrega. |

**No verificado:** payloads de `product.*` y `payout.*`; que `withMercur` conserve el proveedor `feed`; la documentación oficial de Expo (bloqueada desde este entorno; se contrastó con el código del paquete); Resend con 2.22.3; cualquier prueba real en un dispositivo.

## Decisión de arquitectura

Todo con puntos de extensión soportados, sin tocar el core de Medusa ni de Mercur:

1. **Módulo propio `packages/notifications`** (módulo Medusa, como `inventory-movements`): bandeja, preferencias, dispositivos y cola de entregas.
2. **Subscribers** en `apps/commerce-api/src/subscribers/` que traducen eventos de Medusa/Mercur y eventos propios en llamadas a un workflow `notify`.
3. **Entrega externa por el Notification Module de Medusa** con proveedores propios por canal (`push` = Expo, `email` = el que se elija). Reutiliza el registro de estado y deja a Mercur enviar invitaciones por el mismo camino.
4. **Reintentos propios** con un job programado (`src/jobs`, como `sync-eltoque-rate.ts`), porque ni Medusa ni el bus los dan.

### Modelo

| Entidad | Para qué |
|---|---|
| `agestyles_notification` | Bandeja: `recipient_type` (`customer`/`member`), `recipient_id`, `seller_id` (solo miembros), `event_code`, `title` y `body` ya en español, `target` (pantalla y parámetros, no URLs), `read_at`, `dedupe_key` único. |
| `agestyles_notification_delivery` | Cola de entregas: `notification_id`, `channel`, `status` (`pending`/`sent`/`failed`/`skipped`), `attempts`, `next_attempt_at`, `error_code`, `ticket_id`. |
| `agestyles_device_token` | Token Expo por actor y dispositivo: plataforma, versión de la app, `last_seen_at`, `revoked_at`. |
| `agestyles_notification_preference` | Por actor, grupo de eventos y canal: activo o no. |

Reglas:

- **Idempotencia:** la `dedupe_key` (`evento:recurso:destinatario`) hace que reemitir un evento no duplique. Así se pueden activar reintentos del bus solo para nuestros subscribers (`options.attempts` por suscripción) sin riesgo.
- **Escritura atómica:** bandeja y entregas se crean en una sola transacción del módulo.
- **Reintentos:** backoff de 1 min, 5 min, 30 min, 2 h y 12 h; tras 5 intentos queda `failed` y visible para soporte. Un envío con coste no se reintenta a ciegas: se reutiliza la `idempotency_key` de la entrega.
- **Push:** el job envía en lotes de 100, guarda el ticket y consulta recibos pasados ~15 min; `DeviceNotRegistered` revoca el token.
- **Preferencias:** la bandeja no se puede apagar. Push y correo se pueden desactivar por grupo (pedidos, pagos, inventario, comisiones). Los avisos de cuenta y seguridad (restablecer contraseña, invitaciones) no se pueden desactivar. Horas silenciosas solo para push (propuesta: 22:00–07:00, hora de Cuba).

### Destinatarios e identidad

Hay dos actores (ADR-002): `customer` en Buyer y `member` en Negocio, con la misma persona posible en ambos. Las bandejas son **independientes por actor**: el modo comprador de Negocio muestra la del cliente; el modo negocio, la del miembro en la tienda seleccionada. Los avisos de negocio se reparten **un registro por miembro** con el permiso adecuado (`orders`, inventario, titular/administración) calculado al crear; un miembro nuevo no ve avisos anteriores.

### API

- **Store (cliente):** `GET /store/agestyles/notifications` (cursor, `unread_only`, devuelve `unread_count`), `POST …/notifications/read` (ids o todas), `POST /store/agestyles/devices`, `DELETE …/devices/:id`, `GET/POST …/notification-preferences`.
- **Vendor (miembro, tienda seleccionada):** las mismas rutas bajo `/vendor/agestyles/…`, filtradas por `seller_context` y por el miembro.
- Autorización y filtrado por actor siempre en el servidor. Hay que añadir las rutas a los **gateways** (`buyer-lab-gateway.mjs`, `seller-lab-gateway.mjs`) y un preflight en CI: en AG-24 la regla de gateway que faltaba rompió `GET /vendor/products` en producción.

### Apps

- Campana con contador en la cabecera (Tienda y Negocio) y pantalla **Bandeja** agrupada por fecha, con no leídas destacadas; tocar abre la pantalla de destino.
- **Preferencias** en Cuenta (Tienda) y Más (Negocio), con las horas silenciosas.
- Permiso de push pedido en contexto (tras el primer pedido o al abrir Preferencias), nunca al arrancar. El token se registra al iniciar sesión y se revoca al cerrarla.
- Web: sondeo al enfocar la pestaña y cada 60 s. Web Push queda para la fase final.
- Tema claro/oscuro con `@agestyles/design-tokens`, etiquetas accesibles («Notificaciones, 3 sin leer») y estados vacío, error y carga. Un `event_code` desconocido se muestra como «Tienes una novedad», nunca el código.

## Catálogo de eventos

El servidor genera título y texto en español (`es-ES`) a partir de `event_code` y parámetros.

**Comprador (`customer`)**

| Evento | Origen | Canales v1 |
|---|---|---|
| Pedido recibido (uno por grupo, no por tienda) | `order_group.created` | bandeja · push |
| Cotización lista / aceptada / vencida | módulo `quotations` (evento propio) | bandeja · push |
| Pago verificado / rechazado | `manual-payments` (evento propio) | bandeja · push |
| En preparación · listo · despachado · entregado | evento propio de la ruta `fulfillments` (cubre las cuatro acciones, incluida «listo», que Medusa no emite) | bandeja · push |
| Pedido cancelado · devolución recibida/aceptada/rechazada | `order.canceled`, `order.return_*` | bandeja · push |
| Restablecer contraseña · bienvenida | `auth.password_reset` | correo |

**Negocio (`member`)**

| Evento | Destinatarios | Origen | Canales v1 |
|---|---|---|---|
| Pedido nuevo (uno por tienda) | permiso `orders` | `order.placed` (por pedido hijo) | bandeja · push |
| Comprobante de pago subido | `orders` / titular | `manual-payments` | bandeja · push |
| Stock bajo (una vez por producto hasta recuperarse) | inventario y titular | job propio con umbral | bandeja · push |
| Producto aprobado / rechazado / cambios pedidos | miembro que lo creó y titular | `product.*` de Mercur | bandeja · push |
| Retiro de comisión solicitado | titular / administración | ruta propia | bandeja · push |
| Retiro pagado o rechazado | gestor | ruta propia | bandeja · push |
| Invitación a una tienda | invitado | `member_invite.created` | correo |

En pedidos divididos, cada tienda recibe solo lo suyo y el comprador recibe **un** aviso por grupo con el nombre de cada tienda cuando cambie su parte.

## Seguridad y privacidad

- Push con texto mínimo: nombre público de la tienda y estado, sin importes, direcciones ni datos de contacto.
- Ningún negocio ve avisos, pedidos ni nombres de otro negocio; el comprador no ve internos del vendedor.
- Los tokens de dispositivo son del actor que los registró: un `DELETE` solo borra los propios y el registro tiene límite de ritmo.
- Retención propuesta: bandeja 90 días, entregas 30 días, con job de purga.
- Los errores de los proveedores se registran como código, nunca como texto crudo hacia la app.

## Fases

| Fase | Contenido | Depende de |
|---|---|---|
| **N1** | Módulo y migración, bandeja, subscribers de pedido/estados/pagos/retiros/stock, API, gateways, pantallas de Buyer y Negocio, job de entregas, tests puros (dedupe, backoff, preferencias) y `verify-notifications.mjs` en CI. Sin proveedor externo, sin coste. | Autorización del usuario para la migración de producción |
| **N2** | Push con Expo: proveedor, registro de dispositivo, envío por lotes, recibos y revocación. | AG-14 (development build), cuenta Expo/EAS, Firebase (FCM v1) y, para iOS, Apple Developer |
| **N3** | Correo: proveedor elegido, restablecimiento de contraseña, invitaciones y bienvenida. | Decisión 1 |
| **N4** | WhatsApp asistido por evento, Web Push (VAPID), vista de soporte de entregas fallidas. | Decisiones 3 y 4 |

N3 puede adelantarse a N2 si se confirma que hoy no llega ningún correo de cuenta.

## Compatibilidad y verificaciones

- **Versiones:** Medusa 2.22.3, Mercur 2.4.1, Expo `~54.0.22`.
- **Extensiones usadas:** módulo propio, Notification Module con proveedores propios, subscribers, jobs programados, rutas API, opciones del event bus Redis y eventos de Mercur. Sin parches ni fork.
- **Flujos afectados:** checkout y pedidos divididos, preparación y entrega, pagos manuales, cotizaciones, comisiones y retiros, inventario, publicación de producto, invitaciones y cuenta.
- **Comprobaciones antes de cerrar N1:**
  - un cliente ve solo lo suyo y un negocio solo lo de su tienda (cruce entre A2 y B2 devuelve 403 o vacío);
  - un carrito con dos tiendas da 1 aviso al comprador y 1 a cada negocio;
  - reemitir un evento no duplica;
  - un miembro sin el permiso no recibe el aviso;
  - marcar como leído y contador de no leídas;
  - un canal que falla reintenta con backoff y termina en `failed`;
  - los gateways y preflights de las rutas nuevas;
  - activar el módulo de notificaciones no rompe las invitaciones de Mercur ni lanza correos del subscriber nativo.

## Riesgos

- **Conectividad en Cuba:** el push Android depende de FCM y de Google Play Services en el móvil. Probar en un dispositivo real antes de prometerlo; la bandeja funciona igual sin push.
- **Pérdida de eventos:** el evento se emite tras confirmar el pedido; si Redis lo perdiera, el aviso no se crea. Se mitiga con persistencia de Redis y con las copias (AG-02, aplazada).
- **Reintentos del bus:** `options.attempts` solo en los subscribers propios para no repetir los de Mercur.
- **Correo:** reputación del dominio (SPF/DKIM) y límites del proveedor.
- **Migración de producción:** módulo nuevo con tablas; requiere autorización explícita y revisión cruzada.

## Decisiones que necesito del usuario

1. **Proveedor de correo.** Recomiendo `@medusajs/notification-sendgrid` por ser el único con módulo oficial en 2.22.3 (necesita clave API y remitente verificado). La alternativa es un SMTP propio con proveedor a medida (más trabajo, reputación a nuestro cargo). Falta confirmar que el servicio acepte envíos a buzones de Cuba.
2. **Push.** ¿Hay o se crea cuenta Expo/EAS y proyecto Firebase? Sin Apple Developer no hay push en iOS. ¿Los clientes Android instalan por APK o por Play Store?
3. **WhatsApp.** Recomiendo mantener el enlace asistido (sin coste ni aprobación de Meta) en lugar de la Business API.
4. **Stock bajo.** Umbral por defecto propuesto: 3 unidades o menos, y quién lo recibe (titular y permiso de inventario).
5. **Horas silenciosas** del push (22:00–07:00, hora de Cuba) y **retención** (90 días).
6. **Orden.** ¿Empezamos por N1 y adelantamos N3 si no llegan correos de cuenta?

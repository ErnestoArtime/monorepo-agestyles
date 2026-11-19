# AG-40 — Notificaciones por rol y paso del proceso

**Estado:** en curso (claude, 19 nov 2026) · **Base:** AG-19 (bandeja, push, correo, outbox, preferencias).

Cada aviso se escribe siempre en la bandeja de la app. Además puede salir por push y por correo según las preferencias de la persona. El correo necesita SendGrid configurado y el push, la app instalada.

## Quién recibe qué

Roles de tienda: **gestión** (titular o administración), **pedidos** (gestión + atención al cliente), **inventario** (gestión + almacén), **persona** (solo a quien afecta). La **administración del marketplace** son los usuarios de administración (actor `user`).

### Compra y pedido

| Paso | Cliente | Tienda | Administración |
|---|---|---|---|
| Pedido realizado | Pedido recibido ✅ | Pedido nuevo (pedidos) ✅ | — |
| Comprobante de pago enviado | — | Comprobante de pago (pedidos) ✅ | **Comprobante por verificar** 🆕 |
| Pago verificado | Pago verificado ✅ | **Pago verificado: prepara el pedido** (pedidos) 🆕 | — |
| Pago rechazado | Pago rechazado ✅ | **Pago rechazado** (pedidos) 🆕 | — |
| En preparación / listo / despachado / entregado | Un aviso por etapa ✅ | — (lo hace la tienda) | — |
| Pedido cancelado | Pedido cancelado ✅ | **Pedido cancelado** (pedidos) 🆕 | — |
| Compra online con código de gestor | — | — | — |
| ↳ al gestor | — | **Comisión generada** (persona) 🆕 | — |

### Catálogo y tienda

| Paso | Tienda | Administración |
|---|---|---|
| Tienda registrada (pendiente de aprobar) | — | **Tienda nueva por aprobar** 🆕 |
| Tienda aprobada | **Tienda aprobada** (gestión) 🆕 | — |
| Tienda suspendida | **Tienda suspendida** (gestión) 🆕 | — |
| Producto enviado a revisión | — | **Producto por revisar** 🆕 |
| Producto aprobado / rechazado / cambios pedidos | ✅ (gestión) | — |
| Solicitud de categoría enviada | — | **Solicitud de categoría** 🆕 |
| Solicitud de categoría resuelta | **Categoría creada / usa una existente / no aceptada** (gestión) 🆕 | — |
| Stock bajo | Stock bajo (inventario) ✅ | — |

### Comisiones

| Paso | Tienda | Gestor |
|---|---|---|
| Retiro solicitado | Retiro solicitado (gestión) ✅ | — |
| Retiro pagado / rechazado | — | ✅ (persona) |

✅ existía (AG-19) · 🆕 se añade en AG-40.

## Cambios técnicos

- `packages/notifications`: destinatario `user` (administración) y grupo `marketplace`; migración que amplía las restricciones de `agestyles_notification`, `agestyles_notification_preference` y `agestyles_device_token`.
- Administración: bandeja en Negocio → Administración → «Avisos» (`GET /admin/agestyles/notifications`, `POST …/read`), con el mismo formato que la bandeja de la tienda. Los avisos se reparten a **todos** los usuarios de administración. Correo si SendGrid está configurado; sin push al principio, porque el registro de dispositivos es por cliente o miembro.
- Disparadores:
  - Eventos de Mercur: `seller.created`, `seller.approved`, `seller.suspended` y `product-change.created`.
  - Suscriptores existentes ampliados: pagos manuales, cancelación de pedido y venta online de gestor.
  - Las rutas de AG-35 al crear y al resolver una solicitud de categoría.
- Cada aviso lleva una clave de deduplicación: un reintento nunca duplica avisos.

## Pendiente fuera de AG-40

- Devoluciones (AG-20): avisos cuando exista el flujo.
- Bienvenida y seguridad de cuenta: la recuperación de contraseña ya existe; la bienvenida espera a SendGrid.
- El rol «gestión de pedidos» de Mercur no tiene permisos en `seller-permissions` (solo propietario, administración, inventario y atención). Hay que decidir si equivale a atención al cliente o a algo más.

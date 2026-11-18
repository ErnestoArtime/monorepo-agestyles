# AG-32 — Superadministrador del marketplace en la app de Negocio

**Estado:** propuesta (claude, 18 nov 2026) · **Decide:** usuario · **Revisión cruzada:** codex.

## Pedido del usuario

El titular de la tienda AgeStyles debe ser también **superadministrador de todo el marketplace**: ver todas las tiendas, todos los usuarios y darles el rol que quiera (por ejemplo, hacerlos administradores), desde la misma app de Negocio. Además, traer los **usuarios** y el **histórico de pedidos** del catálogo antiguo (agestyles.eav-labs.com, proyecto `Agestyles-Catalogo` sobre Supabase).

## Cómo funcionaba en el catálogo antiguo

- **Usuarios:** Supabase Auth (`auth.users`) + `public.profiles` con `role` `user | admin | gestor_venta` y los indicadores `is_gestor_venta` e `is_seller`. La pantalla `/admin/users` listaba perfiles y cambiaba el rol (usuario, gestor de venta, administrador). `private.is_catalog_admin()` daba el acceso de administración.
- **Tiendas (multi-tienda, nov 2026):** `merchants` y `merchant_memberships` (`owner | manager | catalog_editor | order_manager | inventory_manager | viewer`), con invitaciones. En producción tenían 0 filas.
- **Pedidos:** `orders` (estado `pending | sent | delivered | cancelled | expired`, total, forma de pago, moneda, tasa CUP) y `order_items` (instantáneas de nombre, SKU, imagen, talla, género y tienda).
- **Volumen** (recuento del 17 nov, `docs/migration/legacy-source-map.md`): 14 perfiles, 7 pedidos, 8 líneas. Sin tiendas ni membresías.

## Cómo encaja en Medusa/Mercur (ADR-002)

Son tres actores distintos, con el mismo correo posible y tokens separados:

| Actor | Para qué | Dónde está hoy |
|---|---|---|
| `customer` | Comprar | Tienda, y Tienda dentro de Negocio (AG-31) |
| `member` | Gestionar una tienda (rol por tienda de Mercur) | Negocio |
| `user` (administración de Medusa) | Todo el marketplace: tiendas, usuarios, pedidos y aprobación de productos | Existe una cuenta (`admin.env`), pero no hay pantalla ni ruta pública |

«Superadministrador» = la misma persona con un actor `user`. No se mezcla con el rol de tienda: el servidor decide por actor, como hasta ahora.

## Propuesta

### 1. Administración dentro de Negocio

- Al entrar en Negocio también se intenta abrir el actor `user` con el mismo correo y contraseña (igual que ya se hace con `customer`). Si existe, el menú muestra una sección **Administración**. Si no existe, no aparece nada.
- Un **gateway de administración** propio (prefijo `/admin-app`), con una lista cerrada de rutas `/admin/*` necesarias y el origen `negocio.eav-labs.com`. La API de administración no se abre entera a internet. Requiere revisión de seguridad de Codex antes de desplegar.
- Pantallas de la fase 1:
  1. **Usuarios:** clientes, miembros de tiendas y administradores en una sola lista con buscador. Acciones: hacer administrador (invitación de Medusa), quitar administrador, ver sus tiendas y roles.
  2. **Tiendas:** todas las tiendas con su estado, dueño y miembros. Acciones: aprobar, suspender e invitar a miembros con su rol.
  3. **Pedidos:** todos los pedidos del marketplace, con filtros por tienda y estado (solo lectura en la fase 1).
  4. **Productos en revisión:** aprobar o rechazar las solicitudes de publicación de todas las tiendas.
- En el menú se ve siempre con qué cuenta y con qué rol se está trabajando. Hecho en `05aa067` para el rol de tienda; se añadirá «Superadministrador».

### 2. Migración de usuarios

- Mapeo: `user` → cliente de Medusa; `gestor_venta` → miembro de la tienda AgeStyles + gestor de venta (AG-06); `admin` → actor `user`, por invitación.
- **Las contraseñas no se pueden traer** (Supabase Auth y Medusa usan sistemas distintos). Cada persona elige una nueva con un enlace. Hace falta el correo saliente configurado (SendGrid, pendiente) o, mientras tanto, enlaces que el administrador envía a mano.
- Dirección, documento de identidad y teléfono **no se exportan** hasta tener destino cifrado y consentimiento (regla 11 del mapa de fuentes).
- Necesita acceso de lectura completo a Supabase (clave `service_role` o un volcado). Hasta ahora solo se usó la clave pública, que no ve `auth.users` ni los perfiles por RLS.

### 3. Histórico de pedidos

Recomendación: **archivo de solo lectura**, no recrear los pedidos en Medusa.

- Recrearlos dispararía eventos, notificaciones, stock y comisiones de algo que ya ocurrió. El plan maestro (§DATA, punto 7) ya prevé esta salida.
- Un módulo propio `legacy-orders` con los 7 pedidos y sus 8 líneas, tal como estaban: instantáneas, estado, total y moneda. Importación idempotente con recuento y totales por moneda verificados.
- Se ven en **Mis compras → Pedidos anteriores** (el cliente, una vez migrado) y en **Administración → Pedidos**, marcados como «Catálogo anterior».

## Decisiones que necesita el usuario

1. Confirmar la administración dentro de Negocio (en lugar del panel web de Mercur aparte).
2. Acceso de lectura completo a Supabase para migrar usuarios y pedidos: clave `service_role` en un archivo privado del VPS, o volcado.
3. Correo: configurar SendGrid para los enlaces de contraseña, o empezar con enlaces enviados a mano.
4. Pedidos antiguos: archivo de solo lectura (recomendado) o importación completa en Medusa.

## Fases

| Fase | Contenido |
|---|---|
| A | Actor `user` en el login de Negocio, gateway de administración con lista cerrada, sección Administración con Usuarios y Tiendas |
| B | Pedidos de todo el marketplace y productos en revisión |
| C | Migración de usuarios (export de solo lectura, mapeo, invitaciones), con informe de recuentos |
| D | Archivo de pedidos antiguos y su visualización |

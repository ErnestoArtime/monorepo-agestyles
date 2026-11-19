# AG-32 fase C — Migración de usuarios y cuentas del catálogo antiguo

**Estado:** propuesta (19 nov 2026) · **Pedido del usuario:** traer los usuarios y cuentas de agestyles.eav-labs.com; no hay correo configurado.

## Qué hay en el catálogo antiguo (recuento del 17 nov, sin leer datos personales)

- `auth.users` de Supabase (cuentas con correo y contraseña) y `public.profiles` (14): `role` `user | admin | gestor_venta`, nombre, teléfono, dirección y documento.
- Favoritos (`user_favorites` y `wishlist`, con la misma función), 7 pedidos con 8 líneas, `merchant_memberships` (0 filas).

## El problema de las contraseñas

- Supabase no entrega las contraseñas ni sus hashes por su API, ni siquiera con la clave de servidor. Solo se verían con acceso directo a su base de datos.
- Aunque se tuvieran, Supabase usa bcrypt y Medusa guarda las suyas con otro algoritmo (scrypt), así que no se pueden copiar tal cual.
- Sin correo no se pueden enviar enlaces para elegir una contraseña nueva.

## Propuesta: migración al primer acceso (sin correo y sin pedir contraseña nueva)

1. **Importar las cuentas sin contraseña** con la clave de servidor del catálogo antiguo, en solo lectura:
   - correo, nombre y rol;
   - **no** dirección, teléfono ni documento, salvo que el usuario decida otra cosa (regla 11 del mapa de fuentes).
   - Por cada persona se crea en Medusa el cliente con `metadata.legacy_user_id`.
   - Si es `admin`, se marca para la administración.
   - Si es `gestor_venta`, se marca como gestor de la tienda AgeStyles.
   - Los favoritos se unen sin duplicados.
2. **Primer acceso:** la persona entra en la Tienda o en Negocio con su correo y su contraseña de siempre. Si Medusa aún no tiene su contraseña:
   - una ruta propia de la API comprueba esa contraseña contra Supabase (`/auth/v1/token?grant_type=password`, con la clave pública);
   - si es correcta, crea su identidad de Medusa con esa misma contraseña, enlaza el cliente importado y, según su rol, el miembro de la tienda o el administrador;
   - después el acceso sigue el camino normal.
   - Nada se guarda si Supabase no confirma la contraseña. El enlace solo vale para cuentas importadas y tiene límite de intentos.
3. **Cuentas que no vuelvan:** siguen importadas, sin contraseña, hasta que entren. El catálogo antiguo (Supabase Auth) debe seguir encendido durante la transición; después, quien no haya entrado necesitará un restablecimiento (manual o con correo cuando exista).
4. **Pedidos antiguos:** archivo de solo lectura («Pedidos anteriores»), como propone la fase D.

## Extensión de Medusa usada

Ruta propia en `apps/commerce-api` que usa los flujos públicos de Medusa:
- registrar la identidad `emailpass` (`/auth/customer/emailpass/register`);
- crear o enlazar el cliente (`createCustomerAccountWorkflow`);
- la invitación de administrador y el miembro de la tienda.

No se toca el proveedor `emailpass` de Medusa.

## Decisiones del usuario

1. Autorizar la lectura de las cuentas del catálogo antiguo con su clave de servidor (correo, nombre y rol; sin dirección, teléfono ni documento).
2. Confirmar la migración al primer acceso (propuesta) frente a dar contraseñas nuevas a mano.
3. Mantener Supabase Auth encendido durante la transición (¿cuánto tiempo?).

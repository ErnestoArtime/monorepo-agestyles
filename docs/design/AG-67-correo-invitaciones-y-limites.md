# AG-67 · Correo: invitaciones de equipo, límite por dirección y cambio de proveedor

Fecha: 26 nov 2026 · Autor: claude · Estado: código hecho, pendiente de revisión de codex y de despliegue (autorización de Ernesto).

## Qué cambia

1. **Invitación de equipo en español.** Mercur emite `member_invite.created` (al crear y al reenviar una invitación) pero nada enviaba el correo: el equipo copiaba el enlace a mano. El subscriber `send-member-invite-email.ts` lo envía con la plantilla `renderMemberInviteEmail` (`packages/notifications`), con el enlace `AGESTYLES_BUSINESS_WEB_URL/aceptar-invitacion?token=…`. El token solo va en el enlace, nunca en logs ni bandeja. Sin URL HTTPS configurada no envía y avisa en el log.
2. **Límite por dirección** (`src/lib/email-throttle.ts`): 3 correos de restablecimiento por hora y 5 invitaciones por día a la misma dirección. Complementa el límite por IP de los gateways: una IP distinta cada vez ya no puede llenar el buzón de otra persona. Si la consulta falla, el correo sale (no se bloquea la recuperación de una cuenta).
3. **Direcciones en minúsculas** al enviar el restablecimiento y la invitación.

## Lo que se descartó, con la razón

- **Restablecimiento de superadministradores**: no hace falta código nuevo. En Medusa 2.22.3 hay **una sola identidad de acceso por correo** y los actores (`member`, `user`) cuelgan de su `app_metadata`; el token de restablecimiento cambia la contraseña de esa identidad. La pantalla «¿Olvidaste tu contraseña?» de Negocio ya sirve a quien administra, porque cambia la misma contraseña con la que entra como administrador. Lo único no resuelto es una cuenta que solo exista como `user` y no como `member` (no hay ninguna hoy). Si aparece, bastaría permitir `/auth/user/emailpass/{reset-password,update}` en el gateway de administración y un `actor_type` más en `resetBaseUrl`.
- **Invitaciones de administración** (`invite.created` de Medusa): se mantienen por enlace copiable en Usuarios. No se enviaron por correo para no ampliar el volumen decidido en AG-66.
- **Bienvenida y verificación de correo al registrarse**: descartadas por AG-66 (reducir volumen). Sin verificación, el registro con un correo ajeno solo genera el correo de recuperación, ya limitado por dirección.

## Cambio de proveedor de correo

El proveedor es el módulo propio `src/modules/resend-notification`, que implementa `AbstractNotificationProviderService`. Las plantillas se renderizan fuera (`packages/notifications`) y el proveedor solo transporta `subject`, `html`/`text` y la clave de idempotencia. Para cambiar a Amazon SES, Brevo (SMTP) u otro:

1. Crear un módulo hermano (`src/modules/<proveedor>-notification`) con la misma interfaz (`send` devuelve `{ id }`).
2. Elegirlo en `notificationModule()` de `medusa-config.ts` por variable de entorno (hoy: `RESEND_FROM_EMAIL` → Resend; si no, SendGrid).
3. Añadir su variable a `emailEnabled()` en `src/lib/notifications.ts`.
4. Verificar el dominio del remitente (SPF/DKIM) en el proveedor nuevo y mover los registros DNS de `agestyles.eav-labs.com`.

Nada más depende del proveedor: ni los subscribers, ni la cola de avisos, ni las plantillas.

## Pruebas

- `packages/notifications/test/notifications.test.ts`: plantilla de invitación (escapado del nombre de la tienda, solo enlaces HTTPS).
- `apps/commerce-api/test/email-throttle.test.mjs`: límite por dirección y plantilla, ventana temporal, fallo de consulta.
- Tipado de `apps/commerce-api` sin errores.
- **No verificado**: envío real de la invitación y consulta `created_at` de `listNotifications` contra la base real (solo con fake); la prueba end-to-end requiere desplegar y enviar a una dirección de prueba.

## Puntos de revisión para codex

`member_invite.created` también se emite al reenviar; el campo `seller.name` de `query.graph("member_invite")`; que el límite de 5 al día no estorbe a quien invita a varias personas distintas (es por dirección, no por tienda).

# Seguridad — AgeStyles

Inventario de claves, rotación y revocación, vida de los tokens y la
decisión Bearer-only. Los valores reales viven solo en archivos privados
(lab: `apps/commerce-api/.env`; producción VPS: `api.env` y `compose.env`,
generados por `tools/scripts/init-commerce-production-env.sh`); este
documento no contiene ningún secreto y la lista completa de variables está
en `apps/commerce-api/.env.example`.

## 1. Inventario de claves

| Secreto | Dónde vive | Para qué |
|---|---|---|
| `DATABASE_URL` (contraseña Postgres embebida) | `api.env` (prod) / `.env` (lab) / `compose.env` genera la de prod | Acceso a Postgres loopback (prod `agestyles_production@127.0.0.1:15473`, lab `agestyles_lab@127.0.0.1:15472`). El patrón lo impone `medusa-config.ts`. |
| `JWT_SECRET` | `api.env` / `.env` / CI efímero | Firma los JWT de Medusa (Bearer). |
| `COOKIE_SECRET` | `api.env` / `.env` / CI efímero | Firma las cookies de sesión de Medusa. |
| `SENDGRID_API_KEY` | `api.env` | Correo transaccional (invitaciones, reset de contraseña, avisos). |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | `api.env` | Cuenta de servicio del bucket de medios (`agestyles-product-media` en MinIO local o Supabase Storage S3). |
| `GEMINI_API_KEY` / `OPENROUTER_API_KEY` / `GROQ_API_KEY` | `api.env` | Cadena de proveedores de AI Studio (Gemini → OpenRouter → Groq). |
| `ELTOQUE_API_TOKEN` | `api.env` | Tipo de cambio (job `sync-eltoque-rate`). |
| `EXPO_ACCESS_TOKEN` | `api.env` | Seguridad ampliada del push de Expo. |
| `AGESTYLES_LEGACY_SUPABASE_ANON_KEY` | `api.env` | Clave **pública** del catálogo antiguo (logins legacy). No es secreta por diseño, pero no se publica en el repo. |
| `LEGACY_SUPABASE_SERVICE_KEY` | Solo en la shell privada del importador | `service_role` del proyecto Supabase legacy, usada una vez para la migración AG-32. Ver §3. |
| `AGESTYLES_PRODUCTION_POSTGRES_PASSWORD` | `compose.env` | Contraseña Postgres de producción (hex). |
| `AGESTYLES_PRODUCTION_MINIO_USER` / `AGESTYLES_PRODUCTION_MINIO_PASSWORD`, `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | `compose.env` | MinIO local (perfil `local-media`). |
| `AGESTYLES_PRODUCTION_ADMIN_BEARER_TOKEN` | Shell privada del importador | Token admin para la carga inicial de producción. |
| `AGESTYLES_LAB_SEEDED_PASSWORD` | `.env` lab / CI efímero | Contraseña de los vendedores demo del seed. Sin valor por defecto desde el arreglo P1: el seed falla sin ella. |
| `AGESTYLES_OFFICIAL_OWNER_PASSWORD` | Shell privada | Contraseña del titular de la tienda oficial. |
| Clave publicable Medusa (`pk_…`) | Apps (`.env.local`, CI efímero) | Identifica la tienda en las rutas Store. Es publicable por diseño; no autoriza nada por sí sola. |

Claves que **no** existen en este proyecto: no hay clave secreta de pasarela
de pago (los pagos manuales se concilian contra comprobante; no hay
proveedor de cobro con tarjeta en la API) y no hay `service_role` nueva de
Supabase para la plataforma 2.0 (los medios nuevos viven en MinIO local o
en el bucket S3 configurado, no en Supabase).

## 2. Rotación y revocación por secreto

Regla general: genera el sustituto, ponlo en el archivo privado, reinicia
la API (`docker compose … up -d commerce-api`), verifica `/health` y una
ruta autenticada, y solo entonces revoca el valor viejo. Nunca edites
`api.env`/`compose.env` desde el repo ni los pegues en un chat.

| Secreto | Blast radius si se filtra | Rotación | Revocación |
|---|---|---|---|
| `JWT_SECRET` | Todos los JWT firmados con él son falsificables hasta rotar: cualquier actor (cliente, miembro, admin) puede ser suplantado. | Genera uno nuevo (`openssl rand -hex 32`), actualiza `api.env`, reinicia la API. **Todas las sesiones quedan invalidadas** (los clientes deben volver a entrar). | No hay lista de revocación: la rotación misma invalida los tokens viejos. |
| `COOKIE_SECRET` | Sesiones por cookie falsificables. Hoy el acceso es Bearer (ver §5), así que el impacto práctico es bajo, pero la rotación es la misma que `JWT_SECRET`. | Igual que `JWT_SECRET`. Invalida las sesiones por cookie. | La rotación invalida las cookies viejas. |
| `DATABASE_URL` / `AGESTYLES_PRODUCTION_POSTGRES_PASSWORD` | Acceso total a Postgres de producción (pedidos, clientes, pagos, inventario) si el atacante llega al loopback del VPS. Sin acceso al VPS no es explotable: el puerto no se publica. | Cambia la contraseña (`ALTER USER … PASSWORD`), actualiza `DATABASE_URL` en `api.env` y `AGESTYLES_PRODUCTION_POSTGRES_PASSWORD` en `compose.env`, reinicia. | La contraseña vieja deja de funcionar al cambiarla; no hay nada más que revocar. |
| `SENDGRID_API_KEY` | Envío de correo como AgeStyles (phishing con el remitente verificado). | Crea una clave nueva en el panel de SendGrid, actualiza `api.env`, reinicia, borra la vieja en el panel. | Borrar la clave en el panel de SendGrid. |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Lectura/escritura del bucket de medios según la política de la cuenta de servicio (fotos de producto; los comprobantes de pago van por almacenamiento privado separado). | Crea una cuenta de servicio nueva, actualiza `api.env`, reinicia, borra la vieja. | Borrar la cuenta de servicio en MinIO / Supabase. |
| `GEMINI_API_KEY` / `OPENROUTER_API_KEY` / `GROQ_API_KEY` | Consumo de IA a cargo de AgeStyles (gasto) y drafts con la identidad del proyecto. | Crea una clave nueva en el panel del proveedor, actualiza `api.env`, reinicia, borra la vieja. | Borrar la clave en el panel del proveedor. |
| `ELTOQUE_API_TOKEN` | Solo lectura del tipo de cambio; impacto bajo. | Nueva clave en ElToque, actualiza `api.env`, reinicia. | Borrar la clave en ElToque. |
| `EXPO_ACCESS_TOKEN` | Envío de push como el proyecto Expo. | Nuevo token en el panel de Expo, actualiza `api.env`, reinicia. | Revocar el token en el panel de Expo. |
| `LEGACY_SUPABASE_SERVICE_KEY` | Acceso total al proyecto Supabase legacy (auth.users, perfiles, pedidos antiguos, bucket `product-images`). Ver §3: debe revocarse tras AG-32. | No se rota: se revoca. | En el panel de Supabase: Settings → API → revocar/regenerar la `service_role`. |
| `AGESTYLES_LAB_SEEDED_PASSWORD` | Solo cuentas demo del laboratorio (datos desechables). | Cambia el valor en el `.env` lab y vuelve a sembrar en una base limpia. | Borra las cuentas demo o vuelve a sembrar. |
| `AGESTYLES_PRODUCTION_ADMIN_BEARER_TOKEN` | Token admin de un solo uso para la carga inicial. | Genera uno nuevo si la carga se repite. | Caduca con la sesión; no se guarda. |

Si se sospecha una filtración, además de rotar: revisa los logs de la API
y de Postgres de la ventana de exposición, y avisa al usuario antes de
revocar `JWT_SECRET` (cierra todas las sesiones, incluidas las suyas).

## 3. service_role legacy de Supabase (AG-32)

La migración AG-32 fase C necesitó acceso de lectura completo al proyecto
Supabase del catálogo antiguo (clave `service_role`), porque la clave
pública no ve `auth.users` ni los perfiles por RLS. Esa clave **debe
revocarse o confirmarse su revocación tras la migración**:

- Lo hace el usuario, no un agente: en el panel de Supabase del proyecto
  legacy, Settings → API → regenerar la `service_role` (o borrar el
  proyecto solo cuando ya no se necesite nada de él).
- No se apaga el proyecto ni el bucket `product-images` mientras la tienda
  2.0 siga sirviendo esas URLs; la revocación es de la clave, no del
  proyecto.
- Mientras no se confirme, el riesgo aceptado es: quien tenga esa clave
  tiene acceso total al Supabase legacy (usuarios, pedidos antiguos,
  bucket). La clave no está en el repo (solo se pasó en una shell privada
  del importador) y la plataforma 2.0 no la usa.
- Pendiente explícito: que el usuario confirme la revocación/regeneración
  en el panel de Supabase.

## 4. Vida del JWT y del token de reset

Lo que se sabe del código del repo (sin inventar defaults de Medusa):

- `medusa-config.ts` configura solo `jwtSecret` y `cookieSecret`; **no hay
  TTL configurado en el repo** para el JWT ni para el token de reset.
- El token de reset lo emite Medusa con el evento `auth.password_reset`;
  `apps/commerce-api/src/subscribers/send-password-reset-email.ts` lo mete
  en el enlace sin guardarlo ni registrarlo (el hash sha256 del token solo
  se usa como `idempotency_key` de la notificación). No hay en el repo
  ninguna caducidad explícita ni ninguna purga de tokens de reset.
- Pendiente explícito: verificar contra Medusa 2.22.3 (la versión fijada
  en `apps/commerce-api/package.json`) cuál es la caducidad por defecto
  del JWT de auth y del token de reset, y documentarla aquí con la fuente
  (código de `@medusajs/auth` / `@medusajs/medusa` 2.22.3 o docs oficiales).
  Hasta verificarlo, no se afirma ningún plazo.
- Recomendación si el default resulta largo o no existe: fijar una
  caducidad explícita corta para el reset (p. ej. 1 hora) y una sesión
  acotada para el JWT, y documentar el cambio aquí. Eso es trabajo
  pendiente, no hecho en este arreglo.

## 5. Decisión Bearer-only

- El acceso autenticado de AgeStyles es **Bearer-only**: las apps envían el
  JWT en el encabezado `Authorization: Bearer …`. No hay ninguna ruta que
  lea la sesión de una cookie, y `medusa-config.ts` no configura
  `cookieSecret` para un flujo de cookie-auth.
- Decisión: **cualquier cookie-auth futura exige anti-CSRF + SameSite**.
  Si alguna vez se guarda el JWT en cookie, debe ser `HttpOnly`, `Secure`,
  `SameSite=Lax` (o `Strict` donde sea viable) y con token anti-CSRF
  (p. ej. doble envío `csrf-token` en encabezado + cookie) verificado en
  el servidor en cada mutación. Sin esos dos controles, no se activa
  cookie-auth.
- Las cabeceras de seguridad de la API (incluida HSTS) y `NODE_ENV`
  siguen pendientes de verificación en vivo (Cloudflare/VPS); ver los
  pendientes de la auditoría del 22 nov 2026.

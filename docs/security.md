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

La revisión de las dependencias fijadas en **Medusa 2.22.3** verificó estos valores:

- JWT de sesión: el framework usa **1 día** por defecto (`@medusajs/framework/dist/config/config.js`). AgeStyles no sobrescribe ese valor.
- Recuperación: el workflow de Medusa usa **15 minutos** (`@medusajs/core-flows/dist/auth/workflows/generate-reset-password-token.js`). El suscriptor de AgeStyles construye un enlace HTTPS para cliente o miembro y usa un hash como clave de idempotencia.
- Crear y usar un enlace con el proveedor de correo real, y verificar su rechazo tras el primer uso y tras caducar, siguen pendientes de una prueba de integración.

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

## Revisión de seguridad de AG-53

El [PR #3](https://github.com/ErnestoArtime/monorepo-agestyles/pull/3) se integró en `6c9ca12`. Estas comprobaciones cubren los temas facilitados en seis bloques. Se revisaron el código, el historial accesible de `main` y del PR, el CI y algunos controles públicos de la versión que ya estaba en producción. El PR integrado espera despliegue.

| Bloque | Qué quedó comprobado o integrado | Qué queda por comprobar o corregir |
|---|---|---|
| **Acceso y sesiones** | Administración sin sesión responde 401 en su ruta pública. El CI ejercita autenticación, permisos de vendedor y separación de tiendas. El PR almacena tokens nuevos de Android/iOS en SecureStore y mantiene AsyncStorage en web para conservar el login. Medusa fija 1 día de sesión y 15 minutos para el reset. Los gateways registran fallos de login sin cuerpo ni contraseña. | Probar registro de administrador e invitación de punta a punta con una cuenta desechable. Separar el permiso de administrar administradores de AG-45, activar MFA si se decide, verificar entrega y uso único del reset, centralizar alertas y definir revocación de sesiones. La web sigue usando un token Bearer accesible a JavaScript y las APK pendientes necesitan recompilarse y volver a iniciar sesión. Revisar la limpieza del almacenamiento anterior y la política de cookies si se adopta una sesión web con HttpOnly. |
| **Secretos y entorno** | Los archivos `.env` versionados son ejemplos. La clave publicable de Medusa es la que utiliza el cliente Store; la revisión no encontró backend secrets publicados por las aplicaciones. Gitleaks revisó 336 commits con salida redactada: 8 coincidencias, 6 en fixtures de CI y 2 en referencias técnicas de documentación. Ninguna coincide con los secretos de producción contrastados localmente. | Activar escaneo en CI y revisar secretos fuera del historial de estas ramas, como logs, almacenamientos externos y credenciales antiguas. Confirmar la revocación de la `service_role` del legado por el procedimiento de esta guía. Sin señal de una credencial activa en el alcance auditado, no se rotaron claves. |
| **Datos y código** | PostgreSQL, Redis, API interna y gateways escuchan en loopback. El PR añade validación Zod para comprobantes, revisión administrativa e IA, y mantiene las comprobaciones de propiedad del pedido y el aislamiento en el servidor. | Completar la revisión de consultas y formularios fuera de las rutas del PR, de cualquier contenido que llegue a HTML y de las políticas externas de datos. La auditoría no certifica ausencia de inyección en toda la aplicación. AG-02 sigue pendiente de copia externa cifrada y restauración aislada. |
| **Red y navegador** | TLS válido en Tienda, Negocio, Catálogo y API; HTTP de Tienda redirige a HTTPS. En CORS, un preflight de Tienda devuelve 204 con su propio origen y uno ajeno devuelve 403. Los gateways del PR añaden cabeceras y límites de login y reset por IP. Usan Authorization Bearer y no reenvían cookies de sesión. El Catálogo aplica restricciones de marcos, objetos y URL base. Chromium ejecutó el arranque de Next.js con las cabeceras propuestas en una sesión interceptada. | Probar estas cabeceras y los límites tras publicar. La CSP estricta del Catálogo está solo en modo informe, pendiente de resolver scripts y estilos en línea sin perder el caché actual. Los contadores siguen en memoria, sin coordinación mediante Redis. Revalidar controles de origen y CSRF si se habilitan cookies de autenticación. |
| **Archivos y pagos** | El proveedor optimizado local valida por contenido las imágenes públicas y limita cada archivo a 8 MiB, incluido AVIF identificado como HEIF con AV1. El comprobante deriva vendedor y grupo del servidor, valida comprador, moneda e importe contra el pedido y no usa el cuerpo como fuente del pedido. La confirmación exige conciliar el importe con el total del servidor. | Probar carga de móvil, incluidos el límite total del gateway y multipart, y añadir una política equivalente en S3. No se probaron subidas con un bucket real ni pagos reales. Decidir qué hacer con comprobantes parciales: hoy pueden enviarse, pero por sí solos no se verifican. |
| **Servidor y cierre** | El Compose del PR fija NODE_ENV en producción y las apps usan debug solo en desarrollo. En los archivos publicados por Nginx de Tienda y Negocio no aparecieron `.env`, `.git`, `.pem` ni mapas de fuentes. CI verde en instalación congelada, formato, lint, pruebas, tipos, imagen, humo de API, permisos y exportaciones web. | Verificar NODE_ENV y archivos publicados tras desplegar. La revisión de paquetes retiró dependencias directas que la rama ya no usa, pero aún falta mantenimiento de transitivas, revisión de otras superficies y pruebas de login y checkout de la versión integrada en un entorno de aceptación. |

### Dependencias pendientes

La auditoría de producción de pnpm obtuvo **0 críticas, 5 altas y 8 moderadas**, con los mismos avisos en el PR y en `main` antes de la fusión. Los altos se concentran en `postcss` de Expo/Metro, `image-size` de Metro y `decode-uri-component` de Expo Router. Se requiere actualizar las transitivas con versiones compatibles y repetir los builds nativos y web.

- PostCSS: [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q) y [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849).
- image-size: [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq) y [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr).
- decode-uri-component: [GHSA-qr28-fpjm-wq7f](https://github.com/advisories/GHSA-qr28-fpjm-wq7f).

Evidencia de integración: [CI del commit final](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44999084955).

# Commerce de producción en el VPS

La tienda oficial AgeStyles usará su propio PostgreSQL y Redis en el VPS actual. El Compose reserva los puertos locales 15473, 16393 y 19085 para PostgreSQL, Redis y la API. Los volúmenes pertenecen al proyecto `agestyles-commerce-production`.

Configurar un archivo privado de Compose con `AGESTYLES_PRODUCTION_IMAGE` (imagen publicada por digest que incluya el modo `production` de `medusa-config.ts`), `AGESTYLES_PRODUCTION_POSTGRES_PASSWORD` (hexadecimal) y `AGESTYLES_PRODUCTION_API_ENV_FILE` (ruta absoluta a otro archivo privado). En el archivo de la API definir `DATABASE_URL=postgres://agestyles_production:<contraseña>@127.0.0.1:15473/agestyles_commerce`, `JWT_SECRET` y `COOKIE_SECRET`. Usar secretos propios de producción.

`bash tools/scripts/init-commerce-production-env.sh <carpeta-privada-nueva> <imagen@sha256:digest> <URL-HTTPS-del-bucket>` genera ambos archivos con permisos privados y secretos independientes. Mantener los archivos generados para los siguientes despliegues. La cuenta de servicio del bucket se añade a `api.env` tras crearla.

Desde la raíz del repositorio, sustituir `/ruta/privada/compose.env` por el archivo local:

```sh
docker compose --env-file /ruta/privada/compose.env -f infra/compose/commerce-production-data.yaml up -d --wait postgres redis
docker compose --env-file /ruta/privada/compose.env -f infra/compose/commerce-production-data.yaml run --rm commerce-api pnpm migrate
docker compose --env-file /ruta/privada/compose.env -f infra/compose/commerce-production-data.yaml up -d --wait commerce-api
curl --fail http://127.0.0.1:19085/health
```

El catálogo histórico conserva las URLs del bucket público `product-images` de Supabase. Para ese traslado, usar el paquete que incluya el mapa hermano `<paquete>.source-image-urls.json` y activar `AGESTYLES_PRODUCTION_REUSE_SOURCE_IMAGES=true`.

Si se activa el perfil opcional `local-media`, configurar `AGESTYLES_PRODUCTION_MINIO_USER` y `AGESTYLES_PRODUCTION_MINIO_PASSWORD` en el archivo privado de Compose. Con MinIO en ejecución, crear el bucket `agestyles-product-media` y una cuenta de servicio con acceso a ese bucket. En el entorno privado de la API, configurar `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` y `S3_FILE_URL`.

MinIO escucha en `127.0.0.1:19086` con volumen propio. Dar permiso anónimo `s3:GetObject` sobre los objetos de `agestyles-product-media`. El origen del túnel para imágenes debe apuntar al proxy de lectura `http://127.0.0.1:19087`. Configurar `S3_FILE_URL` como base HTTPS sin barra final, incluyendo `/agestyles-product-media` en la ruta. El proxy admite GET y HEAD para nombres de imagen de un solo segmento y rechaza el listado del bucket y las rutas administrativas. Los comprobantes de pago requieren almacenamiento privado y se gestionan por separado.

La carga inicial crea borradores vinculados a la tienda oficial. Con la tienda ya creada, ejecutar el importador con `AGESTYLES_COMMERCE_ENV=production`, `AGESTYLES_PRODUCTION_IMPORT_APPLY=true`, `AGESTYLES_PRODUCTION_DB_ALLOW_WRITE=true`, `AGESTYLES_PRODUCTION_API_URL=http://127.0.0.1:19085`, `AGESTYLES_PRODUCTION_OFFICIAL_SELLER_ID`, `AGESTYLES_PRODUCTION_ADMIN_BEARER_TOKEN` y el `DATABASE_URL` de producción. Pasar el directorio del paquete seguido de `--apply`. El modo Supabase reutiliza las URLs HTTPS del bucket y conserva el orden y la portada. El modo de copia usa `--media-directory <directorio-de-imágenes>` y requiere configurar el proveedor S3 de la API. Si una subida termina y la creación de la ficha falla, el archivo puede quedar huérfano y un reintento puede subirlo de nuevo. La carga de ofertas e inventario queda pendiente.

Para crear la tienda oficial, pasar `AGESTYLES_OFFICIAL_OWNER_EMAIL` y `AGESTYLES_OFFICIAL_OWNER_PASSWORD` mediante un archivo privado de entorno al ejecutar `pnpm exec medusa exec ./src/scripts/create-official-seller.ts` con el servicio `commerce-api`. El comando imprime el ID que se usa como `AGESTYLES_PRODUCTION_OFFICIAL_SELLER_ID`. Si la creación se interrumpe, revisar si el titular o la tienda ya existen y confirmar el estado de aprobación antes de continuar.

Validar el catálogo en la API local antes de cambiar el origen de las webs públicas. El seed de demostración carga vendedores y datos de prueba.

## Gateway público de compradores

Todas las apps de AgeStyles (Tienda, Catálogo, Negocio y móvil) usan un único dominio de API: `https://agestyles-api.eav-labs.com`. Se eligió un subdominio de un solo nivel porque el certificado universal de Cloudflare cubre `*.eav-labs.com` pero no niveles inferiores, y un nombre propio evita mezclarlo con otros proyectos del VPS.

El servicio `buyer-gateway` de `infra/compose/commerce-production-data.yaml` reutiliza `tools/scripts/buyer-lab-gateway.mjs` sin prefijo (`GATEWAY_PREFIX=""`), en `GATEWAY_PORT=19186`, hacia `UPSTREAM_PORT=19085`, con `ALLOWED_ORIGINS` para `tienda.eav-labs.com` y `catalogo.eav-labs.com`. Expone solo la lista de rutas Store y de autenticación de clientes; Admin y Vendor responden 404 y los orígenes ajenos 403.

```sh
docker compose --env-file /ruta/privada/compose.env -f infra/compose/commerce-production-data.yaml up -d buyer-gateway
```

Ruta en el túnel Cloudflare compartido (gestionado desde el panel, modo token): hostname `agestyles-api.eav-labs.com`, sin ruta, servicio `http://127.0.0.1:19186`. Negocio usa el mismo hostname con el prefijo `/negocio`: el servicio `seller-gateway` reutiliza `tools/scripts/seller-lab-gateway.mjs` con `GATEWAY_PREFIX=/negocio`, `GATEWAY_PORT=19187`, `UPSTREAM_PORT=19085` y origen `https://negocio.eav-labs.com`. Necesita su propio prefijo porque además de `/vendor/*` usa `/auth/member/*` y rutas Store del modo Comprar. En el túnel, la entrada `agestyles-api.eav-labs.com` con ruta `^/negocio/` hacia `http://127.0.0.1:19187` debe quedar por encima de la entrada sin ruta. Las webs usan `https://agestyles-api.eav-labs.com` con la clave publicable de producción.

## Notificaciones (AG-19)

El módulo `@agestyles/notifications` crea cuatro tablas (`agestyles_notification`, `agestyles_notification_delivery`, `agestyles_device_token`, `agestyles_notification_preference`) con `pnpm migrate`. Ese paso entra en el despliegue de la API que incluya AG-19 y requiere autorización explícita del usuario, como cualquier migración de producción. Sin las variables de abajo la bandeja dentro de la app funciona igual; solo los avisos por correo se omiten (`skipped`) y el push depende de que la app tenga proyecto EAS.

Variables del entorno privado de la API (`api.env`):

| Variable | Para qué | Notas |
|---|---|---|
| `SENDGRID_API_KEY` y `SENDGRID_FROM_EMAIL` | Correo transaccional con el proveedor oficial `@medusajs/notification-sendgrid` | Van juntas: con solo una la API no arranca. El remitente debe estar verificado en SendGrid (idealmente con SPF/DKIM del dominio). Mercur usa el mismo proveedor para las invitaciones de tienda. |
| `AGESTYLES_STORE_WEB_URL` | Enlace de «Elegir una contraseña nueva» y botón de los correos a clientes | `https://tienda.eav-labs.com`, sin barra final. Sin ella no se envía el correo de restablecimiento. |
| `AGESTYLES_BUSINESS_WEB_URL` | Lo mismo para miembros de tienda | `https://negocio.eav-labs.com`. |
| `EXPO_ACCESS_TOKEN` | Seguridad ampliada del servicio de push de Expo | Opcional. |
| `AGESTYLES_LOW_STOCK_THRESHOLD` | Unidades a partir de las que se avisa de stock bajo | Por defecto 3. Como máximo un aviso por producto y semana. |

`AGESTYLES_EXPO_API_URL` y `AGESTYLES_NOTIFICATIONS_QUIET_HOURS=off` existen solo para datos desechables (la CI apunta el push a un servidor local y desactiva las horas silenciosas). **No definirlas en producción**: el push saldría a una URL ajena y se enviaría de madrugada.

Requisitos para que llegue el push al móvil (no se pueden hacer desde el repositorio):

1. Cuenta Expo/EAS y un `extra.eas.projectId` en `app.json` de Tienda y de Negocio. Sin él la app muestra «aún no disponible» en Avisos.
2. Android: proyecto Firebase con clave de cuenta de servicio FCM v1 subida a EAS y `google-services.json` referenciado en `android.googleServicesFile`.
3. iOS: Apple Developer Program (la clave APNs la gestiona EAS).
4. Una development build o build de producción: el push remoto de Android no funciona en Expo Go.
5. Probar en un móvil real conectado desde Cuba antes de prometerlo: depende de FCM y de los servicios de Google del dispositivo.

Operación:

- La cola se procesa cada minuto (`agestyles-deliver-notifications`); los recibos de Expo se leen cada 10 minutos y revocan los tokens de dispositivos que ya no existen. Cada entrega se reintenta con 1 min, 5 min, 30 min, 2 h y 12 h y después queda `failed`.
- Para vaciar la cola al momento (por ejemplo tras una caída): `docker compose … run --rm commerce-api pnpm exec medusa exec ./src/scripts/run-notification-deliveries.ts`. Usa el mismo bloqueo que el job.
- Estado de las entregas: `select status, error_code, count(*) from agestyles_notification_delivery group by 1, 2;`. Códigos: `no_device` (sin móvil registrado), `email_provider_off`, `no_email`, `notification_missing`, `email_failed` y los de Expo (`MessageTooBig`, `InvalidCredentials`…).
- Retención: la bandeja se conserva 90 días y las entregas 30 (job diario a las 04:30).
- El bus de eventos reintenta hasta 3 veces un subscriber que falle (`jobOptions` en `medusa-config.ts`); los subscribers de notificaciones son idempotentes.

# Commerce de producción en el VPS

La tienda oficial AgeStyles usará su propio PostgreSQL y Redis en el VPS actual. El Compose reserva los puertos locales 15473, 16393 y 19085 para PostgreSQL, Redis y la API. Los volúmenes pertenecen al proyecto `agestyles-commerce-production`.

Configurar un archivo privado de Compose con `AGESTYLES_PRODUCTION_IMAGE` (imagen publicada por digest que incluya el modo `production` de `medusa-config.ts`), `AGESTYLES_PRODUCTION_POSTGRES_PASSWORD` (hexadecimal) y `AGESTYLES_PRODUCTION_API_ENV_FILE` (ruta absoluta a otro archivo privado). En el archivo de la API definir `DATABASE_URL=postgres://agestyles_production:<contraseña>@127.0.0.1:15473/agestyles_commerce`, `JWT_SECRET` y `COOKIE_SECRET`. Usar secretos propios de producción.

`bash tools/scripts/init-commerce-production-env.sh <carpeta-privada-nueva> <imagen@sha256:digest> <URL-HTTPS-del-bucket>` genera ambos archivos con permisos privados y secretos independientes. Mantener los archivos generados para los siguientes despliegues. La cuenta de servicio del bucket se añade a `api.env` tras crearla.

Desde la raíz del repositorio, sustituir `/ruta/privada/compose.env` por el archivo local:

```sh
docker compose --env-file /ruta/privada/compose.env -f infra/compose/commerce-production-data.yaml up -d --wait postgres redis media media-public
docker compose --env-file /ruta/privada/compose.env -f infra/compose/commerce-production-data.yaml run --rm commerce-api pnpm migrate
docker compose --env-file /ruta/privada/compose.env -f infra/compose/commerce-production-data.yaml up -d --wait commerce-api
curl --fail http://127.0.0.1:19085/health
```

Antes de ejecutar la migración de la API, configurar `AGESTYLES_PRODUCTION_MINIO_USER` y `AGESTYLES_PRODUCTION_MINIO_PASSWORD` en el archivo privado de Compose. Con MinIO en ejecución, crear el bucket `agestyles-product-media` y una cuenta de servicio con acceso a ese bucket. En el entorno privado de la API, configurar `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` y `S3_FILE_URL`.

MinIO escucha en `127.0.0.1:19086` con volumen propio. Dar permiso anónimo `s3:GetObject` sobre los objetos de `agestyles-product-media`. El origen del túnel para imágenes debe apuntar al proxy de lectura `http://127.0.0.1:19087`. Configurar `S3_FILE_URL` como base HTTPS sin barra final, incluyendo `/agestyles-product-media` en la ruta. El proxy admite GET y HEAD para nombres de imagen de un solo segmento y rechaza el listado del bucket y las rutas administrativas. Los comprobantes de pago requieren almacenamiento privado y se gestionan por separado.

La carga inicial crea borradores vinculados a la tienda oficial. Con la tienda ya creada, ejecutar el importador con `AGESTYLES_COMMERCE_ENV=production`, `AGESTYLES_PRODUCTION_IMPORT_APPLY=true`, `AGESTYLES_PRODUCTION_DB_ALLOW_WRITE=true`, `AGESTYLES_PRODUCTION_API_URL=http://127.0.0.1:19085`, `AGESTYLES_PRODUCTION_OFFICIAL_SELLER_ID`, `AGESTYLES_PRODUCTION_ADMIN_BEARER_TOKEN` y el `DATABASE_URL` de producción. Pasar el directorio del paquete seguido de `--apply --media-directory <directorio-de-imágenes>`. El importador verifica las imágenes locales antes de escribir. La API debe usar un almacenamiento de producción que devuelva URLs HTTPS. El importador sube las imágenes al crear cada ficha y conserva su orden y portada. Si una subida termina y la creación de la ficha falla, el archivo puede quedar huérfano y un reintento puede subirlo de nuevo. La carga de ofertas e inventario queda pendiente.

Validar el catálogo en la API local antes de cambiar el origen de las webs públicas. El seed de demostración carga vendedores y datos de prueba.

# Almacenamiento de imágenes con MinIO en el laboratorio

El laboratorio mantiene el almacenamiento local de Medusa por defecto. MinIO es una opción aislada para preparar la importación de imágenes del catálogo; no se inicia con PostgreSQL y Redis ni publica puertos fuera de `127.0.0.1`.

## Preparar credenciales locales

Genera credenciales aleatorias y añádelas solo al archivo ignorado `apps/commerce-api/.env` (permisos `600`). No las pongas en archivos versionados, registros o mensajes:

```sh
openssl rand -hex 16
openssl rand -hex 32
```

Usa el primer valor como `MINIO_ROOT_USER` y el segundo como `MINIO_ROOT_PASSWORD`. Añade también esta configuración, sustituyendo ambos valores privados:

```dotenv
MINIO_ROOT_USER=<usuario-aleatorio>
MINIO_ROOT_PASSWORD=<contraseña-aleatoria>
AGESTYLES_FILE_STORAGE_PROVIDER=s3
S3_ACCESS_KEY_ID=<mismo-usuario-aleatorio>
S3_SECRET_ACCESS_KEY=<misma-contraseña-aleatoria>
S3_BUCKET=agestyles-media
S3_REGION=us-east-1
S3_ENDPOINT=http://127.0.0.1:19083
S3_FILE_URL=https://<origen-publico-https>/agestyles-media
```

`S3_FILE_URL` debe ser la URL pública HTTPS que los compradores y sus dispositivos puedan abrir. No uses `localhost` ni `127.0.0.1` como URL de archivos: solo son válidos para la conexión entre el API y MinIO en este laboratorio. El dominio, proxy HTTPS y acceso público deben configurarse por separado antes de servir imágenes a compradores. No se hacen aquí cambios de DNS o túnel.

## Arrancar y detener

Desde la raíz del monorepo:

```sh
docker compose --env-file apps/commerce-api/.env -f infra/compose/mercur-lab.yaml --profile media up -d minio minio-bucket
```

El contenedor `minio-bucket` crea el bucket y habilita lectura anónima de objetos únicamente dentro de este MinIO local, enlazado a loopback. La consola queda en `http://127.0.0.1:19084`; el endpoint S3, en `http://127.0.0.1:19083`.

Después de iniciar o reiniciar Medusa para que lea las variables, las imágenes nuevas se guardarán en MinIO. El volumen `minio-data` conserva los objetos al detener los contenedores. Para detener MinIO sin borrar los datos:

```sh
docker compose --env-file apps/commerce-api/.env -f infra/compose/mercur-lab.yaml --profile media stop minio minio-bucket
```

Si `AGESTYLES_FILE_STORAGE_PROVIDER` no está definido o vale `local`, Medusa conserva su proveedor de archivos local. Si vale `s3`, el API exige todas las variables `S3_*` y una `S3_FILE_URL` HTTPS. No copies credenciales MinIO al VPS ni habilites este proveedor en un entorno publicado sin configurar antes su almacenamiento y origen HTTPS públicos.

# Publicación manual de las webs AgeStyles

Este procedimiento construye y publica las imágenes de `buyer-app`, `business-app` y `storefront-web` desde GitHub Actions. El VPS solo descarga las imágenes ya preparadas y reinicia el frontal seleccionado; no instala dependencias ni ejecuta compilaciones.

El flujo es manual y no despliega por sí mismo. Conserva los dominios, puertos, API, gateways y configuración del túnel actuales. No publicar una versión hasta que el commit deseado esté en `main` y haya pasado el workflow **Monorepo checks**.

## 1. Preparación única de GitHub

En **Settings → Secrets and variables → Actions → Variables**, define estos valores. Son URLs públicas, una clave publicable de Medusa y rutas públicas; no uses claves Admin o Vendor.

| Variable | Uso |
|---|---|
| `AGESTYLES_BUYER_MEDUSA_URL` | `https://agestyles-api.eav-labs.com` — gateway/Store API de compradores. |
| `AGESTYLES_BUSINESS_MEDUSA_URL` | `https://agestyles-api.eav-labs.com/negocio` — gateway del portal de negocio. |
| `AGESTYLES_STOREFRONT_MEDUSA_URL` | `https://agestyles-api.eav-labs.com` — API Medusa usada por Next.js. |
| `AGESTYLES_MEDUSA_PUBLISHABLE_KEY` | Clave publicable `pk_…` para los tres sitios. Cópiala de `EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY` en `apps/buyer-app/.env.local`. |
| `AGESTYLES_BUYER_APP_URL` | `https://tienda.eav-labs.com` — destino de los enlaces de compra del catálogo. |
| `AGESTYLES_STOREFRONT_SITE_URL` | `https://catalogo.eav-labs.com` — dominio canónico de Next.js. |
| `AGESTYLES_BUYER_ANDROID_APK_URL` | URL pública del APK beta (opcional; dejar vacío si no corresponde). |
| `AGESTYLES_GHCR_OWNER` | `ernestoartime` — usuario GitHub en minúsculas donde Actions publicará las imágenes. |

Los valores de Expo se incorporan en los bundles web y son visibles para los visitantes. La clave `pk_` también se usa en el servidor Next; es publicable y no es una clave secreta. No pegues en GitHub ni compartas claves `sk_`, Admin o Vendor. La imagen Next obtiene su configuración de Medusa desde el archivo `.env.storefront-web`, que debe estar preparado en el VPS al arrancar el contenedor. No pasar secretos de producción ni valores `.env` en la línea de build.

El workflow requiere permiso `packages: write`, ya configurado en su definición, y usa el `GITHUB_TOKEN` efímero del propio run. No hace falta crear un PAT para que Actions publique.

## 2. Crear una versión de imágenes

1. En GitHub, abre **Actions → Publish frontend images → Run workflow**.
2. Selecciona la rama `main` y ejecuta el flujo manual.
3. Espera a que finalicen los tres pasos `Publish … runtime image`.
4. Copia el tag completo `sha-<commit>-run-<id>-attempt-<intento>` del resumen del run. Ese tag identifica el commit y ese intento de publicación; no hay alias `latest`.
5. En **Packages**, revisa la visibilidad de los tres paquetes `agestyles-buyer-web`, `agestyles-business-web` y `agestyles-storefront-web` bajo `ernestoartime`.

GitHub Container Registry puede dejar paquetes nuevos privados inicialmente. Antes del pull en el VPS, el dueño debe escoger una de estas opciones para cada paquete:

- **Recomendado para estas webs públicas:** hacer públicos los paquetes en la configuración de GitHub Packages. Los bundles y el código de servidor son artefactos de la aplicación pública y no contienen claves Admin/Vendor.
- Mantenerlos privados y configurar en el VPS una credencial con permiso mínimo `read:packages`; iniciar sesión en `ghcr.io` por un canal seguro. No guardar esa credencial en el monorepo ni compartirla en chat. Protege el archivo Docker config del usuario del despliegue con permisos `600`.

No continuar hasta que el método de pull haya sido comprobado por el dueño. La disponibilidad y visibilidad del paquete es un gate explícito; este flujo no cambia la configuración de GitHub Packages.

## 3. Preparar el tag en el VPS

En la raíz del monorepo del VPS, crea `.env.frontend-images` con el tag exacto del resumen de Actions:

```dotenv
AGESTYLES_GHCR_OWNER=ernestoartime
AGESTYLES_IMAGE_TAG=sha-<commit>-run-<id>-attempt-<intento>
```

Protege el archivo (`chmod 600 .env.frontend-images`). No escribas una clave de registro en este archivo. Las rutas Compose necesitan que sigan existiendo los archivos privados actuales de cada stack (`apps/commerce-api/.env` para el servicio API del stack buyer y `.env.storefront-web` para Next).

El Compose base conserva los contextos `build` locales para el flujo de desarrollo. Hay un override por stack y cada uno cambia solo la referencia `image` del frontal correspondiente, sin añadir servicios de los otros stacks. Los comandos de este runbook siempre usan `pull` y `up --no-build`. No ejecutes `up` sin `--no-build` con estos archivos combinados ni añadas `--build`.

## 4. Actualizar solo el frontal elegido

Desde la raíz del monorepo, elige **un** bloque y sustituye `--env-file` por el archivo creado arriba. `pull` descarga la imagen; `up --no-build` recrea únicamente ese servicio con la imagen descargada.

```sh
docker compose --env-file .env.frontend-images -f infra/compose/buyer-web.yaml -f infra/compose/buyer-web.images.yaml pull buyer-web
docker compose --env-file .env.frontend-images -f infra/compose/buyer-web.yaml -f infra/compose/buyer-web.images.yaml up -d --no-build buyer-web
curl -fsS http://127.0.0.1:18083/healthz
```

```sh
docker compose --env-file .env.frontend-images -f infra/compose/seller-web.yaml -f infra/compose/seller-web.images.yaml pull seller-web
docker compose --env-file .env.frontend-images -f infra/compose/seller-web.yaml -f infra/compose/seller-web.images.yaml up -d --no-build seller-web
curl -fsS http://127.0.0.1:18085/healthz
```

```sh
docker compose --env-file .env.frontend-images -f infra/compose/storefront-web.yaml -f infra/compose/storefront-web.images.yaml pull storefront-web
docker compose --env-file .env.frontend-images -f infra/compose/storefront-web.yaml -f infra/compose/storefront-web.images.yaml up -d --no-build storefront-web
curl -fsS http://127.0.0.1:18084/healthz
```

Después, comprueba la portada HTTPS correspondiente y el flujo público que haya cambiado. `up` se limita al nombre de servicio indicado; no ejecutar sin nombre de servicio ni añadir `--build`. API, gateways, dominios, puertos y Cloudflare no se modifican.

## 5. Reversión

Guarda el tag anterior hasta verificar la nueva versión. Para volver atrás, cambia `AGESTYLES_IMAGE_TAG` al tag anterior, vuelve a hacer `pull` y repite `up -d --no-build` para el mismo frontal. No borres tags ni imágenes durante la reversión.

## Límites

- El workflow solo acepta `main`; no publica cambios que estén únicamente en un checkout local.
- GitHub Actions compila bundles y Next standalone, y construye imágenes desde los Dockerfiles runtime existentes. No contiene la API ni los gateways.
- Las imágenes están separadas por frontal y commit; el tag incluye run e intento para evitar reusar un tag cuando se repite una publicación.
- Este runbook no autoriza un despliegue automático, cambio de DNS, reinicio de otros servicios, limpieza de Docker ni promoción a producción.

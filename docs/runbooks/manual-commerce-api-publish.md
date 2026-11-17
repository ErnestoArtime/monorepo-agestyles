# Publicación manual de Commerce API

Este flujo construye la imagen de `apps/commerce-api` en GitHub Actions y la publica en GHCR. No construye en el VPS y no despliega automáticamente. Solo se usa para actualizar el servicio `commerce-api` del Compose Buyer; gateways, frontends, PostgreSQL, Redis, dominios y túnel quedan fuera.

## Publicar la imagen

1. Confirma que el commit que quieres publicar está en `main` y que **Monorepo checks** terminó correctamente para ese mismo SHA.
2. En GitHub abre **Actions → Publish commerce API image → Run workflow**, elige `main` y ejecútalo.
3. Copia del resumen el tag inmutable `sha-<commit>-run-<id>-attempt-<intento>`.
4. En **Packages**, comprueba la visibilidad de `agestyles-commerce-api` bajo `ernestoartime`. Para un pull anónimo en el VPS, el paquete debe ser público. Si es privado, configura antes una credencial de solo lectura en el VPS; no guardes el token en este repo ni en el runbook.

El workflow genera valores aleatorios desechables para `DATABASE_URL`, `JWT_SECRET` y `COOKIE_SECRET`, junto al Redis loopback requerido por la configuración de compilación. Los pasa como secreto temporal de BuildKit. No utiliza las credenciales del VPS, no contacta PostgreSQL/Redis y borra el archivo al acabar. La configuración real de ejecución sigue llegando de `apps/commerce-api/.env` en el host.

## Preparar el VPS

Antes del pull, revisa el espacio disponible y confirma que hay margen para descargar la imagen conservando la actual para rollback. No ejecutes `docker system prune`, no borres volúmenes y no construyas allí.

En la raíz del checkout del monorepo del VPS, añade el tag al archivo protegido `.env.frontend-images`:

```dotenv
AGESTYLES_GHCR_OWNER=ernestoartime
AGESTYLES_IMAGE_TAG=sha-<commit>-run-<id>-attempt-<intento>
```

Protege el archivo con permisos `600`. No incluyas secretos en él. Verifica que `apps/commerce-api/.env` existe: Compose lo usa como configuración privada del contenedor y como archivo de secreto únicamente durante un build local.

## Actualizar únicamente la API

Desde la raíz del monorepo en el VPS, ejecuta:

```sh
docker compose --env-file .env.frontend-images -f infra/compose/buyer-web.yaml -f infra/compose/buyer-api.images.yaml pull commerce-api
docker compose --env-file .env.frontend-images -f infra/compose/buyer-web.yaml -f infra/compose/buyer-api.images.yaml up -d --no-build commerce-api
docker inspect --format '{{.Config.Image}} {{.State.Health.Status}}' agestyles-buyer-api
curl -fsS http://127.0.0.1:19081/health
```

Comprueba que el contenedor aparece con el tag esperado y estado `healthy`. Para confirmar que la ruta de tracking está registrada, envía una solicitud que incluya la clave publicable actual pero ninguna sesión de customer: debe devolver `401`; `404` en esa ruta indica que el runtime no cargó el endpoint. La prueba completa de ownership requiere un pedido limpio conocido y sesiones sintéticas de customer dueño/ajeno; no uses pedidos históricos ni crees fulfillments en la beta compartida.

Este despliegue del API puede interrumpir brevemente las llamadas de compra. No ejecuta migraciones ni modifica datos. No continúes con la prueba de tracking si el healthcheck falla o si la imagen desplegada no coincide con el tag esperado.

## Reversión

- **Antes de otra publicación GHCR:** retira el override `infra/compose/buyer-api.images.yaml` de los comandos y recrea solo el servicio con el Compose base para volver a `agestyles/commerce-api:buyer-preview`, que debe seguir presente localmente:

  ```sh
  docker compose -f infra/compose/buyer-web.yaml up -d --no-build commerce-api
  ```

- **Después de publicar una versión previa GHCR:** cambia `AGESTYLES_IMAGE_TAG` al tag anterior, vuelve a hacer `pull` y `up -d --no-build commerce-api` con ambos archivos Compose.

Verifica de nuevo health y el funcionamiento básico de las rutas Store/Vendor. No borres la imagen anterior hasta completar la revisión y conservar un rollback probado.

## Límites

- Solo acepta `main` y requiere CI exitoso para el SHA exacto.
- Publica una imagen; no descarga ni reinicia automáticamente el servicio del VPS.
- El gateway buyer no expone Admin API ni Vendor API; conserva sus rutas actuales.
- El runbook no autoriza cambios de DNS, limpieza Docker, cambios en Supabase ni cutover.

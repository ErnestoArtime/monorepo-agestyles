# AG-64 — Continuación 25 nov 2026 (CI del PR #6, bloqueos B1–B6, poda de disco, AG-12, despliegue de la API)

Fecha: 25 nov 2026. Rama: `muse/revisiones-2026-11-25` (la misma del PR #6, AG-63). Base: `main` en `e1905b3`. Nada fusionado a `main` por Muse; ningún PR fusionado. Nada desplegado ni escrito en producción (solo lecturas, salvo la poda de disco del VPS, que no toca ningún contenedor ni volumen de datos).

## 1. CI del PR #6 — en verde

Run **45571406903**, workflow "Monorepo checks" (`.github/workflows/ci.yml`), evento `pull_request`, head SHA `34081b5` (= cabeza de `muse/revisiones-2026-11-25`), base `main` e1905b3. Status `completed`, conclusión **`success`**, 25 nov 07:51:24–08:02:47 UTC. Único job `typecheck`: completed/success, sin pasos fallidos. https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/45571406903

Verificación local en el VPS: el test nuevo de la rama pasa contra el `dist` existente (`node test/purge.test.ts` → `product-events purge: ok`). Consecuencia: el PR #6 es fusionable por CI y el bloqueo **B3** de AG-63 queda satisfecho para 34081b5. No hizo falta ningún arreglo en la rama.

## 2. Bloqueos de publicación de Tienda y Catálogo

### B1 — Identidad legal / devoluciones: BLOQUEADO, decisión de Ernesto

Confirmado en el código actual: `apps/storefront-web/src/app/terminos/page.tsx:28-29` (identidad legal del responsable) y `:60` (política de devoluciones, cambios y cancelaciones) siguen con marcadores `[PENDIENTE]`. En vivo sigue sin estar: `https://catalogo.eav-labs.com/terminos` → **404** (la imagen de Catálogo en vivo es anterior a AG-59); `https://tienda.eav-labs.com/` → 200. Nada que hacer aquí salvo que Ernesto defina responsable legal y política.

### B2 — Variables de GitHub Actions: corregir antes de publicar (3 variables)

Evidencia en vivo (bundles reales, no docs): Tienda contiene `https://agestyles-api.eav-labs.com` (1 vez) y cero ocurrencias de `descargas.eav-labs.com/agestyles-lab`; Negocio contiene `https://agestyles-api.eav-labs.com/negocio` y `https://tienda.eav-labs.com`, cero de `agestyles-lab`; Catálogo contiene 58 referencias a `agestyles-api.eav-labs.com` y 0 al lab. En el VPS, `.env.storefront-web` (`MEDUSA_BACKEND_URL=https://agestyles-api.eav-labs.com`) y `.env.buyer-web` (`BUYER_WEB_MEDUSA_URL=https://agestyles-api.eav-labs.com`) son coherentes con producción.

En cambio, el runbook y el `.env.example` seguían tabulando el lab. **Corregido en esta rama** (no en GitHub Settings, que no se puede tocar desde el VPS): `docs/runbooks/manual-frontend-publish.md:13-15` y `apps/storefront-web/.env.example:1` ahora dicen producción. El default de `tools/scripts/build-business-web.mjs:8` sigue en lab a propósito: solo afecta a builds locales de laboratorio.

Lo que falta (acción de Ernesto en GitHub → Settings → Secrets and variables → Actions → Variables), si aún conservan los valores del runbook — no se pudieron leer desde el VPS:

| Variable | Valor actual según runbook (lab) | Valor correcto (producción) |
|---|---|---|
| `AGESTYLES_BUYER_MEDUSA_URL` | `https://descargas.eav-labs.com/agestyles-lab` | `https://agestyles-api.eav-labs.com` |
| `AGESTYLES_STOREFRONT_MEDUSA_URL` | `https://descargas.eav-labs.com/agestyles-lab` | `https://agestyles-api.eav-labs.com` |
| `AGESTYLES_BUSINESS_MEDUSA_URL` | `https://descargas.eav-labs.com/agestyles-seller` | `https://agestyles-api.eav-labs.com/negocio` |

Sin cambios (coherentes con lo vivo): `AGESTYLES_BUYER_APP_URL=https://tienda.eav-labs.com`, `AGESTYLES_STOREFRONT_SITE_URL=https://catalogo.eav-labs.com`, `AGESTYLES_GHCR_OWNER=ernestoartime`. `AGESTYLES_MEDUSA_PUBLISHABLE_KEY` debe ser la `pk_…` de producción; Ernesto debe comprobar que coincide con la que usan `.env.buyer-web`/`.env.storefront-web` en el VPS, sin pegarla en ningún chat ni doc. Las URLs se incrustan en el bundle en build: un valor erróneo no se arregla en runtime.

### B3 — CI del SHA a publicar: en verde para `e1905b3`

Run **45570588900** ("Monorepo checks" #364): `head_sha=e1905b3`, evento `push`, rama `main`, `completed` + `success`, 25 nov 07:45:09–07:56:43 UTC. El gate de `publish-frontends.yml` exige ≥1 run `push` en `main` con ese SHA en `completed`+`success`: se cumple. Advertencia: si se fusiona el PR #6 antes de publicar, `main` dejará de ser `e1905b3` y habrá que re-verificar el CI del nuevo SHA (el workflow solo acepta `main` y exige CI verde de ese SHA exacto).

### B4 — GHCR: flujo de frontend nunca ejercido; riesgo de rollback documentado

- `publish-frontends.yml/runs` → lista vacía (0 runs); la página del workflow dice "0 workflow runs / This workflow has no runs yet". En el VPS: 0 imágenes GHCR de frontend; locales presentes: `agestyles/buyer-web:local`, `agestyles/storefront-web:local`, `agestyles/seller-web:local`. Negocio corre `agestyles/seller-web:local`, no GHCR.
- Visibilidad por flujo de token anónimo OCI: `agestyles-commerce-api` concede token de pull anónimo (pública); los tres paquetes de frontend devuelven `DENIED` (aún no existen). La API pública de GitHub devuelve 401 sin autenticación, así que no sirve para distinguir público/privado.
- Procedimiento (según runbook + workflows): Ernesto dispara `Publish frontend images` → el workflow valida las 7 variables, exporta los 3 bundles, crea el tag `sha-<commit>-run-<id>-attempt-<n>` y publica `ghcr.io/ernestoartime/agestyles-{buyer,business,storefront}-web:<tag>` (sin alias `latest`). En el VPS, crear `.env.frontend-images` (hoy no existe) con `AGESTYLES_GHCR_OWNER=ernestoartime` + `AGESTYLES_IMAGE_TAG=<tag>`, `chmod 600`; por frontal, `pull` y `up -d --no-build`; verificar `http://127.0.0.1:18083/healthz` (Tienda), `:18084` (Catálogo), `:18085` (Negocio) — hoy los tres dan 200 — y portada HTTPS 200.
- Riesgo de rollback: no existe ningún tag GHCR previo de frontend al que volver; el primer publish creará los 3 paquetes, que según el runbook "puede dejar paquetes nuevos privados inicialmente". Gate explícito antes del pull: hacer públicos los 3 paquetes en GitHub Packages o configurar en el VPS una credencial `read:packages` (permiso 600). El rollback real hoy es volver a las imágenes locales actuales (digests `buyer-web:local sha256:bdf0fcd8…`, `storefront-web:local sha256:5d00c0e4…`, `seller-web:local sha256:99ba6ff6…`, más tags locales `rollback-before-ag52`). No borrar tags ni imágenes durante la reversión; no hacer `docker system prune` sin autorización.

### B5 — Disco: resuelto (95% → 76%)

`/dev/sda1`, 193 GB: **183 GB usados / 11 GB libres (95%) → 145 GB usados / 48 GB libres (76%), ~37 GB liberados.** Ningún contenedor parado, recreado ni tocado; 91 contenedores en ejecución antes y después (diff de nombres vacío); verificados en healthy `backend-api-1`, `agestyles-buyer-api`, `commerce-api`, `postgres` de producción, `storefront-web`, `buyer/seller-web`, `backend-db-1` y `coliseo-mister-transport`.

Podado (todo verificado antes como sin contenedor y reconstruible, borrado por ID/nombre explícito, sin `prune -a` ni `--force`):
- 41 imágenes sin contenedor (~33 GB): 2 GHCR `agestyles-commerce-api` superadas (2,56 GB c/u, re-descargables), `openwa-test:v0817` y `openwa-openwa:pre-v0817` (3,16 + 3,38 GB), 6 snapshots `eav-downloads` de hace 4 semanas, 23 versiones viejas de Supabase en ECR (re-descargables de `public.ecr.aws`), `jc21/nginx-proxy-manager:2.15.0` (1,79 GB), `lavia-{migrate,api,web}:latest` superadas, 3 tags remesas, `coliseo-mister-browser:mobile`.
- Caché de build no usada: 2,795 GB exactos (`docker builder prune -f`).
- 67 volúmenes anónimos huérfanos (~3,2 GB): solo nombres hex, LINKS=0, creados 22–24 oct 2026; muestra inspeccionada: `initdb` de Postgres fresco y vacío, sin datos de usuario.
- Journal systemd: 1,1 GB (`--vacuum-size=200M`; 1,3 GB → 195,5 MB).

Quedó sin podar: imágenes en uso (51 activas, 39,89 GB) y `lavia/api:0.1.0` (la usa el contenedor parado `lavia-migrate-1`); `lavia/web:0.1.0` (el `rmi` por ID lo rechazó sin `--force` porque comparte ID con `lavia/web:baseline-3250c351b7b1`; no se forzó); tags rollback recientes (~115 MB, red de seguridad de Ernesto); 9 volúmenes huérfanos con nombre (~262 MB: `lavia-feature-test_*`, `supabase_db_remesas`, `supabase_db_agestyles-supabase-replay`, `supabase_edge_runtime_remesas` — volúmenes de BD/proyecto que podrían reutilizarse, decisión de Ernesto); volúmenes en uso (28, 14,65 GB, mayor `openwa_openwa-data` 12,82 GB); caché de build activa (8,29 GB); logs (logrotate / contenedores, no truncados para no tocar contenedores en ejecución).

Auditoría completa en el VPS: `/tmp/disk-audit-2026-11-25/` (`prune.sh`, `prune.log`, `system-df-v.txt`, `images/volumes/ps-before|after.txt`). Informe y script también en el workspace local (`workspace/disk-audit-vps/`). Nota: el daemon Docker respondía muy lento con el disco casi lleno; cada `rmi` pasó de ~8 min a segundos a medida que se liberaba espacio. Un pull de API (2,56 GB) y uno de frontends (~0,63 GB) caben ahora con margen; verificar `df` antes de cada pull.

### B6 — Disparo del workflow: solo manual, lo hace Ernesto

`.github/workflows/publish-frontends.yml`: `on:` es solo `workflow_dispatch:` (sin `push`, `schedule` ni `workflow_run`); el job exige `github.ref == 'refs/heads/main'`. Vías documentadas: (a) web de GitHub — Actions → "Publish frontend images" → Run workflow → rama `main` (requiere acceso de escritura); (b) `gh workflow run publish-frontends.yml --ref main` (requiere `gh` autenticado); (c) REST API `POST .../actions/workflows/publish-frontends.yml/dispatches` con `{"ref":"main"}` (requiere token con escritura en Actions). Desde el VPS ninguna es posible hoy: `gh` no está instalado ni autenticado, y no hay ni debe inventarse token. Contraste: `publish-commerce-api.yml` sí tiene además `workflow_run` sobre "Monorepo checks" en `main` (por eso la imagen de la API ya se publicó sola).

## 3. AG-12 — contraseña no encontrada; pista nueva sobre el mecanismo

Búsqueda exhaustiva en el VPS: `AGESTYLES_LAB_SEEDED_PASSWORD` aparece en 21 archivos del repo, todos sin valor (scripts `verify-*.mjs` la leen del entorno, `.env.example` solo el nombre, `seed.ts`, `ci.yml` con valor efímero solo para la base desechable de CI, no válido para el lab). Los 5 `.env` reales del repo, `infra/compose/` (sin `.env`; `mercur-lab.yaml` solo define postgres/redis/minio) y el entorno del contenedor de la API del lab (`env_file` = `apps/commerce-api/.env`): 0 coincidencias. El generador `tools/scripts/mercur-lab-env.mjs` nunca la escribe. El seed (`apps/commerce-api/src/scripts/seed.ts`) toma `SELLER_PASSWORD` del entorno sin valor por defecto y falla si falta. Conclusión: el lab se sembró pasando la contraseña inline una sola vez y nunca se persistió en disco.

Estado del lab (solo lecturas): API del lab sana (`127.0.0.1:19081/health` → 200); logs desde el 24 nov: 0 líneas con 500 y 0 menciones a `/vendor/orders` (los del incidente 16–17 nov ya no existen; contenedor recreado el 24 nov). Enlace colgando reconfirmado por SELECT en la BD del lab: 2 en total (`fulfillment` 3 filas, `order_fulfillment` 5 filas); B1 #56 (`order_01M7KM63QFAHJ96HF6D1K1AF1J`, display 56, creada 2026-11-17 02:08:14 UTC) → `ful_01M7KPQJMZY37PNA686JF002QA` sin fila; el otro es Sole Society #55 → `ful_01M7KPCE0W6T1SJ8A35YAHNAG8`.

Pista nueva sobre el mecanismo (estática, no es prueba): el `query-config` de órdenes del vendor de Mercur (`@mercurjs/core`, `api/vendor/orders/query-config.js`) incluye **`fulfillments.*`** en los campos por defecto de listar y recuperar, así que `GET /vendor/orders` puebla los fulfillments de cada pedido vía Medusa query/MikroORM. Un enlace colgando es un candidato plausible de 500 — el mismo archivo documenta un 500 análogo conocido (`returns.items.reason.*` revienta en la expansión populate de MikroORM). No prueba causalidad: Sole Society #55 también tiene un enlace colgando y su matriz pasó 54/54 según AG-63; podría depender del conjunto/paginación o venir de otra relación (`items.offer.*`, `cart.payment_collection.*`, etc.).

Qué hace falta para reproducir (exacto): (1) la contraseña original con la que se sembró `kickz@mercur.dev` (mín. 12 caracteres) — solo la tiene quien sembró el lab — o resembrar una copia desechable de la BD del lab con una contraseña conocida; crear un miembro Kickz nuevo en el fixture vivo no sirve sin autenticarse primero como propietario, y tocar el fixture vivo no está autorizado. (2) Dónde ponerla: archivo env privado nuevo en el VPS, p. ej. `.env.lab-private` en la raíz del repo con `chmod 600` (no versionado; no añadirla a `apps/commerce-api/.env` salvo que se quiera que el contenedor de la API la tenga tras recrearlo); los scripts la leen del entorno del proceso, no del `.env` de la API. (3) Reproducción: `AGESTYLES_LAB_SEEDED_PASSWORD=... node apps/commerce-api/scripts/verify-kickz-store-roles.mjs` (o login manual `POST /auth/member/emailpass` como `kickz@mercur.dev` y `GET /vendor/orders` por el gateway de vendedores `127.0.0.1:19183` con cabecera `x-seller-id` de B1), guardando `request-id` y el stack trace de Medusa. Si ya no reproduce, repetir la matriz Kickz/B2 y probar en copia desechable si borrar el enlace colgando cambia el resultado — nunca en el fixture vivo sin autorización.

## 4. Despliegue de la API con AG-62/AG-57 — imagen ya publicada, paso a paso listo

Hay dos servicios `commerce-api` distintos y el runbook `manual-commerce-api-publish.md` solo cubre el segundo:

- **(A) API de producción** (la que sirve `agestyles-api.eav-labs.com`): proyecto Compose `agestyles-commerce-production`, `infra/compose/commerce-production-data.yaml:4-5` (`image: ${AGESTYLES_PRODUCTION_IMAGE:?…}`), contenedor `agestyles-commerce-production-commerce-api-1`, puerto local `19085`, health OK. Su imagen viene del fichero privado `/home/ernesto/.config/agestyles-commerce-production/compose.env` (no se leyó su contenido). Imagen actual: `ghcr.io/ernestoartime/agestyles-commerce-api@sha256:bb917a77…` (tag `sha-1dc0feb…-run-45352055962-attempt-1`, anterior a AG-62/AG-57).
- **(B) API del lab/buyer** (`agestyles-buyer-api`, imagen local `agestyles/commerce-api:buyer-preview`, puerto `19081`): es la que actualiza el runbook. Desplegar ahí no actualiza producción.

**La imagen con AG-62+AG-57 YA está publicada** (no hace falta re-disparar el workflow): run **45572104045** ("Publish commerce API image", `workflow_run` tras el CI de `e1905b3`): `head_sha=e1905b3`, `completed` + `success`, 25 nov 07:56:49–07:59:35 UTC. Tag determinista: **`sha-e1905b3d39578aa8419103355fd8074ba80910d6-run-45572104045-attempt-1`**. (También existe la de `213c502`: run 45570421245, success.) El digest `sha256:…` lo escribe el workflow en el resumen del run ("Imagen para producción: `<image>@<digest>`"); Ernesto lo copia de https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/45572104045. Diff `1dc0feb..e1905b3`: 7 archivos (ruta `accept` de cotizaciones AG-62, `packages/domain/src/tracking.ts` AG-57, tests y docs). **No hay migraciones nuevas**, así que el despliegue no requiere migración.

Paso a paso para la API de producción (A):
1. Ernesto (GitHub): copiar el digest de la imagen del resumen del run 45572104045.
2. VPS (con autorización): en `/home/ernesto/.config/agestyles-commerce-production/compose.env`, poner `AGESTYLES_PRODUCTION_IMAGE=ghcr.io/ernestoartime/agestyles-commerce-api@sha256:<digest-de-e1905b3>`. No tocar el resto del fichero (contiene secretos de producción). Guardar el valor anterior (`…@sha256:bb917a77…`) como rollback.
3. VPS: `df -h /` (se necesitan ~2,6 GB libres conservando la actual; hoy 48 GB) y `docker images | grep agestyles-commerce-api`.
4. VPS: `docker compose --env-file /home/ernesto/.config/agestyles-commerce-production/compose.env -f infra/compose/commerce-production-data.yaml pull commerce-api` (la API es pública en GHCR, pull anónimo verificado por token).
5. VPS: `docker compose --env-file … -f infra/compose/commerce-production-data.yaml run --rm commerce-api pnpm migrate` (sin migraciones nuevas en este diff, debe no aplicar nada) y luego `up -d --wait commerce-api`.
6. VPS: `curl --fail http://127.0.0.1:19085/health` → `OK`; `docker inspect --format '{{.Config.Image}} {{.State.Health.Status}}' agestyles-commerce-production-commerce-api-1` debe mostrar el digest nuevo y `healthy`; comprobar en logs que ya no aparece el `TypeError: Cannot read properties of undefined (reading 'release')` de AG-62, y que `/store/agestyles/exchange-rate` sigue respondiendo (tasa 970 CUP, AG-01 cerrada).
7. Verificación funcional AG-57/AG-62 (no ejecutada; requiere datos reales): entrega parcial → `partially_shipped` en vez de `shipped`; doble accept de cotización → mismo grupo. No usar pedidos históricos de producción para probarlo sin autorización.
8. Rollback (A): volver a poner en `compose.env` la imagen anterior `…@sha256:bb917a77…`, `pull` (ya está local) y `up -d --wait commerce-api`; re-verificar health. No borrar la imagen anterior hasta completar la revisión.

Variante lab (B): según `docs/runbooks/manual-commerce-api-publish.md`: añadir el tag al `.env.frontend-images` (hoy inexistente, `chmod 600`), `pull`/`up -d --no-build commerce-api` con `buyer-web.yaml` + `buyer-api.images.yaml`, verificar `http://127.0.0.1:19081/health`. Rollback: recrear sin el override. Esto no toca producción.

## 5. Qué NO se verificó

- Ejecución real de CI de esta rama tras los nuevos commits de documentación (corre al hacer push; el CI verificado en verde es el de 34081b5).
- Listado de tags en GHCR por `tags/list` (una llamada quedó sin aprobación a tiempo y no se reintentó; el tag de la API se deduce de forma determinista del workflow + run exitoso).
- Los valores actuales de las 3 variables en GitHub Settings (no legibles desde el VPS; los del runbook eran de lab).
- Reproducción del 500 de AG-12 (bloqueada por la contraseña, ver §3).
- Verificación funcional de AG-57/AG-62 en producción (requiere despliegue + datos reales).
- Nada en Android. Nada de producción fue desplegado, migrado ni escrito en esta continuación.

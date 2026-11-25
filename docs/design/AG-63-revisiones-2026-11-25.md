# AG-63 — Revisiones cruzadas 25 nov 2026 (AG-62, AG-61, AG-57, AG-50, AG-05; cierre AG-01; publicación Tienda/Catálogo)

Fecha: 25 nov 2026. Rama: `muse/revisiones-2026-11-25`. Base: `main` en `213c502` (+ `e1905b3` docs de Codex). Nada fusionado a `main` en esta rama; ningún PR fusionado por Muse. No se tocó producción salvo lecturas (curl, logs, `SELECT`).

## 1. AG-62 — conforme

Tarea: liberar correctamente el bloqueo al aceptar cotizaciones y verificar reintentos simultáneos. Fix ya en `main` (`213c502`, Codex).

**Causa raíz (confirmada contra el Medusa instalado 2.22.3).** El código previo hacía `const lock = await locking.acquire(...)` y `await lock.release()` en el `finally`. Pero `ILockingModule.acquire()` devuelve `Promise<void>`: `lock` era siempre `undefined`. El `finally` lanzaba `TypeError: Cannot read properties of undefined (reading 'release')` en todas las aceptaciones que llegaban al lock, después de que la respuesta 200 ya se había enviado, y el manejador de errores intentaba enviar un 500: `Cannot set headers after they are sent to the client` (CI #159, run 44208320867, SHA `a1d1c37`). Los argumentos `{timeout, ttl}` de `acquire` eran además inválidos y se ignoraban. No era una carrera rara: era un fallo determinista.

**El fix.** La ruta ya no usa `acquire`/`release` manuales: `locking.execute(\`agestyles-quote:${quote.cart_id}\`, ..., { timeout: 30 })` y una única respuesta después de liberar el lock. Toda la validación se movió dentro del lock; un segundo accept concurrente espera, relee y cae en `already_accepted` devolviendo el mismo grupo. El verificador lanza los dos accepts en `Promise.all` y aserta mismo `order_group_id` y mismos hijos.

**Verificación ejecutada.** `node test/order-quotes.test.ts` (packages/domain) PASS; prettier PASS sobre la ruta y el verificador; `tsc --noEmit` en `apps/commerce-api` PASS. CI de `213c502` en verde (run 45568991877): dos aceptaciones simultáneas devolvieron el mismo grupo y los mismos dos pedidos, y el registro ya no contiene la excepción de `release` ni el error de cabeceras. La prueba HTTP en vivo contra el lab NO se ejecutó: la imagen del lab es anterior al fix y reconstruirla sería un despliegue.

**Observaciones menores (no bloquean).** Errores fuera del `try` interno (listado de cotización, carga de carrito, recotización) dan 500 sin estructura, como antes. Si un segundo accept espera más de 30 s, el provider lanza 409 genérico en vez del body `acceptance_pending_reconciliation`. Si Redis pierde el lease a mitad de workflow, `execute` descarta el resultado aunque el grupo exista; el reintento se recupera por `already_accepted`.

**Pendiente:** desplegar la API (la imagen de producción es `1dc0feb`, anterior al fix).

## 2. AG-61 — conforme

Tarea: corregir retención de eventos y verificar CI de AG-59.

**Revisión.** El cambio real es una línea en `packages/product-events/src/service.ts:83`: `softDeleteProductEvents` por `deleteProductEvents` en `purgeOlderThan`. Borra solo eventos con `created_at` estrictamente anterior al corte de 90 días (`PRODUCT_EVENT_RETENTION_DAYS = 90`); lo del corte exacto sobrevive. El job diario (04:30) repite hasta 20 pasadas o 0 eliminados. Migración `Migration20261124120000` correcta y reversible; ruta `POST /store/agestyles/events` con doble validación zod, dedup 60 s y rate limit en memoria; la regla existe en el gateway de producción (mismo script, prefijo vacío, puerto 19085).

**Verificación ejecutada.** Test de validación existente PASS; prueba focalizada de purga contra el código compilado (2 vencidos, 1 en el corte, 1 vigente → `removed: 2`, solo los vencidos); test de seguimiento `tracking.test.ts` PASS. **Nuevo test commiteado en esta rama:** `packages/product-events/test/purge.test.ts` (mismo escenario, más segunda llamada sin nada que borrar), y el script `test` del paquete ahora es `pnpm build && node test/product-events.test.ts && node test/purge.test.ts` (la purga se prueba contra la salida compilada; `pnpm test` del paquete pasa y `pnpm typecheck` pasa). Nota: el primer intento de importar el servicio falló por la interop ESM/CJS (`dist` es CommonJS; la clase vive en `.default` del objeto de exports); quedó documentado en el test.

**Observaciones menores (no bloquean).** El parche Metro (`1dc0feb`) pierde la rama `.zip/` (sin assets `.zip` hoy; exports comprobados). Tope de purga 10.000/día. El rate limit confía en `X-Forwarded-For`. El job de purga solo deja rastro si borra o si falla; no hay alerta si deja de ejecutarse (sin líneas de purga en 24 h de logs, lo esperable: aún no hay eventos de 90 días).

## 3. AG-01 — cerrada por AG-54

El bloqueo original (`/store/agestyles/exchange-rate` responde `null`; falta el valor CUP o el token de elTOQUE) ya no existe. Verificado en vivo el 25 nov por tres vías (HTTPS pública, gateway local 19186, API directa 19085): `{"base_currency":"usd","currency_code":"cup","rate":970,"source":"elTOQUE (web)","updated_at":"2026-11-25T07:30:03Z"}`. La metadata de la tienda en producción guarda el mismo valor y los logs muestran el job actualizando la tasa cada 30 min. El token oficial sigue sin existir, pero AG-54 lo hizo innecesario por diseño (respaldo web). Queda solo la verificación en Android, que sigue en AG-54, y la dependencia conocida de que Cloudflare siga dejando pasar la cabecera de móvil.

## 4. AG-57 (entrega parcial) — conforme en código

`965e036` elimina el atajo `anyDelivered → "shipped"` en `packages/domain/src/tracking.ts`: entregar 1 de 3 unidades ahora da `partially_shipped` en vez de `shipped`. `ec94f64` amplía el verificador HTTP (3 unidades, entrega 1 y luego 2) y la prueba HTTP pasó en GitHub Actions (run 45566224944). Tests de `packages/domain/test/` (6 archivos) PASS en el VPS. La API de producción aún no tiene el fix (imagen del 24 nov, anterior al fix del 25 nov): pendiente desplegar. Pendiente original que sigue: prueba en Android.

## 5. AG-50 — conforme en código

`alignNewDemoVariantInventory` (`22d4ac2`, `apps/commerce-api/src/scripts/demo-stores.ts`): tras crear cada oferta demo, re-vincula la variante al artículo de inventario de la oferta con `batchLinksWorkflow`, borrando el vínculo anterior solo si es único, sin SKU y sin niveles; en cualquier otro caso lanza error. No borra artículos. Sin cambios encima de `22d4ac2` en HEAD. La regularización de los 50 vínculos en producción (52/52 alineadas) está documentada en `acddb41`; no se re-verificó por conteo en esta revisión. Pendiente: ejecutar el generador en laboratorio antes de la próxima siembra.

## 6. AG-05 — conforme con 2 hallazgos menores

La no-conformidad de Claude del 18 nov (31 variantes con `sku` vacío; el CSV no reconocía productos por SKU) está resuelta en código por `e70cbad` (AG-29): `apps/business-app/lib/offer-skus.ts` carga los SKU desde `/store/offers` y `catalog-import.tsx` los usa en `loadSellerProducts()`; usa `POST`, no `PATCH`, para actualizar variante. Verificado en vivo: `/store/offers` en producción devuelve ofertas con `sku` (p. ej. `AGS-OF-1010`) y el bundle de Negocio desplegado contiene `catalog-import` y `store/offers`.

Hallazgos menores: (1) `loadOfferSkus` se invoca con `.catch(() => new Map())`: si falla la carga de ofertas, el emparejamiento vuelve silenciosamente al comportamiento roto sin avisar al usuario. (2) No hay tests de `offer-skus` ni de `catalog-import`; usa `regions[0]` (seguro hoy: una sola región, Cuba/USD). Ninguno bloquea el cierre de la revisión. No se ejecutó una importación CSV real (escritura).

## 7. AG-12 — causa raíz no determinada

La reproducción en laboratorio no se pudo ejecutar: falta `AGESTYLES_LAB_SEEDED_PASSWORD` (login `kickz@mercur.dev`); no está en ningún `.env` revisado. Los logs del lab se recrearon el 24 nov y no cubren la ventana del incidente (16–17 nov): cero líneas de `/vendor/orders` y cero 500 en 48 h.

**Pista nueva (solo lectura, BD del lab).** El pedido B1 #56 (`order_01M7KM63QFAHJ96HF6D1K1AF1J`, grupo `og_01M7KM63Q1QTRECRSAZHF4KQYW`, 17 nov 02:08) tiene 2 enlaces en `order_fulfillment`, uno colgando: `ful_01M7KPQJMZY37PNA686JF002QA` no tiene fila en `fulfillment`. En todo el lab solo hay 2 enlaces colgando; el otro es del pedido Sole Society #55 del mismo grupo. Corrección a un conteo previo: B1-#56 y B2-#53 no tienen 5 y 3 ítems: son filas de versión de `order_item` de una sola línea cada uno. No se puede afirmar que el enlace colgando cause el 500 (MikroORM suele ignorarlo y Sole Society también tiene uno mientras su matriz pasó 54/54), y no se pudo fijar si el 500 fue antes o después de crearse #56. Es una pista, no una causa raíz.

**Qué haría falta:** (1) `AGESTYLES_LAB_SEEDED_PASSWORD` o un miembro Kickz nuevo; (2) un `GET /vendor/orders` autenticado con `x-seller-id` de B1 en el lab, guardando `request-id` y el stack trace de Medusa; (3) si ya no reproduce, repetir la matriz Kickz/B2 y probar en copia desechable si borrar el enlace colgando cambia el resultado (nunca en el fixture vivo sin autorización).

## 8. Publicación de Tienda y Catálogo — NO hecha

Estado actual verificado: Tienda (`tienda.eav-labs.com`) corre la imagen local `agestyles/buyer-web:local` del commit `0a4e646` (AG-52), **30 commits por detrás de main**; Catálogo (`catalogo.eav-labs.com`) corre una imagen local del 23 nov, anterior a AG-59 (`/terminos` da 404). Negocio corre `1dc0feb` y la API de producción también (`sha256:bb917a77…`). Entre `1dc0feb` y `213c502` no hay ningún cambio de código de frontend (solo API, `packages/domain`, un script de verificación y docs): publicar desde `1dc0feb` o desde `213c502` produce el mismo bundle. Hasta publicarlas, la analítica no registra su tráfico (los frontends actuales no incluyen el tracker de eventos).

El procedimiento documentado es: GitHub Actions → `Publish frontend images` (workflow `publish-frontends.yml`, solo `workflow_dispatch` sobre `main`) → copiar el tag `sha-<commit>-run-<id>-attempt-<n>` → `.env.frontend-images` (chmod 600) en el VPS → `pull` y `up -d --no-build` por frontal → `curl -fsS http://127.0.0.1:18083/healthz` (Tienda) y `:18084/healthz` (Catálogo) → portada HTTPS 200. Reversión por tag anterior.

**Bloqueos (por eso no se publicó):**

- **B1 — Datos legales (decide Ernesto).** Las nuevas páginas legales tienen pendiente identidad del responsable y política de cambios/devoluciones (`4003fad`). Publicar sin eso expondría páginas legales incompletas.
- **B2 — Variables de GitHub sin verificar.** El runbook tabula `AGESTYLES_BUYER_MEDUSA_URL` y `AGESTYLES_STOREFRONT_MEDUSA_URL` como `https://descargas.eav-labs.com/agestyles-lab`, pero los bundles en vivo usan `https://agestyles-api.eav-labs.com` (verificado en el bundle de Tienda y en `.env.storefront-web`). Si las variables aún apuntan al lab, una publicación apuntaría Tienda/Catálogo al laboratorio. Hay que confirmarlas/corregirlas en GitHub antes de publicar.
- **B3 — CI verde para el SHA exacto a publicar.** El workflow lo exige y aborta si falta; no comprobable desde el VPS sin acceso a GitHub.
- **B4 — Visibilidad GHCR sin verificar.** La API anónima devuelve 401 al listar tags; el flujo GHCR nunca se ha ejercido para frontends en este VPS (Negocio se publicó desde una imagen local `agestyles/seller-web:local`, no de GHCR, así que el rollback por tag no tiene tag previo para Tienda/Catálogo; el rollback real hoy sería volver a las imágenes locales actuales, que se conservan).
- **B5 — Disco al 95%.** 193 G, 183 G usados, 11 G libres. El `pull` de las imágenes conservando las actuales para rollback necesita margen; el runbook prohíbe `docker system prune` sin autorización.
- **B6 — El disparo del workflow no se puede hacer desde el VPS.** No hay `gh` autenticado en el VPS; hay que hacerlo en la UI de GitHub o con la API de GitHub.

## 9. Qué NO se verificó

- Ejecución real de CI de esta rama (solo corre al abrir el PR).
- Prueba HTTP en vivo de la aceptación de cotizaciones contra el lab (imagen anterior al fix); cubierta por el CI de `213c502`.
- Comportamiento de `completeCartWithSplitOrdersWorkflow` de Mercur bajo doble accept (idempotencia asumida por la guarda de grupo, no probada en vivo).
- Importación CSV real en AG-05; re-conteo de los 52 vínculos de AG-50 en producción; verificación en Android (AG-11, AG-54, AG-57, AG-58).
- Nada de producción fue desplegado, migrado ni escrito en esta rama, salvo las lecturas indicadas. La publicación de frontends y el despliegue de la API quedan pendientes de Ernesto.

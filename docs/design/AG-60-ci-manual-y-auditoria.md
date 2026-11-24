# AG-60 — Pasos de CI que quedaron para pegar a mano, auditoría y verificación de AG-59 en el laboratorio

Fecha: 24 nov 2026. Autor: muse. Rama: `muse/ci-y-verificacion-lab` (desde `main`
6b35352). Todo el trabajo se hizo en el VPS de desarrollo de Ernesto; nada se
desplegó en producción y ninguna migración tocó la base de producción.

## 1. Qué se tomó y por qué

Ernesto dijo: «toma las que veas que mas puedas avanzar y deja documentado lo
que hiciste». De la revisión de pendientes del 24 nov 2026 se tomaron solo las
que no necesitan decisiones suyas, ni claves externas, ni Android, ni tocar
producción:

- **AG-60 (nueva):** los 4 pasos de CI que quedaron para pegar a mano por el
  403 al subir workflows por API (AG-53 + AG-59).
- **Verificación de AG-59** en el VPS, donde sí hay entorno real (tests,
  typecheck, lockfile, migración de eventos y Lighthouse).
- **AG-10:** el gateway del laboratorio daba 502.
- **Revisión cruzada de AG-51** contra el código.

No se tocó: GA4 (falta measurement ID), Search Console, identidad
legal/devoluciones, AG-01 (tasa CUP), AG-02 (backup), AG-18, AG-28/AG-29,
AG-41, ni nada que necesite claves (S3, Coliseo, SendGrid).

## 2. Los 4 pasos de CI (`.github/workflows/ci.yml`)

El workflow tenía un solo job `typecheck` con 32 pasos. Se añadieron 4
cambios (36 pasos en total), validados con `yaml.safe_load` y con prettier
(`All matched files use Prettier code style!`):

1. `pnpm audit --audit-level=high` como paso 04, justo después de instalar
   dependencias.
2. «Verify manual payment proofs in the disposable lab» como paso 21,
   después del checkout multi-vendedor y antes de los permisos de vendedor:
   `docker run --rm --network host` con `agestyles/commerce-api:ci` y
   `pnpm exec medusa exec ./src/scripts/verify-manual-payments.ts`, con las
   mismas variables de laboratorio que usan los pasos vecinos. Por diseño no
   se cablea `verify-price-revision.mjs`.
3. Sonda de abuso de subidas dentro del paso «Verify seller gateway product
   routes and blocked stock writes»: cuerpo de 70.000 bytes a
   `/agestyles-seller/vendor/agestyles/inventory-movements` y de 8.388.609
   bytes a `/vendor/uploads`; ambos deben devolver 413. La premisa se
   verificó en el código: `tools/scripts/seller-lab-gateway.mjs` devuelve
   413 cuando `content-length` supera 65.536 (u 8 MiB en `/vendor/uploads`).
4. Lighthouse (AG-59, Fase 2): el paso «Build the SEO storefront» se movió
   antes de parar la API desechable, y se añadieron «Audit the SEO storefront
   with Lighthouse» (paso 29, `npx -y lighthouse@12`, preset desktop, páginas
   inicio/tiendas/novedades, `tools/scripts/check-lighthouse-budgets.mjs`) y
   «Upload Lighthouse reports» (paso 30, `if: always()`, artefacto
   `lighthouse-storefront`).

Con esto, `docs/ci/lighthouse-manual-apply.md` y el archivo local
`ci-manual-apply.md` quedan sustituidos como instrucciones manuales: el YAML
ya está en el workflow. No se borran en esta rama; si se fusiona el PR,
conviene archivarlos o borrarlos en un cambio posterior.

## 3. La auditoría falló primero: 5 vulnerabilidades altas

`pnpm audit --audit-level=high` falló (exit 1) en el VPS: 14
vulnerabilidades, 5 altas y 9 moderadas, 0 críticas. Las 5 altas:

- PostCSS GHSA-6g55-p6wh-862q (lectura de archivos vía sourceMap, fijo
  ≥8.5.12) y GHSA-r28c-9q8g-f849 (path traversal, fijo ≥8.5.18).
- image-size GHSA-5p2g-fcmc-qvqq y GHSA-w3rx-r6r6-pgpr (DoS, fijo ≥2.0.3).
- decode-uri-component GHSA-qr28-fpjm-wq7f (DoS, fijo ≥0.5.1).

Cadenas (según `pnpm-lock.yaml`): postcss 8.4.49 ←
`@expo/metro-config@54.0.17`; image-size 1.2.1 ← `metro@0.83.3`;
decode-uri-component 0.2.2 ← `query-string@7.1.3` (← expo-router).

### Decisión: arreglar con overrides, no enviar una puerta roja

Un paso de auditoría en rojo desde la primera ejecución no sirve: se
arreglaron las 5 altas con overrides de pnpm y la auditoría pasa en verde
(exit 0, 6 moderadas, 0 altas, 0 críticas).

### Corrección importante: los overrides van en `pnpm-workspace.yaml`

El primer intento puso los overrides en el `package.json` raíz (`"pnpm":
{"overrides": ...}`), pero eso **reemplazó** el override ya existente de
`'@opentelemetry/api': '1.9.1'` que vive en `pnpm-workspace.yaml`: la sección
`overrides:` del lockfile lo perdió y cambiaron rangos de pares. Se revirtió
(`package.json` volvió a su estado original) y los overrides quedaron en
`pnpm-workspace.yaml`, junto al existente. Pins exactos:

```yaml
overrides:
  '@opentelemetry/api': '1.9.1'
  postcss: '8.5.33'
  image-size: '2.0.3'
  decode-uri-component: '0.5.1'
```

Se usó 8.5.33 (la versión que ya estaba resuelta en el árbol) y no un rango
`>=`: con `>=8.5.23` pnpm resolvió 8.5.23 y habría bajado la versión. El diff
del lockfile es quirúrgico (68 líneas): postcss 8.4.49/8.5.23 → 8.5.33,
image-size 1.2.1 → 2.0.3, decode-uri-component 0.2.2 → 0.5.1 y se elimina
`queue@6.0.2` (dependencia de image-size 1.2.1).

### Compatibilidad verificada: image-size 2.x cambia su exportación

image-size 2.0.3 ya no exporta una función directamente: su entrada CJS
exporta un objeto `{ imageSize, default, types, disableTypes }`. Metro
0.83.3 hace `require("image-size")` con interop y llama
`_imageSize.default(...)`, así que sigue funcionando. Comprobado en el VPS:
`m.default(png)` devuelve `{"height":48,"width":48,"type":"png"}` sobre un
favicon real del repo, `query-string` 7.1.3 parsea bien con
decode-uri-component 0.5.1 y postcss 8.5.33 carga. El lockfile ya no
referencia ninguna versión vieja (0 ocurrencias de 8.4.49, 1.2.1 y 0.2.2);
quedan directorios huérfanos en `node_modules/.pnpm` que pnpm no podó, sin
efecto en CI (que instala desde el lockfile).

## 4. Verificación de AG-59 cerrada en el VPS

Los huecos que el PR #4 dejó abiertos están cerrados, salvo lo que necesita
decisiones de Ernesto:

- `pnpm test`: **exit 0** — `Successfully ran target test for 16 projects`.
- `pnpm typecheck`: **exit 0** — `Successfully ran target typecheck for 21
  projects`. Es la primera vez que el typecheck completo corre sobre este
  main en el VPS.
- `pnpm-lock.yaml`: ya contenía `@agestyles/product-events` desde el commit
  6b35352 («fix: sincronizar dependencias de eventos»), así que ese pendiente
  de AG-59 ya estaba hecho en `main` antes de esta rama; no es trabajo de
  AG-60.
- Migración de eventos: `medusa db:migrate` (patrón de CI, `pnpm migrate`
  dentro de la imagen, `--network host`, solo contra la base del laboratorio)
  ejecutó 9 migraciones, incluida `Migration20261124120000` (eventos), con
  copia previa de la base del lab en `/tmp/lab-db-before-ag60-migrate.dump`
  (987 KB). La tabla `agestyles_product_event` existe en el lab y estaba
  vacía antes de la prueba. Los dos scripts que Medusa repite en cada
  `db:migrate` (`create-super-admin-role`, `migrate-rbac-role-assignments`)
  aparecieron como pendientes, como ya estaba documentado.
- Flujo de eventos de extremo a extremo por el gateway del laboratorio:
  `POST /agestyles-lab/store/agestyles/events` → **201** con el evento
  creado (`pevt_…`), conteo en base 1; repetido con la misma sesión → **200**
  `deduped: true` y el conteo sigue en 1. La fila de prueba se borró después
  (conteo final 0).

### Hallazgo: el gateway bloqueaba los eventos (arreglado en esta rama)

La primera prueba por el gateway devolvió **404 «Route not available in the
buyer lab»**: la lista de rutas permitidas de
`tools/scripts/buyer-lab-gateway.mjs` no incluía `POST
/store/agestyles/events`. Sin esa ruta, ningún evento de Tienda ni de la
vitrina llegaba a la API — ni en el laboratorio ni en producción, porque el
gateway de producción usa el mismo script. Se añadió la regla:

```js
// Anonymous product/store events (AG-59/AG-60): public by design, validated twice in the API.
["POST", /^\/store\/agestyles\/events$/],
```

El gateway del laboratorio se reinició (monta el script por volumen) y la
prueba pasó. El gateway de producción **no** se tocó: la regla solo tendrá
efecto allí cuando Ernesto redepliegue el gateway de compradores. El gateway
de vendedores no necesita la regla (los vendedores no registran eventos).

Detalle: la ruta exige la clave publicable (`x-publishable-api-key`) como
todas las rutas de tienda; «pública» significa sin sesión, no sin clave. El
cliente (`@agestyles/api-client/product-events`) la envía siempre. En la
prueba hizo falta leer el token de la tabla `api_key` del lab (en Medusa
2.22 la tabla se llama `api_key`, no `publishable_api_key`); el `id`
`apk_…` no vale como cabecera, hay que usar el `token`.

## 5. AG-10: el 502 del laboratorio

Causa raíz confirmada: el contenedor `agestyles-buyer-api` (proyecto
`agestyles-buyer-web`, `infra/compose/buyer-web.yaml`) corría una imagen
construida el 2026-11-16, antes del commit ec0bd17 que cambió el puerto de
arranque de la API de 19080 a 19081. Los tres gateways del laboratorio
reenvían a 19081, así que todos daban 502. El contenedor se veía «healthy»
porque su healthcheck no detectaba el cambio de puerto (eso ya estaba en
TABLERO). Línea base antes del arreglo: `19183` → 502 «Seller lab backend
unavailable», `19182` → 502 «Buyer lab backend unavailable»,
`19080/health` → 200, `19081/health` → sin respuesta.

Arreglo (solo laboratorio):

1. Se intentó guardar la imagen vieja como respaldo, pero ya no existía como
   imagen: `docker tag` por nombre y por ID fallaron («No such image») y
   `docker commit` falló («content digest … not found»): alguien podó la
   imagen y el contenedor corría sobre capas parcialmente borradas. El código
   viejo no se pierde: está en git; la imagen se construyó desde `b06bc26`
   («Initial AgeStyles monorepo with Mercur lab», lo último en `main` antes
   del 16 nov 20:10), así que ese commit es el punto de retorno.
2. `docker compose -f infra/compose/buyer-web.yaml build commerce-api`:
   **exit 0** en ~8 min; imagen nueva `agestyles/commerce-api:buyer-preview`
   (`dc0a2895ef03`, 24 nov 07:56), construida desde el árbol de esta rama
   (el código de la API es idéntico a `main`; el lockfile lleva los overrides
   de la sección 3).
3. `docker compose -f infra/compose/buyer-web.yaml up -d --no-deps
   commerce-api`: contenedor recreado. `19081/health` → 200 desde los 60 s;
   contenedor «Up (healthy)».
4. Gateways sin reiniciar (reenvían por petición): `19183` y `19182` ya no
   dan 502; devuelven 400 «Publishable API key required», la respuesta
   normal de la API sin clave. La web de compradores (18083) sigue en 200.

No se cambió el puerto por defecto de los gateways a 19080 (rompería CI, cuya
API desechable corre en 19081) ni el puerto de arranque de `package.json`.

## 6. Revisión cruzada de AG-51

Revisado el arreglo real (commits `ff50e36` y `8cbfde3`) contra el código y
con sus tests. **Conforme, sin hallazgos bloqueantes.**

`confirmsSellerShippingStock` (`apps/commerce-api/src/lib/seller-shipping-stock.ts`)
solo limpia el aviso de Mercur cuando puede confirmar el stock del vendedor
en la ubicación de esa opción de envío: suma las unidades requeridas por
línea (con el mapa `remaining`, así dos líneas del mismo vendedor que
comparten inventario se descuentan entre sí), tiene en cuenta lo reservado y
falla cerrado (devuelve `false` y se mantiene el aviso) si falta cualquier
dato: línea sin `seller_id`, cantidad no entera, `inventory_items` ausente,
nivel de la ubicación ausente, `required_quantity` ausente o `requires_shipping`
distinto de `true`. La ruta (`.../api/store/agestyles/shipping-options/route.ts`)
solo limpia el aviso cuando Mercur marcó falta **y** la confirmación pasa, y
lo hace por opción según su propia ubicación; nunca añade un aviso nuevo.
Tests: `node --test apps/commerce-api/test/seller-shipping-stock.test.mjs` →
3 pass, 0 fail (aislamiento por vendedor y ubicación, stock reservado e
inventario compartido, datos ausentes).

Matiz, no defecto: la corrección es unidireccional por diseño — si Mercur
dice que hay stock pero en realidad falta, no se añade ningún aviso. El
origen de la verdad para la falta sigue siendo Mercur.

## 7. Qué NO se verificó

- No hay ejecución real de CI: los 4 pasos nuevos solo corren cuando se abra
  el PR. La sonda 413 se validó leyendo el código del gateway, no con una
  petición real contra el laboratorio (el paso de CI la ejecuta).
- Lighthouse real: se corrió contra la vitrina que corre en el VPS
  (puerto 18084, imagen del 23 nov) con el mismo comando del paso de CI
  (`lighthouse@12`, preset desktop, inicio/tiendas/novedades) y el
  comprobador de presupuestos. La primera ejecución falló porque el VPS no
  tenía Chrome; se instaló Chrome 158 con `@puppeteer/browsers` en el home
  de Ernesto (`~/chrome/...`, sin tocar el sistema) y se repitió con
  `CHROME_PATH`. Resultado: inicio perf 0,97 / a11y 1,0 / bp 0,93 / seo 1,0
  (LCP 975 ms, CLS 0); tiendas 0,93 / 0,96 / 0,93 / 1,0 (LCP 1.701 ms, CLS
  0,02); **novedades 0,69 de rendimiento (presupuesto ≥0,8)**, resto en verde
  (LCP 1.358 ms, CLS 0,01). Novedades no tiene un único culpable: 4.877 KiB
  y 74 peticiones, con ahorros pequeños (preconnect ~123 ms, recursos que
  bloquean el render ~92 ms, imágenes ~30 ms); necesita un pase de
  rendimiento propio o una decisión de Ernesto sobre el presupuesto. Los
  informes están en `/tmp/agestyles-lighthouse/` del VPS (JSON + HTML).
- No se probó la app nativa Android, ni el flujo de compra completo (AG-11),
  ni el despliegue de producción de nada de esto.
- El disco del VPS quedó al 93% (15 G libres) tras construir la imagen de la
  API (~2,5 G); conviene podar imágenes viejas de GHCR cuando Ernesto lo
  decida (hay dos imágenes de 2,56 G de noviembre).

### El INP no se puede medir en una auditoría sintética (arreglo en esta rama)

El comprobador `tools/scripts/check-lighthouse-budgets.mjs` fallaba el INP
en las tres páginas con «sin dato»: Lighthouse 12 en headless no produce la
auditoría `interaction-to-next-paint` sin interacción real del usuario, así
que el presupuesto INP ≤300 ms no podía pasar nunca y el paso de CI habría
nacido en rojo. Se cambió el comprobador: si no hay dato de INP, lo marca
`skip ... (se mide en campo con web-vitals)` y no falla; solo falla si hay
un valor numérico por encima de 300 ms. El INP se mide en campo con el
reportero de web-vitals (Fase 2 de AG-59). La única brecha que queda es la
de rendimiento de novedades, que es señal real y se deja fallando a
propósito para que Ernesto decida: arreglar la página o retocar el
presupuesto.

## 8. Pendientes que quedan (para Ernesto)

- Revisar y fusionar este PR; al fusionar, el paso de Lighthouse y los demás
  corren en CI por primera vez.
- Redeplegar el gateway de compradores de producción para que la regla de
  eventos tenga efecto allí (el código ya estará en `main`).
- AG-59 sigue pendiente de Ernesto: crear la propiedad GA4 y dar el
  measurement ID, verificar Search Console, completar identidad
  legal/devoluciones en las páginas legales.
- AG-11 (Android, WhatsApp, CUP), AG-02 (backup externo), AG-01 (tasa CUP),
  y el resto del tablero, sin cambios.

# Estado de ejecución del plan maestro AgeStyles 2.0

**Corte de auditoría:** 17 de noviembre de 2026, 19:30 UTC (actualización documental; datos operativos previos conservan su fecha de medición)

**Documento rector:** [AGESTYLES_2_0_PLAN_MAESTRO.md](./AGESTYLES_2_0_PLAN_MAESTRO.md)

**Regla de protección:** AgeStyles actual y Supabase siguen siendo el sistema operativo. El laboratorio Mercur no es producción.

Las decisiones sobre qué reutilizar de `Agestyles-Catalogo`, qué aporta Mercur y qué se construye se registran en [MATRIZ_REUTILIZACION.md](./MATRIZ_REUTILIZACION.md).

> **Corrección de conteo (17 nov 2026, 09:11 UTC):** `product_images=31`, `categories=5` y `subcategories=14` son conteos agregados exactos de una consulta SQL de una sentencia. El inventario de tablas devolvió estimaciones de 17, 1 y 10, respectivamente. La consulta no devolvió filas ni se exportaron productos. Ver [mapa de fuente](./migration/legacy-source-map.md).

Este documento separa evidencia actual de trabajo pendiente. Una fase no se considera terminada porque exista código o una prueba aislada: deben cumplirse todos sus criterios de salida.

## Estado por fase

| Fase | Estado | Evidencia actual | Criterio pendiente para cerrarla |
|---|---|---|---|
| F0 Auditoría y protección | En curso | Supabase `Agestyles-Catalogo` está `ACTIVE_HEALTHY` en PostgreSQL 17.6.1; 80 migraciones aplicadas, última `20261116061921`. Conteos agregados exactos: 33 productos, 31 imágenes, 14 marcas, 5 categorías, 14 subcategorías, 19 saldos por variante, 48 movimientos, 7 pedidos/8 líneas; cero comercios/tiendas/membresías y variantes comerciales. El inventario de tablas dio estimaciones inferiores en tablas pequeñas. Medición del host 17 nov: disco 193 GiB con ~3.1 GiB libres (99% usado); no se ha creado backup ni cambiado fuente. `ADR-001` registra aislamiento y límites. | Backup verificable de PostgreSQL, Storage y Auth, manifiesto/checksum y restauración en destino aislado; resolver destino cifrado externo antes de backup/build/ETL; revisar el VPS sin cambiar servicios de producción. |
| F1 Spike Mercur | Parcial | Mercur 2.4.1 / Medusa 2.22.3, PostgreSQL 17 y Redis 7 aislados. A2/B2 tienen ubicación, inventario, oferta pública y stock. El checkout del comprador crea dos pedidos seller-scoped en un solo grupo; cada propietario ve su pedido y el acceso cruzado devuelve 403. La matriz previa registra 54 comprobaciones en Sole Society/A2 y 46 en Kickz Corner/B2. Reejecución fresca: Sole Society/A2 pasó 54/54; Kickz/B2 se detuvo en la lectura de pedidos del propietario (`GET /vendor/orders`, 500 en vez de 200), por lo que los 46 checks no se consideran vigentes en este corte. Lecturas posteriores acotaron el 500 a Kickz/B1: persiste con campos predeterminados, `limit=20` y `fields=id`; B2 responde 200 con las mismas variantes. El script salió por error y ejecutó su limpieza `finally`; el diagnóstico estático de OC-08 no encontró stack trace persistido; la causa raíz sigue abierta y no se repitió la matriz. Identidad dual comprobada con una cuenta sintética: un correo/contraseña enlazado a buyer y member mediante invitación de tienda, sesiones separadas y 401 al cruzar APIs. La política de permisos del módulo tiene ahora cobertura sintética para owner, inventory manager, viewer, actor admin, rol desconocido y cruce de seller/member IDs. Se confirmó que `insufficient_inventory` es un falso positivo upstream en carritos mixtos; el stock real por tienda está disponible y el checkout sigue completándose. El índice de Mercur estaba desincronizado para B2, por lo que el laboratorio usa el camino de consultas sin `index_engine` mediante configuración soportada de Medusa. `packages/quotations` y `lab:verify:order-quotes` pasaron con una sola quote para carrito A2+B2; el grupo `og_01M7KFW83QDPBN707BTRQ8FHDH` produjo dos pedidos hijos y cada tienda leyó solo el suyo. Cinco aceptaciones concurrentes y sus reintentos convergieron al mismo group/child IDs. Quote idempotente, revisión obsoleta, expiración y rechazo de stock `unavailable` pasaron; la prueba restauró el fixture. El provider `pp_system_default` se usa solo en el laboratorio. `verify-order-quotes.mjs` incluye un probe reversible de +1 en la escala de precios, verifica `requoted` y restaura la escala exacta en `finally`, pero solo si A2 tiene región EUR. La última evidencia registrada dice que no tiene esa región y queda en EUR 49; además el comando completo crea un grupo/pedidos y prueba stock/expiración, así que no es un probe aislado. Se preparó `verify-price-revision.mjs` con guardas loopback, salida `unsupported` previa a carrito/cotización si falta EUR y restauración exacta; el script no se ejecutó. | Diagnosticar el 500 reproducible de `/vendor/orders` en Kickz/B1 (B2 responde 200) y repetir la matriz; usar el nuevo probe aislado solo si A2 ya tiene EUR (no asignar región desde el script); resolver asignación de región con evidencia del dueño. Añadir conteo independiente y cerrar tabla de brechas/decisión seguir-no seguir. |
| F2 Monorepo reproducible | Parcial | pnpm 10.34.9, Nx 24.0.6 y Node 24; `nx graph` verifica ahora 13 proyectos/18 dependencias, incluyendo Commerce API → quotations y Business → Buyer features. CI de la implementación [44063162920](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44063162920), commit `1bb366a`, y de la auditoría [44063714270](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44063714270), commit `a223c9b`, terminó success. `pnpm test` pasa 8 targets; `pnpm typecheck` pasa 12. Guía local en `docs/DEV_WORKFLOW.md`. | Builds nativos Android/iOS, revisión en dispositivos y protección de rama/CODEOWNERS. |
| F3 Catálogo y marketplace web | Parcial | `storefront-web` Next 16 está publicada y responde 200. SSR muestra la categoría `flip-flops`, productos y tienda pública. Facetas por categoría se combinan con búsqueda y URL compartible. Se corrigieron foco visible, contraste de texto AA, movimiento reducido, paginación de 48 productos y el enlace Favoritos sin destino; typecheck, detector y build Next pasaron. La actualización está publicada; home y categoría responden 200. Verificación HTTP fresca del 17 nov: catálogo, tienda Expo compradora, portal negocio y APK de laboratorio responden 200; el acceso HTTP no sustituye el recorrido visual ni el checkout. | Verificación visual/teclado con navegador, privacidad completa, dataset de staging y recorrido de compra web con dos vendedores. |
| F4 App comprador | Parcial | Expo SDK 54; carrito mixto y pedidos agrupados probados en laboratorio; APK beta previa y web actualizada. CI [run 44087586663](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44087586663), commit `44643fc`, completó por HTTP el checkout A2+B2: una quote, un grupo y dos pedidos seller-scoped. El mismo runtime aislado verificó que el comprador dueño obtiene seguimiento y un segundo customer recibe 404. La prueba no crea fulfillment ni etiqueta, y no demuestra el API publicado. La app muestra grupos con líneas por vendedor; controles de cantidad/pago tienen etiquetas y roles accesibles, pero TalkBack queda pendiente. El API público todavía devuelve `Cannot GET` para tracking porque no se ha desplegado esa imagen. Android físico e iOS/macOS siguen pendientes. | Desplegar la ruta tracking cuando haya margen de almacenamiento y verificarla en runtime publicado sin tocar el laboratorio contaminado. Recorrido visual Android/iOS y seguimiento desde la UI siguen pendientes. |
| F5 App negocio | En curso | `business-app` Expo SDK 54 con login `member`, sesión con namespace propio, selector de tienda, resumen, productos/pedidos/inventario y stock condicionado por permiso. Gestión de equipo y permisos; la matriz HTTP seller cubre dos propietarios/cuatro tiendas, y CI [run 44085868401](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44085868401) confirma que owner solicita retiro de variante (202), mientras gestor de inventario y solo lectura reciben 403. El editor envía cambios a revisión y permite alta/cambios de variantes; Mercur 2.4.1 valida permiso y ownership. `https://negocio.eav-labs.com` publica una exportación anterior con modo Comprar; este último cambio no se publicó. | Validar altas/cambios/retiro de variante desde UI/runtime; faltan fotos/medios, fulfillment, alternancia buyer-member desde navegador y prueba nativa. No hay Android conectado ni Mac/Xcode. |
| F6 ETL Supabase → PostgreSQL propio | En curso (proyección y medios privados listos) | El exportador lee el esquema vivo (`products.category`). Bundle actual: 33 productos, 5 categorías, 14 subcategorías, 33 opciones, 31 objetos; dry-run válido, cero escrituras. Hay 31 archivos de imagen verificados por SHA-256 (2,123,500 bytes) en una carpeta privada separada. El usuario confirmó asignar los productos a una tienda oficial AgeStyles. El origen no tiene tiendas (`store_id=null`) ni variantes comerciales; 19 saldos por variante requieren conciliación y una ubicación de esa tienda. El storefront público sigue apuntando a `descargas.eav-labs.com/agestyles-lab`. Desde `a00351d` existe un runtime de producción aislado (`infra/compose/commerce-production-data.yaml`, runbook `docs/runbooks/commerce-production-vps.md`): PostgreSQL `15473` y Redis `16393` están healthy en el VPS; la API `19085` está en ejecución desde el 17 nov con migraciones aplicadas y la tienda oficial `sel_01M7NH1254S7Z1HZ7YQTJT39N7` abierta. El importador ya acepta modo `production` y el script `create-official-seller.ts` crea la tienda oficial vía Mercur. | El usuario pide el destino final, no más iteraciones de laboratorio. Catálogo importado en producción como borrador (33 productos de la tienda oficial), región Cuba en USD, ubicación oficial, recogida/entrega y 31 ofertas con 13 uds. CUP no disponible en Medusa 2.22.3. 31 productos y 5 categorías publicados y visibles en la Store API de producción. API pública `agestyles-api.eav-labs.com` activa; Tienda, Catálogo y Negocio usan producción; después configurar oferta/precios USD y medios HTTPS. Completar backup/restore/conciliación antes de publicación. No ejecutar el importador restringido al lab como sustituto. |
| F7 QA y piloto | Parcial | `pnpm test` 8/8, `pnpm typecheck` 12/12, lint 0 errores/19 advertencias y formato PASS. CI [run 44087586663](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44087586663) añade checkout A2+B2 real al API desechable, verifica un grupo/dos pedidos y BOLA de tracking owner/other-customer. CI [run 44085868401](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44085868401) verifica por HTTP el permiso real para retirar variantes; la matriz seller y denegaciones cruzadas también pasan. Esto no prueba los sitios publicados ni la API del VPS. | Causa Kickz/B1; E2E visual completo, Android/iOS, accesibilidad manual, carga, seguridad de medios, restore/rollback, observabilidad, incidencias P0 y UAT firmado. |
| F8 Producción/cutover | No iniciada | No se cambió el dominio principal ni se migraron datos; la beta está identificada como prueba. | Go/no-go, un solo escritor, freeze/delta, backup final, reconciliación, rollback y periodo de archivo legacy. |
| F9 Evolución posterior | No iniciada | No hay AI Studio en el producto. | Abordar solo después de piloto: IA con aprobación humana, límites y medición de costes. |

## Verificación de infraestructura en este corte

- Contenedores `agestyles-buyer-api`, `agestyles-buyer-gateway`, `agestyles-buyer-web`, `agestyles-seller-gateway`, `agestyles-seller-web` y `agestyles-storefront-web` están en ejecución; API y las webs informan healthy.
- PostgreSQL y Redis del laboratorio están en ejecución y healthy. Sus puertos están enlazados a loopback.
- La web pública responde HTTPS; no equivale a aprobación para vender ni a un corte de producción.
- Cloudflare conserva las rutas ajenas y el catch-all del túnel. `negocio.eav-labs.com` apunta a `127.0.0.1:18085`; `descargas.eav-labs.com/agestyles-seller/` llega a `127.0.0.1:19183`; `catalogo.eav-labs.com` sigue en `127.0.0.1:18084`. Se guardó un snapshot privado de la configuración y DNS antes del cambio.
- El API reproducible del laboratorio usa `127.0.0.1:19081` y la configuración del proyecto desactiva `index_engine` para evitar el índice B2 desactualizado. Los gateways buyer y seller reenvían al API en `19081`; ambos preflight se verificaron con la cabecera de cotización. El proceso previo de `19080` no forma parte de las betas vigentes. La prueba de carrito deja grupos de pedidos dentro de la base aislada; no escribe en Supabase.
- Pruebas repetibles: `corepack pnpm lab:verify:seller-roles` (54 comprobaciones; reejecución actual 54/54 en Sole Society/A2), `corepack pnpm lab:verify:kickz-roles` (46 checks previos en Kickz Corner/B2; reejecución actual falla con HTTP 500 en `GET /vendor/orders`), `corepack pnpm lab:verify:memberships`, `corepack pnpm lab:verify:multistore-checkout`, `corepack pnpm lab:verify:order-quotes` y `corepack pnpm lab:verify:dual-identity` (esta última requiere credenciales sintéticas en variables de entorno). La matriz de cuatro tiendas tiene resultados históricos por 100 checks, pero solo 54 están revalidados en este corte. Los verificadores limpian artículos y membresías temporales. El verificador de membresías crea una sola vez A2/B2 y revalida selección/aislamiento; `approve-lab-sellers.ts` los aprueba mediante workflow oficial y queda limitado a la DB local.
- `apps/commerce-api/src/scripts/approve-lab-sellers.ts` aprobó A2/B2 a través del workflow oficial de Mercur. Verifica host, puerto, nombre de la base, handles exactos y metadata de fixtures; no funciona contra otra base.
- `tools/scripts/verify-multistore-memberships.mjs` comprobó en las cuatro tiendas lectura de productos, inventario, pedidos, ofertas y ubicaciones (200) y rechazó con 403 los accesos a las tiendas del otro propietario. A2/B2 ya tienen fixtures y un pedido mixto ejecutado; la matriz de roles todavía solo se ejercitó en la tienda primaria.
- `apps/commerce-api/scripts/verify-multistore-checkout.mjs` descubre A2/B2 por handle y sus ofertas por SKU, completa carrito con opciones de envío para ambos vendedores, crea el grupo de pedidos y confirma acceso propio y denegación cruzada. La última ejecución creó `og_01M7KBDWSSEW7VBQRF8Z4FHSR2` con dos pedidos. Sus dos opciones marcaron `insufficient_inventory`; una lectura directa del carrito y de las ofertas confirmó, en cada ubicación, 20 disponibles de 25 (5 reservadas). El código de Mercur 2.4.1 recorre todas las líneas del carrito al calcular la bandera, sin aislar por seller; es un falso positivo conocido y está registrado en [ADR-003](./adr/ADR-003-mixed-cart-shipping-inventory-warning.md). La app compradora actual no usa la bandera para bloquear la selección.
- `apps/commerce-api/scripts/verify-dual-actor-identity.mjs` pasó varias ejecuciones con la misma cuenta sintética: registra un customer, acepta invitación a tienda con la identidad existente, vuelve a autenticar como member y comprueba sesiones separadas con 401 cruzado. La membresía se revoca al final; el customer permanece en la base aislada para permitir reejecuciones. Requiere `DUAL_AUTH_LAB_EMAIL` (`@agestyles.example`) y `DUAL_AUTH_LAB_PASSWORD`; ejecútese con `corepack pnpm lab:verify:dual-identity`. Decisión y límites app-level en [ADR-002](./adr/ADR-002-dual-actor-identity.md).
- La matriz de capacidades por requisito, con estado y decisión provisional de continuar solo con el prototipo aislado, está en [medusa-mercur-capability-matrix.md](./architecture/medusa-mercur-capability-matrix.md). El flujo quote-first para carrito A2+B2 ya cuenta con verificación documentada; F1 aún requiere resolver el 500 de Kickz/B1, cerrar las brechas restantes y registrar la decisión seguir/no seguir.
- Apps Expo: `corepack pnpm lab:buyer` y `corepack pnpm lab:business` generan `.env.local` privadas apuntando a `127.0.0.1:19081`; `corepack pnpm lab:app` y `corepack pnpm lab:business-app` inician Expo. No se incluyó una clave Admin ni se guardó `.env.local` en Git. Expo web exportó correctamente a `/tmp/agestyles-business-web`; no se hizo build nativo.
- `adb devices` no detectó dispositivos conectados; iOS requiere macOS/Xcode. Por ello la app de negocio aún no cuenta con evidencia de instalación o uso nativo.
- Medición fresca con `docker system df`: 179 imágenes (49 activas), 100 volúmenes (24 activos), 63.87 GB de imágenes con 27.45 GB recuperables, 16.37 GB de volúmenes con 3.5 GB recuperables, y 5.28 GB de caché de build (192 MB recuperables). El host aloja servicios ajenos a AgeStyles; no se borraron recursos ni se ejecutó `prune`.
- No ejecutar builds pesados de imagen, exportaciones grandes ni backups en disco local con 3.7 GiB libres. Antes debe revisarse la retención por proyecto y mantener las imágenes/volúmenes de rollback; alternativa: destino cifrado externo con espacio suficiente.
- La librería `@agestyles/icons` sustituye las fuentes de iconos en la app compradora. La exportación Expo web no contiene fuentes de iconos y la imagen está publicada; la clave publicable de Medusa no se ha incluido en los chunks web de Next.

## Registro de Supabase (solo lectura)

En el corte de auditoría, Supabase `Agestyles-Catalogo` informa 80 migraciones aplicadas hasta `20261116061921_merchant_order_line_fulfillment.sql`. El checkout de `Agestyles-Catalogo` está en `develop`, HEAD `cc0a810`, tiene 81 archivos SQL y contiene `20261116120000_merchant_product_media.sql`, que no aparece en las migraciones aplicadas. Debe revisarse su intención y estado antes de aplicar; esta auditoría no la ejecutó.

Los conteos confirmados con consultas `COUNT(*)` fueron: productos 33; pedidos 7; líneas 8; perfiles 14; imágenes 31; movimientos de inventario 48; comercios, tiendas y membresías 0. No se copiaron filas personales ni credenciales a este repositorio.

Advisors consultados en modo de lectura: salud sin hallazgos; seguridad informa tres tablas privadas con RLS sin policies, una función `SECURITY DEFINER` expuesta como RPC a `authenticated` y la protección contra contraseñas filtradas desactivada; rendimiento informa 28 claves foráneas sin índice, 19 índices no usados y políticas permisivas solapadas. No se modificó Supabase: los hallazgos deben evaluarse en el proyecto fuente con sus migraciones y contexto, respetando el gate de protección.

El checkout fuente presenta cambios sin seguimiento en `.codex/`, `scripts/__pycache__/` y `src/app/api/admin/product-ai/`. Se dejó intacto.

## Próximas puertas de trabajo

1. Confirmar un destino cifrado con capacidad suficiente para respaldo y restore; mantener sin cambios el VPS de otros proyectos y las políticas del Supabase fuente.
2. Completar respaldo PostgreSQL + Storage + Auth y restaurarlo en un destino aislado; generar manifiesto y hashes.
3. Terminar F1 sobre las cuatro cuentas seller del laboratorio: aprobación, ubicaciones, inventario/ofertas, aislamiento de pedidos, publicación y producto común; validar identidad dual y cerrar decisión Mercur.
4. Completar F2/F5 con `business-app` y paquetes compartidos; establecer presupuesto de almacenamiento antes de builds de producción.
5. Completar mapeo y ETL en staging, conciliación y piloto antes de solicitar go/no-go para cualquier corte.

## Actualización de verificación — 17 de noviembre de 2026, 04:50 UTC

- La revisión global local más reciente pasó `corepack pnpm test` (4 tareas), `corepack pnpm typecheck` (12 tareas), `corepack pnpm lint` (0 errores; 36 advertencias) y `corepack pnpm format:check`. Typecheck fue repetido sin caché en serie después de detectar una edición concurrente temporal en `android-app-link.tsx`; una verificación dirigida de Buyer y la corrida final global pasaron.
- La app compradora recibió ajustes de catálogo, ficha, carrito, checkout y confirmación, con colores de navegación y superficies que siguen el tema del sistema. El storefront web recibió reglas `prefers-color-scheme: dark` para catálogo y páginas de vendedor. Los cambios son locales; no se hizo build ni publicación de esos estilos.
- Se actualizó `docs/design-system.md` para exigir modo claro/oscuro en todas las interfaces y uso de tokens semánticos. La cobertura de todas las pantallas de `business-app` sigue pendiente de revisión y figura como OC-09 en `OPEN_CODE_TASKS.md`.
- La medición de este host sigue en 3.5 GiB libres y 99% de disco. No se realizaron builds nativos, builds de imágenes, exportaciones pesadas, `prune`, respaldo, ETL, cambios en Supabase ni cutover. El estado de F0/F6/F8 no cambia.
- No se repitió la matriz del laboratorio de roles: continúa el riesgo documentado de datos de fulfillment/prueba y el error histórico de Kickz/B1 no tiene stack trace conservado. Un análisis nuevo encontró 46 logs de `/vendor/orders` en 36 h, sin 500; no identifica tienda/actor y no prueba que B1 esté reparada. F1/F7 continúan abiertas.
- Los archivos de `references/` siguen ignorados y sin cambios en el estado de Git. Los cambios de código locales aún no se han consolidado en un commit durante esta auditoría.
- Verificación HTTP de solo lectura a las 04:52 UTC: `catalogo.eav-labs.com`, `tienda.eav-labs.com`, `negocio.eav-labs.com` y `agestyles.eav-labs.com` devolvieron 200. Esto confirma disponibilidad de portada, no tema oscuro publicado, login ni recorridos de compra.

## Actualización de avance — 17 de noviembre de 2026, 05:09 UTC

- El modo oscuro automático ya cubre las pantallas de Business del árbol local, incluidos selector de tienda y modo comprador; `app.json` usa `userInterfaceStyle: automatic`. Buyer también adapta el enlace del APK y los colores de acción/éxito/error ahora vienen de tokens semánticos compartidos con foreground contrastante.
- Se añadió una prueba de `@agestyles/design-tokens` que calcula contraste WCAG AA de texto/acción/éxito/error en ambos temas y coteja TypeScript con `tokens.css`. Resultado: PASS.
- Gates globales locales tras estos cambios: typecheck 12/12; pruebas 5/5; lint 0 errores/30 advertencias. La revisión de formato global se repetirá después de cerrar el workflow de publicación que está en edición.
- El pipeline de publicación manual de imágenes runtime por SHA y su override Compose están en elaboración. No se habilitó ni ejecutó publicación, pull o deploy. Las tres webs actuales responden 200, pero sus imágenes son anteriores a los cambios locales.
- El host solo tiene un disco de 199 GiB montado para `/`, con ~3.4 GiB libres. No se encontró un destino alternativo local para backup; F0/F6/F8 siguen sujetas a un destino cifrado y gates de negocio.

## Actualización de verificación — 17 de noviembre de 2026, 05:19 UTC

- Se cerró la implementación del tema claro/oscuro en Buyer y Business, la paleta semántica compartida y los estilos responsivos del catálogo. El código sigue pendiente de revisión visual en navegador/dispositivo; no se da OC-09 por terminado.
- La revisión local encontró y corrigió una coma faltante en la navegación Buyer, un contrato `onBack` inconsistente en el paso de pago y dependencias de precio en el catálogo. Verificación actual: typecheck 12/12, tests 5/5, lint 0 errores/28 advertencias, `format:check` y `git diff --check` correctos. Los tres overrides Compose de GHCR validan y mantienen los servicios/puertos existentes.
- El workflow manual `.github/workflows/publish-frontends.yml` y el runbook `docs/runbooks/manual-frontend-publish.md` ya están preparados. El workflow no se ha ejecutado: los cambios siguen locales, GitHub `main` conserva `636a774`, y buyer, business y catálogo continúan con imágenes anteriores. No hubo pull, deploy ni cambios DNS.
- Se mantiene el límite de capacidad: 3.5 GiB libres en el único disco del host. No se ejecutaron builds grandes ni limpieza de Docker. F0/F1/F4/F6/F7/F8 siguen abiertas según sus gates previos.

## Actualización de publicación — 17 de noviembre de 2026, 05:32 UTC

- Los cambios de tema y pipeline están en `main` desde `162fbf4`; la corrección del lockfile está en `192122d`. El CI de `192122d` finalizó success, incluyendo lint, formato, 5/5 tests, 12/12 typechecks, export de Buyer/Business y build del storefront.
- `202eff8` añade textos en español a catálogo, carrito, ficha y confirmación de compra. Su typecheck dirigido, ESLint y Prettier pasaron; el CI remoto terminó success con lint, formato, tests, typecheck y las tres compilaciones web.
- El repo ya tiene los últimos cambios de código, pero las webs públicas siguen en las imágenes anteriores. El workflow de imágenes está preparado y es manual; aún no se ha ejecutado ni desplegado.
- En `202eff8` la verificación de CI terminó success. Prueba de solo lectura contra el gateway público del comprador: preflight desde `tienda.eav-labs.com` devuelve 204 y permite `x-medusa-locale`/`x-publishable-api-key`; `store/regions` y `store/products?limit=1` devuelven 200 usando la configuración local de la app. Esto acota el bloqueo previo de CORS en el gateway actual, pero no valida el bundle web desplegado ni la renderización de la app.

## Actualización de tokens — 17 de noviembre de 2026, 05:35 UTC

- La auditoría de claro/oscuro encontró dos colores de superficie del panel Business definidos fuera de la paleta común. Se trasladaron `quietSurface` y `selectedSurface` a `@agestyles/design-tokens` y a CSS; `useBusinessTheme` ahora los consume desde el paquete compartido.
- La prueba amplía WCAG AA a texto sobre esas superficies y comprueba paridad TS/CSS. En local pasaron 5/5 tests, 12/12 typechecks, Prettier y ESLint dirigido. Este último cambio está pendiente de commit y CI remoto; aún no está desplegado.

## Actualización de CI y tokens — 17 de noviembre de 2026, 05:41 UTC

- `57fdec5` subió los tokens de superficies y la ampliación de contraste WCAG AA a `main`; el CI de ese SHA terminó success: instalación congelada, lint, formato, 5/5 tests, 12/12 typechecks y los tres builds web.
- La prueba del gateway confirma 1 región y 12 productos publicados desde la configuración de la app compradora. La solicitud HTTP y CORS pasan; falta validar la UI desplegada con una imagen nueva.
- Las tres webs siguen respondiendo 200 con los contenedores iniciados antes de los commits recientes. No se ejecutó el workflow `Publish frontend images`, pull ni redeploy.

## Guía de publicación — 17 de noviembre de 2026, 05:44 UTC

- El runbook ya tiene las URLs verificadas para gateways buyer/seller, web buyer, catálogo y propietario GHCR. Solo falta copiar el valor `pk_` publicable de la configuración local a la variable de GitHub Actions; no usar claves `sk_`, Admin o Vendor.
- Una consulta pública desde el gateway remoto `https://descargas.eav-labs.com/agestyles-lab` con esa clave devuelve 1 región y 12 productos (HTTP 200). El preflight de negocio desde `negocio.eav-labs.com` también devuelve 204.
- No se ha iniciado la publicación de imágenes. Los contenedores siguen con tags `agestyles/*:local`, anteriores a los cambios de `main`.

## Actualización de seguimiento de pedidos — 17 de noviembre de 2026, 05:55 UTC

- F4/F7: agregada prueba de contrato de la ruta `GET /store/orders/:id/tracking` con `QUERY.graph` en memoria. Comprueba anónimo→401 sin consultar el grafo, cliente ajeno→404 sin etiqueta, y dueño→tracking por línea; no accede a base de datos.
- `corepack pnpm test` pasa 6/6, typecheck 12/12, lint 0 errores/20 advertencias, Prettier y ESLint de los archivos tocados pasan. Nx detecta el test nuevo de Commerce API.
- El endpoint aún no está en la imagen del API desplegado; la nueva prueba no sustituye la validación runtime ni autoriza reintentar el verificador con fixtures contaminados. CI remoto de este cambio queda pendiente.

## Revalidación — 17 de noviembre de 2026, 05:59 UTC

- GitHub Actions run [44027490205](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44027490205), para `main` en `01f1f6a418e06b6f93fdf7c10dd885d8fe0a883c`, terminó `success` a las 05:57 UTC. Pasaron instalación congelada, lint, formato, 6/6 pruebas, 12/12 typechecks y los tres builds web. F2 sigue parcial por builds nativos y validación en dispositivos.
- `main` local y remoto siguen en `01f1f6a`; el commit está en GitHub. No hay evidencia de ejecución del workflow manual `Publish frontend images`; las webs públicas siguen usando imágenes anteriores `:local`. No se afirma que la UI/API reciente esté desplegada.
- Se detectaron cambios locales sin commit en `apps/buyer-app/app/(drawer)/(tabs)/account/orders/[id].tsx` y `apps/buyer-app/lib/status-labels.ts`. Se preservaron sin incluirlos en el commit ni declararlos verificados/publicados.
- La ruta de tracking continúa pendiente de despliegue e identificación de imagen de Commerce API, y de validación runtime con un pedido de fixture limpio. El test actual solo valida el handler contra `QUERY.graph` simulado.

## Avance F5 — sesión buyer/member con un acceso — 17 de noviembre de 2026, 06:04 UTC

- El login de negocio ahora limpia el token buyer previo, autentica `member` e intenta autenticar `customer` con las mismas credenciales, verificando el perfil y escribiendo cada JWT en su almacenamiento independiente. El buyer SDK se comparte entre el flujo de login y el modo Comprar; no se conserva la contraseña. Si el actor buyer no está vinculado/no autentica, el login de negocio continúa y el actor comprador queda sin sesión.
- El test sintético del coordinador cubre éxito de ambos actores, limpieza buyer anterior y fallos independientes. Test del paquete y typecheck de Business/`features-buyer` pasan; ESLint dirigido, Prettier y `git diff --check` pasan.
- Commit `598c7da` publicó la implementación en `main`; GitHub Actions run [44029135950](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44029135950) terminó `success` con lint, formato, tests, typecheck y tres builds web.
- Aún no es aceptación end-to-end: falta comprobar una identidad enlazada desde la interfaz, volver de comprador a negocio, refresh, revocación y logout de un actor/todos. No se llamó API ni DB; el endurecimiento local está pendiente de commit/CI y esta versión aún no se ha publicado en las webs públicas.

## Revisión de detalle buyer y token obsoleto — 17 de noviembre de 2026, 06:20 UTC

- F4: revisión del cambio local de detalle de pedido encontró un error ESLint: `useStatusLabel` era una función pura y se llamaba en callback/condición como hook. Se cambió a `getStatusLabel`; los estados de pago usan `PAYMENT_STATUS_LABELS`.
- F5: antes del login customer dual se limpia el token buyer anterior, para evitar conservar en el mismo dispositivo la cuenta de otra persona. El SDK Medusa usa `clearToken()` para borrar el token en el storage configurado; tests locales verifican el orden member-login → buyer-logout → customer-login.
- Buyer typecheck PASS; ESLint dirigido sin errores; Prettier y `git diff --check` PASS. La mejora buyer sigue sin commit; CI del commit funcional `80df905` está ejecutándose. No se llamó al API ni a la DB y no se hizo despliegue.

## Preparación de publicación de Commerce API — 17 de noviembre de 2026, 06:21 UTC

- Se añadió `.github/workflows/publish-commerce-api.yml`: `workflow_dispatch` solo en `main`, exige CI exitoso para el mismo SHA, crea tags inmutables y publica `agestyles-commerce-api` a GHCR. La compilación recibe credenciales aleatorias efímeras como secreto BuildKit que se elimina al finalizar; no reutiliza `.env` del host ni conecta a servicios.
- Se añadió `infra/compose/buyer-api.images.yaml` y `docs/runbooks/manual-commerce-api-publish.md` para descargar/recrear solo `commerce-api`, comprobar la versión/health y revertir al tag anterior o a `buyer-preview`.
- Verificación estática: Prettier PASS; `docker compose config` resolvió la imagen `ghcr.io/ernestoartime/agestyles-commerce-api:sha-validation`, manteniendo `network_mode: host` y el healthcheck existente. No se ejecutó build de imagen, workflow, pull, despliegue ni escritura en API/DB. La publicación requiere que el dueño ejecute manualmente Actions y mantenga margen de disco en VPS.
- El CI incorpora un build de Medusa con secretos aleatorios enmascarados y endpoints loopback; no usa DB/Redis reales. Su primera ejecución queda pendiente después del commit de este cambio.

## Corrección de evidencia y avance local — 17 de noviembre de 2026

- **F2:** la evidencia actual de build de Commerce API ya no es la corrida fallida anterior. GitHub Actions [44035283113](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44035283113), SHA `98e5df0`, terminó `success`; el build de Medusa carga los tres módulos workspace CommonJS. `nx graph` produjo un grafo JSON local de 13 proyectos y 16 dependencias; se añadió `implicitDependencies` para representar Commerce API → quotations, cargado dinámicamente por Medusa. El target de migración quedó dentro de `pnpm test`; el trabajo iterativo local sigue sin necesitar builds de apps.
- **F6:** además del repositorio fuente, se consultaron metadatos vivos de esquema/migraciones de `Agestyles-Catalogo` sin leer filas. La consulta agregada exacta del 17 nov 09:11 UTC confirma 33 productos, 31 imágenes, 5 categorías, 14 subcategorías, 19 saldos por variante, 48 movimientos, 7 pedidos y 8 líneas; el inventario anterior devolvía estimaciones, entre ellas 17 imágenes. No hay `pg_dump --schema-only`, backup/restore ni export real.
- El preflight local `tools/migration/validate-stage-bundle.mjs` ahora acepta `--profile catalog-only`: solo permite categorías, productos, variantes y metadatos de medios; no lee contenidos de datasets fuera del perfil; comprueba moneda/estado legacy, referencia de categoría, referencia de variante y hash/MIME de medios; prohíbe URLs originales de medios. Sigue sin exportador ni importador y los productos importados se deberán crear como borradores.
- Validación local de este avance: `corepack pnpm typecheck` 12/12, `corepack pnpm lint` 0 errores/20 advertencias, `corepack pnpm format:check` PASS, `corepack pnpm test` 7 tareas exitosas y suite de migración 9/9 vía Nx. El bundle sintético catálogo-only pasó por `corepack pnpm migration:catalog:check`. No hubo build de app, llamadas de red, escritura en Supabase, exportación ni despliegue.
- **OC-09 / temas:** Buyer ahora declara `userInterfaceStyle: automatic`, igual que Business; el storefront tiene media queries `prefers-color-scheme`. Queda revisar visualmente rutas completas en navegador y dispositivos. El código local de estos cambios aún no se ha subido.

### Revalidación de gates y temas — 17 de noviembre de 2026, 08:37 UTC

- `corepack pnpm test`: 8/8 targets (8 en caché); `corepack pnpm typecheck`: 12/12 (11 en caché, uno ejecutado); `corepack pnpm lint`: 0 errores y 20 advertencias; `corepack pnpm format:check`: PASS; `git diff --check`: PASS.
- Revisión estática: Business consume el hook/tokens de tema sin `Colors.light` ni hex locales en pantallas; las páginas de directorio y tienda de `seller-pages.css` declaran overrides oscuros. Esto no prueba el render final. No hay navegador automatizable ni dispositivo conectado, por lo que OC-09 conserva como pendiente la inspección visual de rutas completas de Buyer, Business y storefront en tema claro/oscuro. Sin builds ni publicación.

F0/F1/F3/F4/F5/F6/F7/F8 siguen parciales o abiertos según sus gates de respaldo, causa raíz de Kickz, recorridos de interfaz/dispositivo, importación idempotente, QA y go/no-go; este avance no equivale a aceptar migración o cutover.

### Corrección de conteos del origen — 17 de noviembre de 2026, 09:11 UTC

Las cifras `17 imágenes`, `1 categoría`, `10 subcategorías`, `10 perfiles` y `1 línea de pedido` provenían de estimaciones del inventario de tablas y no de conteos exactos; se reemplazan por una sola consulta agregada `COUNT(*)`: 31, 5, 14, 14 y 8. La consulta no devolvió filas ni datos personales. El mapa y el runbook de importación ahora identifican la limitación de las estimaciones. El estado de migraciones continúa en 80, última aplicada `20261116061921`; no se leyó ni exportó ninguna fila de negocio.

## Revalidación de tareas locales — 17 de noviembre de 2026

- CI del commit `2140711` terminó success: lint, formato, tests, typecheck, build aislado Medusa y exports web de Buyer, Business y Storefront.
- CI del avance de conciliación F6, commit `c79f5f7`, también terminó success: [run 44056377199](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44056377199).
- El proyector sintético F6 ahora emite una conciliación agregada de conteos por entidad, moneda/estado y presencia de `store_id`, además de comparar conteos fuente/staging. La prueba repite la proyección y confirma el mismo manifiesto/hash sin emitir IDs ni payload.
- Gates locales tras esos cambios: 8/8 targets de test, 12/12 typechecks, lint 0 errores/20 advertencias, formato PASS. Ningún acceso o escritura adicional a Supabase; no se generó backup ni se importaron datos.
- No cambian los gates externos: destino cifrado/restore para F0, causa raíz del 500 Kickz/B1, endpoint de tracking desplegado y validado, inspección visual/nativa Buyer/Business/Storefront, E2E/UAT y go/no-go F8.
- F5: Business declara la dependencia workspace `@agestyles/features-buyer` y usa sus exports para carrito/sesión customer; Nx muestra esa dependencia. Los tests sintéticos cubren login, lectura y logout del actor comprador. No valida login real ni alternancia visual de modos.
- CI del commit F5 `9b37aea` terminó success: run [44057675651](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44057675651), con lint, formato, pruebas, typecheck, build Medusa y exportaciones web.
- El proyector ahora convierte `variant_options: []` y `"[]"` en la variante `__default__` requerida por el contrato; `migration:test` pasó 12/12 y `pnpm test` 8/8. No se accedió a datos de origen.


## Revalidación de migración y sincronización — 17 de noviembre de 2026, 10:03 UTC

- `main` está sincronizada con `origin/main` en `1cc09b0` (`fix: deduplicate catalog media by content hash`); CI [run 44060215811](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44060215811) terminó `success`, incluidos lint, formato, pruebas, typecheck, build aislado de Medusa y exports web Buyer/Business/Storefront.
- El proyector local deduplica metadatos de imagen por SHA-256, conserva orden e indicador principal por relación de producto, informa hashes únicos/filas repetidas y rechaza conflictos MIME. El validador `catalog-only` exige orden entero no negativo, único y ascendente, indicador principal booleano (máximo uno por producto), `media_count` coincidente cuando se declara y hashes de objeto únicos. Pruebas sintéticas de migración: 14/14; `pnpm test`: 8/8; typecheck: 12/12; lint: 0 errores/20 advertencias; formato y `git diff --check`: PASS.
- Esto solo valida fixtures locales. Continúan pendientes backup/restore, decisiones de mapeo, exportador e importador reales; no se accedió a Supabase ni se descargaron medios.
- OC-09 permanece abierta para inspección visual clara/oscura en navegador/dispositivo. `references/` continúa excluida y no se tocaron servicios ni DNS en esta revalidación.


## Contrato local de permisos seller — 17 de noviembre de 2026

- `apps/commerce-api/test/seller-permissions.test.mjs` prueba la política pura del resolver con una membresía sintética: owner, inventory manager, perfil de solo lectura, admin, rol desconocido y actor/tienda/member IDs que no coinciden. El target Commerce API ahora descubre todos los `*.test.mjs`; la suite dirigida pasa 6/6 (incluye tracking). `pnpm test` pasa 8/8 targets y typecheck 12/12.
- Estas pruebas no hacen llamadas a DB/API y verifican contrato de permisos con mocks; no reemplazan BOLA contra HTTP/DB ni la matriz real por tienda en el laboratorio.


## Revalidación de permisos de tienda y capacidad — 17 de noviembre de 2026, 10:19 UTC

- El target de tests de Commerce API pasa 6/6 casos (5 nuevos del resolver de permisos y el contrato de tracking); el monorepo pasa 8/8 targets y 12/12 typechecks. Lint: 0 errores y 20 avisos existentes; formato y diff check pasan. CI del commit `1bb366a` [run 44063162920](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44063162920) terminó `success`.
- El resolver tiene cobertura sintética de owner, inventory manager, SUPPORT/viewer, admin, rol desconocido y rechazo de combinaciones de seller/member IDs. No reemplaza BOLA real ni pruebas de rutas/DB.
- Revisión de host de solo lectura: 3.2 GiB libres en disco, 11 GiB RAM total, swap de 2 GiB casi agotada; `adb devices -l` no muestra dispositivos. No se inició build pesado, descarga ni limpieza.


## Comprobación HTTP pública — 17 de noviembre de 2026, 10:24 UTC

- `https://catalogo.eav-labs.com/`, `https://tienda.eav-labs.com/` y `https://negocio.eav-labs.com/` respondieron HTTP 200. Esto verifica disponibilidad de portada, no el render ni las interacciones de compra.
- El gateway comprador `https://descargas.eav-labs.com/agestyles-lab` respondió HTTP 200 para `store/regions` y `store/products?limit=1`; el catálogo reportó 12 productos y devolvió uno en la muestra. La publishable key se leyó desde `.env.local` en memoria y no se imprimió.
- `GET /store/orders/order_synthetic/tracking` respondió 404 tanto en el API loopback `127.0.0.1:19081` como por el gateway, sin autenticación de cliente; el API desplegado devuelve `Cannot GET`, por lo que la ruta fuente aún no está en esa imagen. No se escribió información.


## Corrección del puerto de publicación API — 17 de noviembre de 2026, 10:34 UTC

La API ejecuta en `127.0.0.1:19081`; los gateways buyer/seller ya reenviaban a ese puerto. Se corrigieron `EXPOSE`, healthcheck Compose y comando del runbook que todavía apuntaban a 19080. Una prueba sintética ahora exige que paquete, Dockerfile, Compose, ambos gateways y runbook compartan el mismo puerto. Commerce API test pasa 7/7, Nx test 8/8, typecheck 12/12, lint 0 errores/20 advertencias, formato PASS; `docker compose ... config --services` valida el Compose sin construir. La ruta tracking sigue devolviendo 404 en runtime porque la API actual no se ha actualizado. El host tiene 3.2 GiB libres y el runbook exige espacio para conservar rollback; no se publicó ni desplegó la imagen.


## CI de la corrección de publicación API — 17 de noviembre de 2026, 10:37 UTC

El commit `ec0bd17` (`fix: align commerce API publish port`) está en `main`; CI [run 44066099747](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44066099747) terminó success con lint, formato, tests, typecheck, build aislado de Medusa y exports web. La nueva prueba de configuración es parte de los tests de Commerce API. No se inició `Publish commerce API image` ni se actualizó el VPS. Su despliegue sigue sujeto a conservar la imagen anterior/rollback; con 3.2 GiB libres no se satisface aún ese prerequisito.

## Build de imagen API en CI — 17 de noviembre de 2026, 10:46 UTC

El commit `3444eef` pasó CI [run 44067825900](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44067825900) construyendo `Dockerfile.public` con configuración BuildKit efímera y `push: false`. En `c9b7502` quedó añadido el smoke test de runtime; CI [run 44068837811](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44068837811) terminó success: migró PostgreSQL efímero, arrancó el API contra Redis efímero y obtuvo `/health` satisfactoria; exports Buyer/Business y build del Storefront también pasaron. La imagen no se publicó y el VPS no se modificó.

## Cobertura del carrito compartido Buyer — 17 de noviembre de 2026, 11:03 UTC

El commit `8923f88` cubre persistencia/recuperación de carrito, transferencia de actor comprador y adición de ofertas de dos vendedores al mismo carrito. `features-buyer` pasa sus 6 pruebas. CI [run 44071834569](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44071834569) terminó success: typecheck, lint, formato, pruebas, build no publicado de API, migraciones/health en PostgreSQL/Redis desechables y build/export web. Esto cubre contratos aislados, no el checkout UI ni una compra runtime nueva.

## Revalidación del gateway comprador — 17 de noviembre de 2026, 11:13 UTC

Desde el origen público Buyer, CORS preflight de `store/regions` responde 204 y permite el origen/header esperado; regiones responde 200/1, productos 200/12 y las 12 miniaturas contestan HEAD 200. Se mantuvo la publishable key fuera de consola. El gateway ya entrega catálogo y miniaturas al comprador; falta inspección del render/UI en navegador y checkout completo desde la interfaz.

OC-09 sigue abierto solo para la revisión visual de rutas completas en claro/oscuro y TalkBack. No hay dispositivo conectado ni navegador automatizable disponible y el host tiene 3.1 GiB libres (umbral documentado para AVD: 8 GiB). CI confirma build/export web, que no reemplaza esa comprobación manual.

## Aislamiento por identidad explícita en permisos seller — 17 de noviembre de 2026, 11:27 UTC

El resolver valida ahora `id`, `member_id` y `seller_id` de la membresía retornada contra el actor y la tienda solicitados, incluso si la consulta interna ignora filtros. Tres pruebas sintéticas de membresía cruzada y la suite Commerce API (8/8), su typecheck, ESLint, Prettier y `git diff --check` pasan. CI del commit `81774df` [run 44074681686](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44074681686) terminó success e incluyó el smoke test aislado de API y los builds web. Refuerza el contrato local de F1/F5; aún falta BOLA por HTTP/DB y revocación end-to-end.

Consulta read-only actual del proyecto `Agestyles-Catalogo`: 80 migraciones aplicadas hasta `20261116061921`; la migración posterior `20261116120000_merchant_product_media.sql` sigue sin aplicarse. La revisión estática confirma que añade RPCs para fotos de borradores merchant y no implementa el ETL del catálogo legado. No se aplicó ninguna migración ni se leyeron filas.

## Smoke aislado de la ruta tracking — 17 de noviembre de 2026, 11:48 UTC

CI [run 44078209194](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44078209194) terminó success. El API en imagen de CI responde `/health` 200; `GET /store/orders/order_ci_synthetic/tracking` sin publishable key se rechaza con 400 en la capa Store. El test del handler cubre además sin customer 401, customer ajeno 404 y lectura del propietario. Esto verifica compilación/ruta en runtime desechable; el API actualmente publicado sigue sin probarse/actualizarse, y BOLA real queda pendiente.

## Matriz seller en HTTP aislado y retiro de variantes — 17 de noviembre de 2026

- **F1/F5/F7:** CI [run 44081670026](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44081670026), commit `f30af7b`, terminó success. En PostgreSQL/Redis efímeros, el job ejecutó la matriz HTTP de propietario, gestor, solo lectura, cambio de tienda y denegaciones entre dos propietarios y cuatro tiendas, usando el seed/fixtures del laboratorio. El job descarta esos servicios al terminar; esto no prueba el VPS.
- **F5:** `business-app` permite al rol con `products.manage` enviar una solicitud de retiro de variante al endpoint DELETE soportado por Mercur 2.4.1. La confirmación deja claro que la variante sigue disponible hasta aprobación. `tools/scripts/seller-lab-gateway.mjs` autoriza solo el DELETE de `/vendor/products/{id}/variants/{variant_id}`. CI [run 44083538913](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44083538913), commit `0aa93b9`, terminó success: preflight DELETE permitido, POST rechazado por la regla específica, tests/typechecks, API en servicios efímeros y export/builds web. No se publicó el web ni se modificó el VPS.

## F2/F4/F5 — Puerto por defecto consistente en las apps — 17 de noviembre de 2026

Los SDK de comprador y negocio, el ejemplo `.env` de negocio y el verificador buyer apuntaban al API antiguo `19080`, a pesar de que API, gateways y Compose exponen `19081`. Se alinearon los defaults/documentación y se amplió el test de consistencia del puerto para cubrir ambos clientes y sus ejemplos de entorno. Localmente: tests 8/8, typecheck 12/12, lint 0 errores/19 advertencias, formato PASS. CI del commit `0bd48a7` [run 44090686807](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44090686807) terminó success e incluyó exports web. Esto corrige el valor por defecto de desarrollo, no determina la URL compilada en el APK beta anterior ni cambia el runtime publicado.

## F5 — Preparación seller de pedidos — 17 de noviembre de 2026, 13:56 UTC

Business ahora incluye detalle del pedido, cantidades pendientes, selección de ubicación propia y acción de preparar fulfillment. La ruta AgeStyles reutiliza el workflow de Mercur con validaciones servidor de `orders:edit`, pedido y ubicación pertenecientes a la tienda y saldo disponible. El gateway expone únicamente esta ruta POST y las lecturas de detalle/ubicación necesarias. CI desechable verifica propietario permitido, gestor de inventario/solo lectura denegados, tienda/ubicación ajenas denegadas y repetición bloqueada. Typecheck 12/12, tests 8/8, lint 0 errores/19 advertencias, formato y `git diff --check` pasan. Falta CI remoto; no se desplegó ni se validó en una pantalla.

## Avance local F3/F4/F5/F6 — 17 de noviembre de 2026, 15:15 UTC

- Localización: Buyer y Business convierten errores crudos y enums visibles de API en mensajes/estados en español; el storefront traduce sus etiquetas de reserva. Se cambió “Stock” por “Inventario”, los nombres de envío del seed y el nombre de reserva de métodos de pago desconocidos. `AGENTS.md` fija el español como idioma por defecto, incluidas fechas, accesibilidad, errores y estados. La proyección traduce nombres de catálogo conocidos y conserva el original en metadata. **No está publicado ni validado visualmente.** Se conservan nombres propios y contenido libre futuro de vendedores.
- F6: se prepararon un exportador acotado de catálogo público Supabase con clave anon y un importador idempotente limitado al laboratorio loopback. No se han exportado ni importado datos reales. El importador deja todo como borrador y no copia bytes de imágenes, no asigna vendedores/ofertas/precios efectivos ni inventario; por tanto, todavía no crea productos comprables.
- MinIO/file-s3 queda preparado como perfil opcional del laboratorio con volumen persistente y puertos loopback; no se activó ni se configuró un origen HTTPS público. Guía: `docs/runbooks/minio-media-lab.md`.
- Lecturas acotadas de nombres/descripciones/categorías y metadatos agregados; no se leyeron usuarios, pedidos ni datos personales. Resultado: 33 productos, 31 imágenes, 5 categorías, 14 subcategorías, cero tiendas/comercios/variantes comerciales; 15 productos sin subcategoría, dos con descripción y uno con precio no positivo. No se modificó Supabase.
- No se ejecutaron pruebas, compilaciones, exportación real, importación, publicación, DNS ni deploy en este avance. `git diff --check` pasó. Los cambios siguen locales, sin commit, sobre `main` en `5a9d56e`.

## Funcionalidad de favoritos en Buyer — 17 de noviembre de 2026

- Se añadió una pestaña de favoritos a Buyer, con almacenamiento local persistente en AsyncStorage. Las tarjetas de catálogo permiten guardar/quitar un producto y la pantalla lista los guardados que sigan disponibles en la región seleccionada. Incluye estados de carga, vacío, error y reintento, con los temas claro/oscuro y `@agestyles/icons`.
- Es almacenamiento por dispositivo; todavía no sincroniza favoritos entre sesiones/dispositivos ni los persiste en Medusa. No se hicieron pruebas ni build, por preferencia del usuario. `git diff --check` es la verificación ejecutada.
- El usuario confirmó que los 33 productos deben pertenecer a una tienda oficial AgeStyles y pidió cargar directamente en el destino final, sin iteraciones de laboratorio. La web `catalogo.eav-labs.com` es el storefront público actual, pero su configuración apunta al API `descargas.eav-labs.com/agestyles-lab`; no hay API de producción separada configurada. Falta identificar/provisionar ese destino y decidir la ubicación de inventario oficial para los 19 saldos por variante. No se importó ni publicó.
- Evidencia fresca del host: 2.8 GiB libres (99 % usado) y servicios de AgeStyles y otros proyectos activos. No limpiar contenedores/volúmenes ni iniciar builds pesados. F0/F6 siguen abiertas por respaldo cifrado/restauración; F1/F4/F5/F7/F8 conservan sus gates de diagnóstico, release, dispositivos, UAT y go/no-go.

## Consolidación de cambios locales — 17 de noviembre de 2026, 19:30 UTC

- Los cambios descritos como "sin commit sobre `5a9d56e`" quedaron en la rama `feat/espanol-favoritos-minio` sobre `main` `d8a710c`: localización (`1b3ae3f`), favoritos Buyer (`09b2204`), perfil MinIO del laboratorio (`cb5931c`) y esta documentación. No se ha fusionado en `main` ni publicado.
- Antes del commit se aplicó Prettier a los archivos cambiados y se quitaron variables `catch` sin uso que dejó la traducción de errores. Resultados: `typecheck:quick` 11/11, `pnpm test` 8/8, `migration:test` 14/14, lint 0 errores/21 advertencias, `format:check` y `git diff --check` pasan. No se hizo build, export Expo ni revisión visual.
- Runtime de producción observado con `docker ps`: `agestyles-commerce-production-postgres-1` y `-redis-1` healthy; no hay contenedor `commerce-api` de producción. Existen archivos privados de entorno en `~/.config/agestyles-commerce-production` (no se leyeron valores). No se verificó si la tienda oficial ya se creó en la base de producción. Disco: 7.3 GiB libres (97 %).

## F6 — runtime de producción iniciado — 17 de noviembre de 2026, 20:30 UTC

- La imagen configurada antes (`sha256:402524d3…`) no incluía `create-official-seller.ts`. Se cambió `AGESTYLES_PRODUCTION_IMAGE` en el `compose.env` privado a la imagen de `main` `a078cf4` (`ghcr.io/ernestoartime/agestyles-commerce-api@sha256:ad4b4e371334eb33c13c6c2195bb81fc2849dc6cf07988b32e95f8ae1ddede55`, run 44160480892).
- La base `agestyles_commerce` estaba vacía (0 tablas). Se ejecutó `pnpm migrate` (209 tablas) y se arrancó `commerce-api` en `127.0.0.1:19085`; contenedor healthy y `/health` 200.
- Tienda oficial creada con `create-official-seller.ts`: `sel_01M7NH1254S7Z1HZ7YQTJT39N7`, nombre AgeStyles, estado `open`, moneda `usd`, `external_id=agestyles-official`.
- Dry-run del importador en modo producción con `catalog-supabase-links` y `AGESTYLES_PRODUCTION_REUSE_SOURCE_IMAGES=true`: bundle válido, 33 productos, 19 categorías, 33 variantes, 31 imágenes de origen, 0 escrituras.
- Pendiente: crear el usuario admin de producción (`medusa user` con `admin.env`) y obtener el bearer token; después `--apply`. Siguen faltando región, ubicación de stock, ofertas/precios e inventario. Las webs públicas siguen apuntando al laboratorio.

## F6 — catálogo importado en producción — 17 de noviembre de 2026, 21:00 UTC

- Usuario admin de producción creado con `medusa user` desde `admin.env` privado. Token obtenido por `/auth/user/emailpass` sin imprimirlo.
- `import-catalog-bundle-to-medusa.mjs --apply` en modo `production` con `catalog-supabase-links` y `AGESTYLES_PRODUCTION_REUSE_SOURCE_IMAGES=true`: 19 categorías y 33 productos creados, 0 omitidos.
- Verificación SQL de solo lectura: 33 productos `draft` con 33 `external_id` distintos, 33 variantes, 31 imágenes (todas URLs de Supabase), 19 categorías inactivas, 33 vínculos `product_seller` con `sel_01M7NH1254S7Z1HZ7YQTJT39N7`. Dos productos sin miniatura (el origen tiene 31 imágenes para 33 productos).
- Siguen pendientes: región USD, ubicación de stock de la tienda oficial, ofertas/precios, inventario (19 saldos), activar categorías y publicar productos. Las webs públicas siguen apuntando al laboratorio. Backup cifrado + restore de producción aún no existe.

## F6 — oferta comercial oficial en producción — 17 de noviembre de 2026, 22:00 UTC

- Decisiones del propietario: mercado Cuba en USD y CUP, stock desde los saldos de Supabase, recogida gratis + entrega a domicilio (5 USD por defecto), excluir el producto de 0 USD y el de 1600 USD (código 1031). Tasa CUP: debe tomarse de elTOQUE (`eltoque.com/tasas-de-cambio-cuba/dolar`); la página devolvió 403 a la descarga automática.
- **CUP no aplicado:** Medusa 2.22.3 no incluye `cup` en su tabla `currency` y el módulo de monedas no ofrece alta soportada. La tienda queda solo en USD. Opciones: mostrar CUP como conversión informativa en las apps con la tasa de elTOQUE (como hacía el legado), o registrar la limitación y valorar un alta de moneda antes de cobrar en CUP.
- Saldos leídos con la clave anon (`product_variant_stock`, solo publicados): 19 filas, 2 positivas (13 uds), ambas de talla/presentación sin variante en Medusa. `tools/migration/build-official-offer-plan.mjs` genera el plan privado `~/.local/share/agestyles-migrations/official-offer-plan-2026-11-17.json` (31 ofertas).
- `apps/commerce-api/src/scripts/setup-official-commerce.ts` (idempotente, dry-run por defecto, guardas de producción) se ejecutó montado en la imagen `a078cf4`: tienda `AgeStyles` en USD, región `Cuba` (`reg_01M7NJ8R4MZ4ME34ZJSG61XH43`, `pp_system_default`), región fiscal `cu`, ubicación `AgeStyles Oficial` (`sloc_01M7NJ8RATF2PVE8JJ77683RKS`, La Habana) con zona Cuba, opciones `Recogida en tienda` 0 USD y `Entrega a domicilio` 5 USD, 31 ofertas `AGS-OF-<código>` de 8 a 145 USD.
- Variantes: Nike (1015) pasa a opción `Talla` = `Hombre 9.5` con 3 uds; Glicinato de Magnesio (1018) a `Presentación` = `120` con 10 uds. El resto tiene 0 uds.
- Pendiente: productos siguen `draft` y categorías inactivas; publicar cuando se revise el catálogo. CUP, cambio de las webs públicas a la API de producción, backup cifrado/restore y UAT siguen abiertos.

## F6 — catálogo oficial publicado en producción — 17 de noviembre de 2026, 22:30 UTC

- `apps/commerce-api/src/scripts/publish-official-catalog.ts` (idempotente, dry-run por defecto) se ejecutó montado en la imagen `a078cf4`: 31 productos con oferta vinculados a `Default Sales Channel` (antes 0 productos tenían canal) y publicados; 5 categorías activadas (las usadas y sus padres). Los 2 productos sin oferta (0 USD y código 1031) y las 14 categorías vacías siguen ocultos.
- Verificación por la Store API de producción (`127.0.0.1:19085`, clave publicable sin imprimir): región `Cuba/usd`, `/store/products` devuelve 31 productos y los 31 tienen `calculated_price` en USD; `/store/product-categories` lista Suplementos vitamínicos; Ropa, calzado y accesorios; Ferretería; Calzado; Electricidad.
- No se cambió el origen de las webs públicas: `catalogo.eav-labs.com`, Buyer y Business siguen usando la API del laboratorio. Para exponer producción falta túnel/HTTPS, CORS y la clave publicable en sus builds. Siguen abiertos CUP, backup cifrado/restore y UAT.

## Webs públicas conectadas a la API de producción — 17 de noviembre de 2026, 21:45 UTC

- API pública única: `https://agestyles-api.eav-labs.com` → túnel Cloudflare compartido → `buyer-gateway` de producción (`127.0.0.1:19186`, sin prefijo) → API `19085`. El usuario añadió el hostname en el panel del túnel (CNAME protegido) y guardó una copia privada de la configuración anterior.
- Verificación HTTPS (resolviendo vía 1.1.1.1/8.8.8.8): `/store/regions` 200, `/store/products` 31 productos, preflight CORS desde `tienda.eav-labs.com` 204 con `access-control-allow-origin`, `/admin/*` y `/vendor/*` 404, origen ajeno 403.
- Copias de `.env.storefront-web` y `.env.buyer-web` en `~/.local/share/agestyles-deploy/env-backups-20261117` (600). Ambos apuntan ahora a `https://agestyles-api.eav-labs.com` con la clave publicable de producción.
- `tienda.eav-labs.com`: exportación Expo nueva (`entry-2e63090358a896c8432ba58112ba3e54.js`) desplegada; el bundle contiene la URL de producción y ninguna referencia al laboratorio. Healthz local 200. Sin recorrido visual en navegador.
- `catalogo.eav-labs.com`: configuración cambiada; el reinicio espera a que los resolvedores del proveedor del VPS (195.179.224.53, 209.126.15.53) caduquen la respuesta negativa cacheada (SOA mínimo 1800 s).
- Hallazgo previo: el gateway del laboratorio (`descargas.eav-labs.com/agestyles-lab`) devolvía 502 porque reenvía a `19081` y la API del laboratorio escucha en `19080`.
- Pendiente: el aviso de portada de Buyer aún dice que catálogo y pedidos son de prueba; el enlace APK sigue apuntando al APK de laboratorio; Negocio no está conectado a producción, así que la tienda oficial no puede gestionar pedidos desde la app todavía.

## Corrección de stock migrado — 17 de noviembre de 2026, 22:30 UTC

- Síntoma: en `tienda.eav-labs.com` casi todas las fichas salían «Agotado». Causa: el plan de ofertas solo leyó `product_variant_stock`; el legado calcula disponibilidad con la suma de esas filas cuando existen y, si no hay filas, con `products.stock`. Trece productos (1001–1013) tenían 1 unidad en `products.stock` y quedaron con 0.
- `build-official-offer-plan.mjs` ahora recibe un snapshot de disponibilidad con esa regla (`~/.local/share/agestyles-migrations/legacy-availability-2026-11-17.json`, lectura anon). Las reservas activas del legado no son legibles con la clave anon; se usaron unidades físicas.
- `setup-official-commerce.ts` informa diferencias de stock de ofertas existentes y solo las reescribe con `AGESTYLES_OFFICIAL_SYNC_STOCK=true`. Con 0 pedidos y 0 reservas en producción se aplicaron 13 cambios 0→1. Store API: 31 ofertas, 15 `in_stock` (1001–1013, 1015, 1018), 26 unidades.

## Catálogo y Negocio conectados a producción — 17 de noviembre de 2026, 22:45 UTC

- `catalogo.eav-labs.com` recreado con `.env.storefront-web` apuntando a `https://agestyles-api.eav-labs.com` (clave publicable de producción) cuando el DNS del proveedor del VPS dejó de devolver la respuesta negativa. Healthz 200; la portada pública lista productos de producción en USD y las 5 categorías activas.
- `negocio.eav-labs.com`: `seller-gateway` de producción en `127.0.0.1:19187` con prefijo `/negocio`; ruta del túnel `agestyles-api.eav-labs.com` + `^/negocio/` añadida por el usuario por encima de la entrada general. Export Expo (`entry-38841f7483ffb4654a37ec296d36d98f.js`) desplegado; recorrido HTTPS externo del titular: login 200, selección de tienda 200, 31 productos.
- Avisos pendientes de decisión: pie del catálogo «Experiencia beta · Productos y pedidos de prueba» y aviso equivalente en la portada de Tienda. El producto Nike (1015) trae del legado la descripción literal «prueba».

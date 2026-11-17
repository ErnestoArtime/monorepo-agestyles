# Auditoría de cumplimiento del plan maestro AgeStyles 2.0

**Corte:** 17 de noviembre de 2026, 10:03 UTC (revalidado tras CI `1cc09b0`)
**Alcance:** contraste de `AGESTYLES_2_0_PLAN_MAESTRO.md`, `STATUS_PLAN_MAESTRO.md`, `MATRIZ_REUTILIZACION.md`, `CODEX_HANDOFF.md` y el grafo de código del monorepo.
**Conclusión:** el plan sigue en ejecución; ninguna de las fases F0–F8 puede marcarse completa con la evidencia disponible. F9 está correctamente diferida. El laboratorio de marketplace y varias verticales están avanzadas, pero siguen pendientes gates de datos, validación en dispositivos, QA, despliegue y cutover.

## Fases F0–F9

| Fase / salida exigida | Evidencia actual | Estado y brecha | Próxima acción compatible con el plan |
|---|---|---|---|
| **F0 — Protección y auditoría:** backup restaurable de PostgreSQL, Storage y Auth; mapa verificado; capacidad; cero cambios al flujo actual | La base activa sigue intacta. Hay mapa actualizado por agregados de solo lectura y contrato sintético, pero no export real ni esquema vivo en `pg_dump`. La medición del host permanece alrededor de 3.1 GiB libres. | **Abierta.** Sin destino cifrado, backup o restore probada; no correr build pesado ni ETL con la capacidad actual. | Acordar y medir destino externo; después producir backup cifrado, manifiestos y restore aislado. No ejecutar sobre la fuente antes de ese gate. |
| **F1 — Spike Mercur:** cuatro tiendas/dos organizaciones, roles, producto/ofertas, carrito dividido, publicación, extensiones y decisión formal | Verificadores previos reportan una matriz de 54 checks para Sole Society/A2 y 46 para Kickz/B2. Reejecución de este corte: Sole Society/A2 pasó 54/54; Kickz/B2 falló al listar pedidos (`GET /vendor/orders` 500 donde se esperaba 200). Lecturas posteriores acotaron la respuesta: Kickz/B1 da 500 con campos predeterminados, `limit=20`, `fields=id` y los campos pedidos por el verificador; B2 da 200 con las mismas variantes. Los 46 resultados previos requieren repetición después de diagnosticar el endpoint. Identidad dual API y carrito A2+B2 con cotización idempotente, expiración y split siguen documentados. `medusa-mercur-capability-matrix.md` y ADR-002/003/004/005 documentan decisiones. `verify-order-quotes.mjs` incluye un cambio reversible de precio condicionado a que A2 tenga región EUR y restaura la escala completa en `finally`; no se ejecutó aquí. El comando global también crea pedidos/grupo y cambia stock temporalmente, por lo que no sirve como probe aislado. | **Parcial.** Hay un 500 acotado a la lista de pedidos de Kickz/B1 que requiere diagnóstico. El último estado registrado dice que A2 no tiene región EUR; la rama condicional no prueba una mutación real. Se creó `verify-price-revision.mjs` con guardas loopback y restauración exacta; no se ejecutó y no hay decisión formal de seguir; falta confirmar recuentos independientes del pedido agrupado. | Capturar stack trace del 500 y repetir la matriz Kickz/B2; usar el nuevo probe price-only solo cuando A2 ya tenga EUR; cerrar las brechas y registrar decisión formal antes de declarar F1 completa. |
| **F2 — Monorepo reproducible:** workspace Nx/pnpm, lockfile, CI con lint/format/test/typecheck, grafo, Expo Android/web y health API/Next | GitHub Actions run [44060215811](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44060215811), commit `1cc09b0`, terminó success: install congelado, lint, format-check, tests, typecheck, build aislado Medusa y exports Buyer/Business/Storefront. Validación local actual: tests 8/8, typecheck 12/12, lint 0 errores/20 advertencias, formato PASS. | **Parcial.** Falta build nativo y evidencia de arranque en Android/iOS; lint/format y CI quedan incorporados. | Preparar builds nativos en equipos con capacidad suficiente y validar el flujo Expo en dispositivo real/emulador. |
| **F3 — Catálogo y marketplace web:** facetas/búsqueda, dos sellers con oferta, tienda pública, SEO, privacidad, compra en staging | `storefront-web` está en `catalogo.eav-labs.com`; categoría `flip-flops` y ficha vendedor renderizan. Source fixes de foco, contraste AA, movimiento reducido y paginación pasaron typecheck/detector y Next build, y están publicados. | **Parcial.** Las webs de catálogo y buyer, portal business y APK responden 200 en HTTP; aún falta inspección visual/teclado real, prueba completa de privacidad, dataset de staging o checkout web multivendedor. | Verificar visual/teclado en navegador, ampliar privacidad y completar compra web de dos vendedores. |
| **F4 — Buyer app:** catálogo, carrito mixto, cotización, cuenta/pedidos; recorrido Android + web y preparación iOS | App Expo SDK 54 y checkout multivendedor por gateway público verificado. El detalle de compra muestra grupos y líneas por vendedor e incorpora llamadas de tracking por pedido; la web publicada lleva esa interfaz. El handler fuente filtra el pedido por el comprador autenticado. El API desplegado responde 404 a `/store/orders/{id}/tracking`; OC-07 dejó un plan seguro para contratos sintéticos y workflow desechable. Se añadieron etiquetas/roles/estado accesibles en carrito y pago; typecheck pasa, TalkBack no se probó. Un intento local con `medusa exec` no pasó: el fixture contiene relaciones de fulfillment previas y la cancelación/limpieza no quedó confirmada; el verificador se cambió para requerir un pedido limpio, pero falta revalidarlo. No hay Android conectado ni Mac/Xcode. | **Parcial.** Falta desplegar el endpoint, validar ownership autenticado con fixture limpio y completar recorrido visual/nativo. | Seguir OC-07 para probar contrato y workflow en un entorno desechable; publicar el endpoint solo con margen y SHA identificable. Preparar Android/iOS/TalkBack en los equipos adecuados. |
| **F5 — Business app + modo comprador:** funciones seller, permisos, transición buyer/seller con sesión independiente y sin segundo login | App Expo de negocio publicada en `negocio.eav-labs.com`; 100 checks de roles y auth dual API; el resolver añade tests unitarios sintéticos para owner/inventory/viewer/admin, rol desconocido y mismatch de seller/member IDs. El modo Comprar con customer session aislada se integró en paquete compartido y exportó sin URLs locales. Se publica en el portal; gateways buyer/seller admiten las rutas Store API requeridas, cuotas customer/member y cotizaciones idempotentes, sin Admin API. Externamente catálogo/regiones/ofertas=200, customer anónimo=401, Admin=404. | **En curso.** Falta validar login customer/member, alternancia y cotización desde navegador/dispositivo con cuentas sintéticas. Fulfillment, fotos/variantes y pruebas nativas también faltan. | Ejecutar flujo completo de owner/viewer; probar cambio business→buyer→business sin perder sesión y quote/order con dos sellers. Completar fulfillment y media después. |
| **F6 — ETL y reconciliación:** mapa origen, backup restaurado, ETL idempotente, medios/Auth/históricos, informe conciliado | `docs/migration/legacy-source-map.md` documenta entidades, relaciones, conteos SQL agregados, destinos y brechas. `tools/migration/**` valida el contrato sintético; el proyector deduplica objetos de medios por SHA-256 y conserva orden/primaria en las referencias. El validador comprueba esos metadatos, unicidad de hashes y concilia hashes únicos, moneda/estado y presencia de store ID. Sus tests no se conectan a Supabase ni importan a Medusa. | **Preflight sintético solamente.** Falta esquema vivo aprobado, backup/restore, export/import, idempotencia contra staging y conciliación real. Siguen abiertas decisiones de moneda, seller, inventario y medios. | Resolver F0 y las decisiones del mapa; después probar export/dry-run/import idempotente en copia aislada y conciliar entidades/hashes. |
| **F7 — QA y piloto:** API/E2E/BOLA, Android/iOS, UI/a11y, carga, archivos, pagos, rollback, restore, observabilidad y UAT | Verificadores de laboratorio cubren roles, carrito multivendedor, identidad, cotizaciones, PIM y pagos. Tests 8/8, typecheck 12/12, lint 0 errores/20 advertencias y formato PASS; el CI `2140711` completó también build Medusa y exports web Buyer/Business/Next. La matriz Kickz/B1 sigue detenida por un 500 cuya causa requiere captura controlada; el resultado anterior de B2 no se cuenta como revalidación actual. | **Parcial.** Sin E2E/BOLA completa, recorrido visual/teclado/lector, dispositivos, carga, medios, restore, rollback, observabilidad o UAT; no hay conteo verificado de incidentes P0. | Diagnosticar el 500 en entorno desechable; ampliar pruebas E2E/BOLA, visuales y operativas tras resolver capacidad/dispositivos. |
| **F8 — Producción/cutover:** freeze/delta, backup final, un escritor, reconciliación, rollback y archivo legacy | El status confirma que dominio principal y datos no se migraron y que las betas siguen identificadas como pruebas. | **No iniciada por gate.** Requiere backup/restore, F6/F7 completas y decisión explícita go/no-go; no existe aprobación de negocio. | Mantener sistemas actuales como fuente única. Preparar runbook después de completar hitos anteriores; no conmutar DNS/tráfico ni retirar Supabase sin aprobación y evidencia de rollback. |
| **F9 — Evolución posterior:** AI Studio y demás capacidades P1/P2 después del piloto | No se observa AI Studio; la matriz lo deja diferido. | **Diferida correctamente.** Depende del piloto F7 y la decisión F8. | No iniciar hasta aprobar piloto; luego delimitar IA con aprobación humana, cuotas/costes y versiones de medios. |

## Aceptación del piloto (plan §14)

1. **Marketplace público, varias tiendas, carrito común:** catálogo público, facetas por categoría, páginas de vendedor y checkout API multivendedor por el gateway público están publicados/probados. **Parcial:** falta validar el recorrido visual y el checkout desde la interfaz del comprador en navegador/Android.
2. **Dos propietarios × dos tiendas sin cruces:** status registra 100 comprobaciones de roles y aislamiento. **Evidencia de laboratorio**, aún falta incluir recorrido UAT coordinado.
3. **Editor, variantes, stock, fotos, aprobación/rechazo:** stock y roles probados; editor de título/descripción envía cambios a revisión. **Parcial:** faltan flujo visible de aprobación/rechazo y fotos/variantes end-to-end.
4. **Aceptar cotización A1+B1 y seguimiento por línea:** quote+split de dos sellers probado por API; buyer UI ahora presenta grupo y líneas por seller y llama el endpoint de tracking por cada pedido. **Parcial:** endpoint de tracking no está disponible en el API desplegado (`Cannot GET`), y falta recorrido UI de quote/order group.
5. **Buyer instalada en Android e iOS:** **No cumplido/verificado.** No hay Android conectado al entorno ni Mac/Xcode.
6. **Business app y modo comprador reutilizan mismo paquete:** integración en `@agestyles/features-buyer` exportada y publicada; el namespace customer tiene test unitario. **Parcial:** falta recorrer autenticación, cotización/aceptación y vuelta a modo negocio desde UI con sesiones reales.
7. **Contratos y operaciones críticas reproducibles, cero incidentes críticos:** existen pruebas parciales y verificadores; **no hay suite completa ni resultado de seguridad que pruebe cero incidentes**.
8. **Datos históricos reconciliados o archivo explícito sin pérdidas:** **No cumplido**; falta mapa, ETL, conciliación y decisión histórica.
9. **PostgreSQL, Redis/objetos seguros, backup/restore, release y rollback:** PostgreSQL/Redis de laboratorio están aislados; **faltan destino/objetos, restore, monitoreo y rollback**.
10. **Sitio anterior recuperable y un solo escritor:** fuente sigue activa e intacta, sin cutover. **Estado seguro actual**, pero no hay evidencia de procedimiento de rollback/cutover probado.

## Dependencias externas que impiden cerrar el plan

- **F0/F6/F7:** destino cifrado de backup/restore con capacidad suficiente. El VPS solo tiene 3.5 GiB libres, swap casi agotado y aloja proyectos ajenos; no ejecutar `prune` ni builds grandes para crear espacio.
- **F4/F5/F7:** teléfono Android para la prueba en dispositivo; el host no enumera dispositivo. iOS requiere equipo macOS con Xcode.
- **F8:** decisión go/no-go firmada por negocio después de superar los gates previos.
- **F6/F8:** acceso aprobado y ventana de trabajo para mapear/exportar desde la fuente; nunca incluir filas personales o secretos en Git.

## Evidencia de código consultada

El grafo del monorepo está indexado. La arquitectura muestra apps `commerce-api`, `buyer-app`, `business-app`, `storefront-web` y paquetes `catalog-pim`, `manual-payments`, `features-buyer`, `quotations`, `api-client`, `domain`, `icons` y `design-tokens`. El grafo identifica funciones `SellerPermissionsService.resolvePermissions`, `business-buyer-session.loginBuyer/getBuyerSession/logoutBuyer`, `ProductExplorer`, handlers de cotización y comparación. Esta evidencia confirma que hay implementaciones, pero por sí sola no demuestra builds, despliegue, autorización end-to-end ni aceptación del piloto.

**Regla de cierre:** actualizar esta auditoría con resultados medidos, no con intención. Una fase pasa a completa solo cuando su criterio de salida completo tiene evidencia actual verificable.

## Revalidación local — 17 de noviembre de 2026, 10:03 UTC

- La corrida completa actual de `pnpm test` pasa 8/8 targets (8 en caché); `pnpm typecheck` pasa 12/12 (11 en caché); `pnpm lint` termina con 0 errores y 20 advertencias; `pnpm format:check` y `git diff --check` pasan.
- OC-09: revisión estática de Business no encuentra `Colors.light` ni colores hexadecimales locales en pantallas; el directorio y la ficha pública de tienda tienen reglas oscuras. No se pudo inspeccionar render visual: este host no tiene navegador automatizable ni dispositivo conectado. F4/F5/F7 siguen parciales y no se altera el estado de sus gates externos.
- El cambio siguiente, `09b5ed2`, alinea el color por defecto nativo de los iconos con `@agestyles/design-tokens`. CI [run 44050404722](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44050404722) terminó success, incluidos typecheck, tests, build Medusa, exports Expo web y build Next; esto aún no prueba las pantallas en Android/iOS.

## Addendum de avance — 17 de noviembre de 2026, 04:50 UTC

- Gates locales del estado actual: `pnpm test` 4/4; `pnpm typecheck` 12/12; `pnpm lint` 0 errores y 36 advertencias; `pnpm format:check` pasó. Tras una edición concurrente, el typecheck dirigido de Buyer pasó y la repetición global de Nx terminó 12/12. Ninguno de estos controles prueba el runtime Mercur, el build móvil ni el cutover.
- F4: el comprador tiene cambios locales de diseño para catálogo, ficha, carrito y checkout, con tema nativo derivado del sistema. El código no se compiló para dispositivo en este corte.
- F3: se añadieron estilos oscuros por preferencia del navegador al catálogo y páginas de vendedor en `apps/storefront-web/src/app/styles.css` y `seller-pages.css`. Pasan typecheck del storefront, Prettier y `git diff --check`; falta build, inspección visual y publicación.
- Sistema visual: `docs/design-system.md` ahora establece como requisito claro/oscuro y uso de tokens semánticos. La cobertura completa de Business y de pantallas secundarias del comprador sigue en OC-09; no se cierra por el mero éxito del typecheck.
- No hubo export/build, pruebas E2E, prueba manual de pantalla, restauración, ETL ni modificación de servicio. El disco permanece a 3.5 GiB libres; F0/F1/F5/F6/F7/F8 mantienen sus gates pendientes. La carpeta `references/` sigue ignorada.
- HTTP de solo lectura confirmó 200 para catálogo, app web compradora, portal de negocio y AgeStyles anterior. No valida sesiones, flujos funcionales, accesibilidad ni los cambios locales de tema oscuro.
- Auditoría reciente de logs de órdenes: no se vieron respuestas 500 en las 46 líneas retenidas en 36 h, pero no existe atribución tienda/actor; el incidente histórico Kickz/B1 sigue sin resolver de forma demostrable.
- La paleta compartida ahora tiene tokens de foreground para acciones/éxito/error y un test WCAG AA/paridad CSS. Business y Buyer siguen el tema del sistema en sus pantallas trabajadas; el cambio local aún requiere revisión visual y publicación.
- Gates actuales: pruebas 5/5, typecheck 12/12, lint 0 errores/30 advertencias. El nuevo flujo manual de publicación por GHCR todavía está en elaboración y no se ha ejecutado.

## Addendum de verificación — 17 de noviembre de 2026, 05:19 UTC

- Se corrigieron dos errores detectados por los gates del árbol local: la prop de retorno del paso de pago y el uso de `getPrice` en el explorador. Typecheck pasó 12/12; `pnpm test` pasó 5/5; lint global pasó sin errores y con 28 advertencias; formato y `git diff --check` pasaron.
- El tema claro/oscuro ahora tiene implementación en las rutas revisadas de Buyer y Business y en el storefront. No hay inspección visual reciente ni build móvil; el criterio visual de OC-09 sigue abierto.
- La publicación tiene workflow manual por SHA y overrides Compose separados, validados mediante `docker compose config`. No se ha publicado el código local: remoto `main` sigue en `636a774`, los tres contenedores web usan imágenes antiguas y no se ejecutó Actions, pull o despliegue.
- Límite operativo sin cambios: 3.5 GiB libres en el único disco. Sigue pendiente un destino externo cifrado; no se ejecutó prune, backup, restore, ETL ni cutover.

## Addendum de publicación — 17 de noviembre de 2026, 05:32 UTC

- Se subieron a `main` los cambios de temas (`162fbf4`), el lockfile corregido (`192122d`) y la localización española de rutas Buyer (`202eff8`). El CI completo de `192122d` y `202eff8` terminó success.
- El pipeline CI de `202eff8` pasó lint, formato, tests, typecheck, exports web Buyer/Business y build SEO Next. Esto no equivale a imágenes runtime publicadas ni a deploy.
- En esta comprobación, las webs públicas todavía usan imágenes anteriores. El siguiente paso del runbook requiere ejecutar `Publish frontend images` para un commit de `main` con CI exitoso y desplegar el tag inmutable por servicio.
- En `202eff8` terminaron success todos los gates, incluidos los builds Buyer/Business/storefront. Un preflight público del comprador respondió 204 con `x-medusa-locale` y `x-publishable-api-key` permitidos; `store/regions` y `store/products?limit=1` respondieron 200 con la configuración de la app. Esto demuestra disponibilidad del gateway, no que el bundle web anterior cargue/renderice correctamente.

## Addendum de auditoría de paleta — 17 de noviembre de 2026, 05:35 UTC

- `business-app` tenía dos colores hexadecimales locales para superficies secundarias. Se movieron a los tokens compartidos TypeScript/CSS y la app los consume desde `@agestyles/design-tokens`.
- El test de color comprueba ahora contraste WCAG AA sobre fondo, superficie tranquila y superficie seleccionada en modo claro y oscuro. Localmente: 5/5 tests, 12/12 typechecks, ESLint de archivos afectados y Prettier pasan. Falta CI remoto de este cambio y visualización real; OC-09 continúa abierta.

## Addendum de CI de tokens — 17 de noviembre de 2026, 05:41 UTC

- El commit `57fdec5` está en `main`. Su CI pasó instalación congelada, lint, formato, 5/5 tests, 12/12 typechecks, exports Buyer/Business y build SEO storefront.
- `quietSurface` y `selectedSurface` ahora se definen en TypeScript y CSS y se consumen desde Business; el test verifica contraste WCAG AA para ambas en tema claro y oscuro.
- Gateway buyer responde CORS 204 y devuelve una región y 12 productos para la configuración actual de la app. El bundle web público aún es anterior; visualización de la nueva UI y publicación siguen pendientes.

## Addendum de publicación — 17 de noviembre de 2026, 05:44 UTC

- El runbook contiene los valores públicos actuales de buyer (`descargas.eav-labs.com/agestyles-lab`), negocio (`descargas.eav-labs.com/agestyles-seller`), storefront (`catalogo.eav-labs.com`), buyer (`tienda.eav-labs.com`) y propietario GHCR (`ernestoartime`). La clave publicable se copiará directamente de la configuración local y no se incluirá en el documento.
- Verificación pública con esa clave: preflight buyer 204, `store/regions` 200/1 y `store/products?limit=100` 200/12; preflight seller desde el dominio de negocio 204. Esto confirma los gateways, no la interfaz web ya desplegada.
- El workflow de imágenes está activo pero no ejecutado; el conector de GitHub disponible no permite crear variables de Actions ni iniciar `workflow_dispatch`. Se solicitó al usuario configurar las variables y lanzar el workflow; el despliegue VPS queda pendiente de un tag GHCR resultante.

## Addendum de seguimiento — 17 de noviembre de 2026, 05:55 UTC

- F4/F7: la ruta de tracking tiene prueba de contrato ejecutable sin DB. Cubre actor anónimo (401 y sin consulta), ID no propio (404 sin etiqueta) y lectura del pedido propio (proyección por línea y label).
- Localmente `pnpm test` pasa 6/6, typecheck 12/12, lint 0 errores/20 warnings; Prettier, ESLint dirigido y `git diff --check` pasan. El test fue agregado al objetivo Nx `test` del workspace.
- Sigue faltando desplegar la ruta al API runtime y probar ownership sobre un fixture limpio. No se hizo escritura, consulta a DB, rebuild ni reinicio de servicio. El nuevo commit/Ci aún está pendiente.

## Revalidación de tareas OpenCode y preflight F6 — 17 de noviembre de 2026

- CI del commit `2140711` terminó success con instalación congelada, lint, formato, tests, typecheck, build Medusa aislado y exports Buyer/Business/Storefront. Los gates locales más recientes pasan: tests 8/8, typecheck 12/12, lint 0 errores/20 advertencias y formato PASS.
- OC-09: se reemplazaron dos checks y una flecha de texto por iconos de `@agestyles/icons`. La inspección estática está actualizada; la aceptación visual clara/oscura completa sigue pendiente por falta de navegador automatizable/dispositivo Android/iOS conectado.
- F6: el proyector de solo lectura agregó conciliación sintética agregada de conteos fuente/staging, moneda/estado y presencia de `store_id`; una repetición idéntica mantiene los mismos hashes. `migration:test` pasa 11/11. No demuestra correspondencia store→seller ni datos reales.
- F6: `variant_options: []` y `"[]"` ahora generan la variante `__default__` requerida por el contrato. `migration:test` pasa 12/12 y `pnpm test` 8/8; no se procesaron filas reales.
- F0/F6 no avanzan a datos reales: sigue pendiente un destino cifrado/restauración aislada y el `pg_dump --schema-only` autorizado. No se accedió a filas, ni se hizo exportación/importación.
- CI del commit `c79f5f7` terminó success, incluyendo lint, formato, tests, typecheck, build Medusa aislado y exports web Buyer/Business/Storefront.
- El commit F5 `9b37aea` también pasó CI [44057675651](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44057675651) con build Medusa aislado y las exportaciones Buyer/Business/Storefront.
- F5: Business declara el paquete workspace `@agestyles/features-buyer`, usa sus exports públicos de carrito/sesión (sin importar rutas internas) y Nx confirma la arista de dependencia. Tests sintéticos cubren login customer, recuperación, logout y error de sesión. Esto mejora la base modular, pero no prueba los flujos UI, refresh, revocación ni sesiones reales; la fase sigue en curso.


## Addendum de conciliación de medios y estado remoto — 17 de noviembre de 2026, 10:03 UTC

- `main` y `origin/main` coinciden en `1cc09b0`; su CI [44060215811](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44060215811) está en `success`.
- F6: proyección local deduplica objetos con mismo SHA-256; las referencias de producto conservan `display_order`/`is_primary`. `catalog-only` rechaza orden no entero/negativo/duplicado/no ascendente, más de una imagen principal, `media_count` inconsistente, hashes repetidos y MIME incompatible. `migration:test` 14/14. Esto no crea ETL real ni prueba datos fuente/destino.
- Gates locales revalidados: `pnpm test` 8/8, `pnpm typecheck` 12/12, lint 0 errores/20 advertencias, `pnpm format:check` y `git diff --check` PASS.
- El plan maestro ya no afirma que el código local esté sin sincronizar; la versión actual está en GitHub. El despliegue de imágenes continúa sin evidencia para este commit.
- El auditor OC-08 observó que Mercur 2.4.1 carga relaciones anidadas amplias en `/vendor/orders` incluso con `fields=id`; es una pista para capturar stack trace, no causa raíz demostrada. No se propone cambiar defaults ni se reejecutó el endpoint/matriz.
- Ninguna fase F0–F8 cierra sus criterios globales; F9 permanece diferida. Persisten los gates externos de backup/restore, datos/importación, dispositivo, QA/UAT y decisión de negocio.


## Addendum de permisos seller — 17 de noviembre de 2026

El resolver `SellerPermissionsService` ahora tiene tests sintéticos ejecutados dentro del target de Commerce API: owner, inventory manager, viewer, admin, rol desconocido y mismatch de tienda/miembro. Resultado dirigido: 6/6 incluyendo tracking; Nx: 8/8 y typecheck: 12/12. La prueba usa un repositorio de membresías en memoria y no demuestra BOLA de ruta/DB, revocación runtime ni UI.


## Addendum de permisos e infraestructura local — 17 de noviembre de 2026, 10:19 UTC

- El commit actual `1bb366a` tiene CI exitoso [run 44063162920](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44063162920). Localmente: Commerce API test 6/6, monorepo 8/8, typecheck 12/12, lint 0 errores/20 avisos, formato PASS.
- F1/F5: pruebas unitarias del resolver verifican el mapping de owner, inventory manager y SUPPORT/viewer, admin/rol desconocido y los tres IDs usados al consultar la membresía. Esto no cubre autorización end-to-end, BOLA en API/DB ni UI.
- Capacidad actual verificada por lectura: 3.2 GiB libres, swap prácticamente agotada y ningún dispositivo Android listado; sin builds/descargas ni limpieza. iOS sigue requiriendo Mac/Xcode.
- Permanecen sin prueba los criterios completos F0–F8; el avance de contrato no cambia las puertas de backup/restore, dispositivo, E2E/UAT, datos reales o go/no-go.


## Addendum de rutas públicas — 17 de noviembre de 2026, 10:24 UTC

Lecturas frescas: las portadas catálogo, tienda compradora y negocio respondieron 200; el gateway buyer devolvió regiones 200 y productos 200 (`count=12`). La ruta `/store/orders/order_synthetic/tracking` devuelve 404/`Cannot GET` tanto desde loopback del API como desde el gateway, por lo que la ruta fuente sigue ausente de la imagen vigente. Los códigos 200 no demuestran que el render/checkout UI funcione. No se autenticó un customer ni se hicieron escrituras. CI de `a223c9b` terminó success [run 44063714270](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44063714270).


## Preparación segura de la publicación API — 17 de noviembre de 2026

Se corrigió el desajuste que hacía apuntar EXPOSE, healthcheck y verificación del runbook a `19080` cuando `pnpm start` y ambos gateways usan `19081`. Se agregó `publish-config.test.mjs` para mantener alineados esos cinco puntos. Localmente: API 7/7; Nx 8/8; typecheck 12/12; lint 0 errores/20 advertencias; formato y `docker compose config --services` correctos. No se ejecutó build/publicación GHCR ni se tocó el VPS: el runbook requiere margen suficiente para mantener imagen de rollback y hay 3.2 GiB disponibles. F4 sigue pendiente del despliegue y comprobación de tracking.


## CI de la corrección de puerto — 17 de noviembre de 2026

El commit `ec0bd17` está en `main` y su CI [44066099747](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44066099747) finalizó success. La corrección y test de consistencia pasan compilación/test remoto; esto no publica la imagen ni demuestra runtime/health en el host. El endpoint de tracking continúa no disponible en la imagen desplegada.

## Addendum de build de imagen API — 17 de noviembre de 2026

CI del commit `3444eef` [run 44067825900](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44067825900) terminó success e hizo build con el `Dockerfile.public` exacto, sin publicación. La extensión en `c9b7502` pasó CI [run 44068837811](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44068837811): migraciones en PostgreSQL efímero, runtime API con Redis efímero y respuesta `/health` correcta. Esto verifica build/runtime en CI aislado, no despliegue en VPS ni endpoints comerciales protegidos; por sí solo no cierra F2/F7.

## Addendum de pruebas del carrito Buyer — 17 de noviembre de 2026

El commit `8923f88` añade cobertura para el feature compartido de carrito: carrito guardado/obsoleto, limpieza y creación regional, transferencia y añadir ofertas de dos vendedores al mismo carrito. Sus 6 pruebas de paquete pasan. CI [run 44071834569](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44071834569) terminó success: incluye typecheck, lint, formato, pruebas, build no publicado de API, migraciones/healthcheck en PostgreSQL/Redis desechables y export/build web. La validación no incluye UI/browser ni reemplaza el checkout de laboratorio; F4/F5/F7 permanecen parciales.

## Addendum de gateway buyer — 17 de noviembre de 2026, 11:13 UTC

Preflight público desde la tienda compradora: HTTP 204, allow-origin coincide exactamente con `https://tienda.eav-labs.com`, headers permitidas `x-publishable-api-key,x-medusa-locale`; regiones HTTP 200/1, productos HTTP 200/12 usando la región retornada y miniaturas declaradas 12/12 HTTP 200. La clave publicable no se guardó ni se imprimió. Esto descarta en este corte un fallo de CORS, listado de catálogo o disponibilidad HTTP de miniaturas en el gateway; no prueba que la app visualice la respuesta ni que el checkout UI funcione.

OC-09: queda pendiente la inspección visual completa de temas claro/oscuro y TalkBack. No se detectó un navegador de automatización ni dispositivo Android conectado; el host dispone de 3.1 GiB, por debajo del mínimo documentado de 8 GiB para crear un AVD. Los exports/builds web en CI son satisfactorios, pero no verifican render ni interacción visual.

## Revalidación de identidad seller y esquema fuente — 17 de noviembre de 2026, 11:27 UTC

El resolver de permisos seller valida explícitamente la identidad completa de la membresía retornada (membership/member/seller IDs). Pruebas sintéticas adversariales cubren la respuesta de un owner/admin ajeno en cada uno de esos tres campos; `commerce-api test` 8/8, typecheck y checks dirigidos de lint/formato pasan. CI [run 44074681686](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44074681686) terminó success con build no publicado de API, migración/healthcheck sobre PostgreSQL/Redis de CI y builds web. Esto aporta defensa local, sin cerrar BOLA por HTTP/DB.

El proyecto fuente continúa con 80 migraciones aplicadas hasta `20261116061921`. La migración de repositorio `20261116120000_merchant_product_media.sql` está pendiente y define funciones para imágenes de borradores merchant; no es una migración de los productos/media legados. Se dejó sin aplicar, en línea con el gate de backup/restore. No se leyeron filas comerciales.

## Smoke runtime de tracking — 17 de noviembre de 2026, 11:48 UTC

CI [run 44078209194](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44078209194) terminó success con build no publicado, migraciones/health de API sobre servicios desechables y exports web. El request de tracking sin `x-publishable-api-key` recibe 400 del middleware Store; el test de handler separado cubre 401 sin sesión, 404 para pedido ajeno y la proyección del dueño. Es evidencia de ruta/imagen en CI, no del VPS ni de una compra autenticada runtime. La ruta publicada continúa pendiente de despliegue y validación.

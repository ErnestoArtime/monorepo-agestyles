# Cola de trabajo para OpenCode

> **Archivada el 17 nov 2026.** Las tareas y su estado viven ahora en el [tablero único](./TABLERO.md), compartido por Codex, Claude Code y OpenCode. Las tareas abiertas de esta cola (OC-08, OC-09 y el trabajo con dueño de Codex) pasaron al tablero como AG-02, AG-11 a AG-14. Este archivo se conserva como historial.

Usar esta lista para avanzar el [plan maestro](./AGESTYLES_2_0_PLAN_MAESTRO.md) en paralelo con Codex. Antes de empezar cada tarea, revisar `AGENTS.md`, este archivo, `docs/STATUS_PLAN_MAESTRO.md`, `docs/CODEX_HANDOFF.md` y `git status`. Registrar aquí los archivos modificados, comandos ejecutados y resultados en `docs/CODEX_HANDOFF.md`.

## Reglas de coordinación

- No revertir, limpiar, formatear en masa ni sobrescribir cambios existentes sin entender quién los hizo.
- No escribir en Supabase, cambiar tráfico/DNS/túnel, publicar, desplegar ni hacer cutover.
- No copiar datos personales, contraseñas, tokens ni dumps al repositorio. Trabajar con fixtures sintéticos.
- No modificar `docs/STATUS_PLAN_MAESTRO.md`; Codex consolida ese estado.
- Si `git status` o una nueva entrada en el handoff muestra que otra persona ya trabaja en los mismos archivos, escoger otra tarea y anotarlo.

## Tareas disponibles

### OC-01 — Mapa del esquema legado para F0/F6

**Estado:** auditoría completada por OpenCode; corrección de tipos P1 completada por Codex (17 nov 2026)
**Prioridad:** P0
**Resultado:** [docs/migration/legacy-source-map.md](./migration/legacy-source-map.md). Solo esquema del repositorio, sin filas, credenciales, conexión ni migraciones. Identifica brechas y decisiones pendientes para ETL.

Inspeccionar el repositorio histórico AgeStyles disponible en el entorno y documentar tablas/entidades, relaciones, claves, estados, monedas, medios e identidades relevantes para el ETL. Es una revisión de código/esquema; no leer filas personales ni exportar datos.

**Aceptación:** mapa por entidad con campos de origen, destino propuesto en Medusa/Mercur/AgeStyles y brechas; referencias a rutas/migraciones fuente; dudas marcadas como pendientes, sin inventar relaciones. No modificar la fuente ni ejecutar migraciones.

### OC-02 — Pruebas de contrato para carrito y cotizaciones

**Estado:** completada por Codex (17 nov 2026)
**Prioridad:** P0
**Archivos trabajados:** `packages/domain/src/order-quotes.ts`, `packages/domain/test/order-quotes.test.ts`, `packages/domain/package.json` y `apps/commerce-api/src/api/store/order-quotes/[id]/accept/route.ts`.

Se extrajeron las decisiones puras de precondición/transición al paquete de dominio. Las pruebas usan fixtures sintéticos deterministas y no llaman al API, DB, Redis ni red.

**Resultado:** cubre revisión inválida/obsoleta, expiración en el límite, estado no disponible, transición de recotización, aceptación repetida con el mismo grupo y transiciones accepting/accepted. El test de aceptación repetida prueba la decisión pura; cargar el grupo existente y no volver a ejecutar el workflow siguen siendo integración API. `corepack pnpm test` pasa 4/4 tareas y `corepack pnpm --filter @agestyles/commerce-api typecheck` pasa.

### OC-03 — Preparación de build Android de laboratorio

**Estado:** completada por Codex (17 nov 2026), `blocked-by-capacity`
**Prioridad:** P1
**Resultado:** [docs/mobile/android-build-readiness.md](./mobile/android-build-readiness.md). Node/Java/SDK listos parcialmente; no hay dispositivo conectado ni imagen AVD; quedan 3.7 GiB libres frente al mínimo de 8 GiB. Las dos `.env.local` apuntan a localhost, que el Android no alcanza. No se ejecutaron builds ni descargas.

Comprobar toolchain (Node, Java, Android SDK, Gradle), configuración Expo y disponibilidad de dispositivo/emulador. Proponer el build de comprador y negocio conectado solo al laboratorio. **No iniciar Gradle/EAS ni descargar imágenes de emulador si quedan menos de 8 GiB libres**; el host debe conservar margen para los demás servicios. No subir APK ni instalarla en dispositivos.

**Aceptación:** prerequisitos y comandos exactos, configuración faltante, coste estimado de disco y decisión `ready`/`blocked-by-capacity` con evidencia medida. Si está listo, dejar preparado el procedimiento de build reproducible sin ejecutarlo; Codex coordinará la ejecución.

### OC-04 — Configuración incremental de lint y formato para F2

**Estado:** completada por Codex (17 nov 2026)
**Prioridad:** P1
**Resultado:** ESLint 9.39.2 con reglas base JS/TS y ajustes Expo/Next por app; Prettier `format:check` sobre archivos modificados con `FORMAT_BASE_REF` en CI. `pnpm lint` → 0 errores y 36 advertencias visibles; `pnpm format:check` → PASS. `.prettierignore` explica Markdown, lockfile y el seed histórico (sin baseline consistente) para no reformatear su dataset completo; ESLint y TypeScript siguen cubriendo ese seed. El CI ejecuta ambos checks después de instalación congelada.
**Archivos permitidos:** configuración de raíz (`package.json`, `pnpm-lock.yaml`, `nx.json`, `.github/workflows/ci.yml`) y archivos de configuración nuevos para ESLint/Prettier. Si aparece una infracción, añadir una lista concreta de archivos; no reformatear toda la base.

Definir una configuración mantenible para TypeScript/Expo/Next/Medusa y conectar checks reales a CI. Primero medir compatibilidad con los paquetes ya instalados y la cobertura que ofrecen las configuraciones oficiales de cada stack. No añadir comandos vacíos ni usar `nx format:check` sin un formatter instalado. Si lograr una única regla completa exige un cambio masivo o decisiones de estilo incompatibles, proponer una implantación por etapas con cobertura explícita.

**Aceptación:** `pnpm lint` y `pnpm format:check` ejecutan herramientas reales en CI; documentar paquetes/rutas cubiertos, exclusiones justificadas y deuda inicial. No modificar lógica de negocio.

### OC-05 — Auditoría de adopción del sistema compartido de iconos

**Estado:** completada por OpenCode y Codex (17 nov 2026)
**Prioridad:** P1
**Resultado:** [docs/ui/icon-ecosystem-audit.md](./ui/icon-ecosystem-audit.md). El paquete compartido mantiene paridad web/nativo; los defectos de tipos, accesibilidad, glifos, tokens y cobertura propia identificados en la auditoría se corrigieron. La inspección visual y TalkBack en dispositivos siguen pendientes como parte de OC-09; no bloquean el cierre de esta auditoría estática.

**Archivos permitidos:** `apps/**` (solo lectura), `packages/icons/**` (solo lectura), `docs/design-system.md` (solo lectura) y `docs/ui/icon-ecosystem-audit.md` (nuevo informe). No editar componentes ni dependencias.

Revisar si comprador, negocio y web pública usan de forma consistente el paquete compartido `@agestyles/icons`, incluyendo navegación, botones y estados seleccionados/en foco. Identificar importaciones de iconos directas, glifos de texto, SVG locales y componentes heredados del ejemplo; comprobar los exports nativo/web y documentar diferencias justificadas por plataforma. Evaluar nombres/tamaños/colores, visibilidad de estados activos, accesibilidad (etiqueta o texto accesible) y el coste de unificar los casos pendientes. Excluir íntegramente `references/`: es material de consulta y no debe subirse al repositorio.

La auditoría es de lectura: no instalar paquetes, cambiar código de aplicación ni publicar. Si encuentra un defecto, anotar ruta y símbolo concretos, severidad y una propuesta breve; Codex decidirá después qué correcciones implementar.

**Aceptación:** informe con alcance revisado, evidencia por app/plataforma, lista priorizada de brechas y verificación posible sin dispositivo. Declarar explícitamente si algún estado nativo o visual requiere validación posterior en Android/iOS.

### OC-06 — Aislar el probe de cambio de precio para F1

**Estado:** completada por Codex (17 nov 2026; script no ejecutado)
**Prioridad:** P1
**Archivos permitidos:** `apps/commerce-api/scripts/verify-price-revision.mjs` (nuevo). No modificar `package.json`, lockfile, API, seed, región del vendedor ni datos del laboratorio.
**Resultado:** nuevo verificador limitado a A2 que valida host/API/PostgreSQL loopback, lee regiones antes de crear carrito/cotización y termina `unsupported` sin esas escrituras si no existe EUR. La rama EUR guarda y restaura la escala completa, verifica `409/requoted` y comparación exacta; no acepta la cotización ni toca pedidos, pagos o inventario. `node --check`, Prettier y `git diff --check` pasan. No se ejecutó contra el laboratorio.

`verify-order-quotes.mjs` contiene un cambio reversible de precio A2, pero está combinado con la aceptación de carrito A2+B2, creación de pedidos/grupo, cambios temporales de stock y expiración. Crear un script dedicado que pruebe únicamente la revisión de cotización después de cambiar una oferta A2.

Antes de cualquier escritura, exigir API `127.0.0.1:19081`, `DATABASE_URL` del PostgreSQL aislado en `127.0.0.1:15472` y credenciales sintéticas suministradas por variables de entorno. Leer vendedor/regiones primero. Si A2 no tiene región EUR, terminar como `unsupported` sin crear carrito/cotización ni escribir datos; **no asignar regiones**. Si EUR existe, guardar la escala completa original, crear carrito de una oferta, pedir cotización, aplicar temporalmente +1, comprobar `409/requoted` y nueva revisión, y restaurar la escala original en `finally`; releer y comparar todos los campos para confirmar restauración. No completar pedido ni tocar inventario, pagos, expiraciones o permisos.

No ejecutar el nuevo script contra el laboratorio. El estado compartido registrado no tiene región EUR para A2 y el laboratorio de fulfillment tiene una incidencia aparte. No imprimir ni guardar credenciales.

**Aceptación:** script autocontenido y revisado, salida no sensible `unsupported` antes de escrituras cuando falte EUR, guardas loopback antes de cada mutación y restauración/verificación exacta en la rama viable. Incluir el comando manual de ejecución en comentario del propio script; no agregarlo al paquete raíz.

### OC-07 — Diseño seguro de verificación para tracking F4

**Estado:** completada por Codex (17 nov 2026; procedimiento no ejecutado)
**Prioridad:** P1
**Archivos permitidos:** `docs/mobile/order-tracking-verification.md` (nuevo). Revisar `apps/commerce-api/src/api/store/orders/[id]/tracking/route.ts` y `apps/commerce-api/src/scripts/verify-order-tracking.ts` en solo lectura.
**Resultado:** procedimiento separado en contrato sintético, workflow sobre PostgreSQL/Redis desechables con `run_id` y comprobación runtime de una imagen identificada. Exige customer dueño/ajeno/anónimo, fixture sin fulfillments, logs saneados y descartar los volúmenes completos; no declara publicada la ruta. No se llamó API/DB ni se ejecutó el verificador.

Preparar un plan de verificación separado en (a) prueba de contrato de la ruta con consultas/respuestas sintéticas, y (b) prueba de workflows reales únicamente en PostgreSQL/Redis desechables con fixtures identificados por `run_id`. La ruta fuente existe, pero el servicio publicado respondió `Cannot GET`; no asumir que el deploy la contiene. El verificador actual elige pedidos con relaciones de fulfillment potencialmente nulas, crea un envío real y luego intenta revertir marcadores y cancelar: una reversión que no está soportada de forma fiable.

**Límites estrictos:** no ejecutar el verificador; no llamar API ni DB, no crear/cancelar fulfillments, no modificar stock/reservas, no limpiar ni reparar el laboratorio compartido, y no editar código de aplicación. En pruebas reales, recomendar descartar/restaurar toda la base aislada tras crear un envío; no borrar filas ni revertir `shipped_at` directamente. Documentar precondiciones, observabilidad, limpieza y criterios de aprobado/fallido, incluyendo el caso de customer ajeno.

**Aceptación:** procedimiento accionable, separado por nivel de aislamiento, que identifica la inconsistencia de fixture como riesgo y no declara validado el endpoint desplegado sin evidencia del runtime. Registrar hallazgos en `docs/CODEX_HANDOFF.md`; no modificar `docs/STATUS_PLAN_MAESTRO.md`.

### OC-08 — Diagnóstico del 500 de pedidos en Kickz/B2

**Estado:** diagnóstico estático completado por Codex (17 nov 2026; causa raíz abierta)
**Prioridad:** P1
**Archivos permitidos:** solo lectura para `apps/commerce-api/**`, `infra/compose/**`, `package.json` y los manifiestos de Mercur/Medusa instalados. Informe nuevo: `docs/lab/kickz-orders-500.md`. Handoff: `docs/CODEX_HANDOFF.md`.
**Resultado:** `docs/lab/kickz-orders-500.md` confirma que la query de Mercur añade campos de relaciones anidadas incluso con `?fields=id`; no hay stack trace persistido disponible. Una lectura estática adicional del paquete instalado 2.4.1 encontró defaults anidados amplios y una nota upstream sobre expansiones profundas que pueden provocar 500; esto vuelve plausible, pero no demuestra, una relación problemática en los pedidos de B1. No se cambian los defaults porque podrían quitar datos que necesita la UI sin arreglar el dato causante. El diagnóstico no confirma causa raíz ni cierra F1. Sin requests, escrituras, cambios de servicios o datos.

La última ejecución de `corepack pnpm lab:verify:kickz-roles` falló al esperar 200 de `GET /vendor/orders?limit=20&fields=id,display_id,status,total` para el owner de Kickz/B1; el API devolvió 500 `An unknown error occurred`. En una comprobación posterior de solo lectura con el mismo owner, Kickz/B1 devuelve 500 tanto con campos predeterminados como con `fields=id`; B2 devuelve 200 para ambas variantes. Esto acota el fallo al alcance de B1 o a sus pedidos/relaciones, no a un campo solicitado concreto. La matriz Sole Society/A2 pasó 54/54 en el corte anterior. La limpieza `finally` del verificador retiró las membresías temporales.

Determinar si existe una diferencia entre la consulta de pedidos de Kickz y la otra organización, examinar los logs del proceso Medusa si están disponibles y relacionar el error con configuración, filtros, datos de pedido o relaciones. Mantener secretos/token fuera del informe. No revelar valores de `.env`; no autenticar con credenciales adicionales ni repetir el verificador.

**Límites:** no modificar código/configuración ni datos, no reiniciar/reconstruir servicios, no consultar o modificar Supabase y no tocar pedidos, inventario, reservas ni membresías. Si los logs ya no están disponibles, dejarlo indicado y preparar el siguiente paso de captura para una ejecución autorizada, sin ejecutarla.

**Aceptación:** informe que separa evidencia observada de hipótesis, identifica los módulos/archivos relevantes y propone una corrección mínima con verificación reproducible solo para laboratorio. No declarar corregido ni cerrado F1; Codex revisará cualquier cambio de implementación por separado.

### OC-09 — Cerrar temas claro/oscuro y gates del árbol de trabajo

**Estado:** revisión estática y gates locales actualizados por Codex (17 nov 2026): 8/8 pruebas Nx, 12/12 typechecks, lint sin errores (19 advertencias), formato PASS. Los glifos de texto de selección/envío y regreso al modo negocio se sustituyeron por `@agestyles/icons`. Sigue pendiente la inspección visual clara/oscura en navegador/dispositivo. No requiere build ni publicación para continuar el desarrollo.
**Prioridad:** P0
**Archivos permitidos:** cambios existentes de `apps/business-app/**`, `apps/buyer-app/app.json`, `apps/buyer-app/components/android-app-link.tsx` y `docs/design-system.md`. No reescribir los rediseños de Buyer, el CSS del storefront ni archivos de otro autor sin revisar su diff.

**Hallazgo de Codex (17 nov 2026):** `apps/buyer-app/app.json` fijaba `userInterfaceStyle: "light"` pese a que las pantallas consumen `useColorScheme()`. Se cambió a `automatic` y se verificó con los gates locales enumerados en el handoff.

El requisito del plan es que comprador, negocio y catálogo web funcionen con tema claro y oscuro. Buyer ya sigue `useColorScheme()` en las pantallas principales; el storefront Next acaba de incorporar `prefers-color-scheme`. Auditar el trabajo actual de Business y la banda de descarga Android del comprador, eliminar colores `light` fijados en runtime donde impidan el tema oscuro, y mantener todos los iconos desde `@agestyles/icons`.

**Avisos del corte:** una corrida global detectó transitoriamente un error de símbolos `Colors` en `android-app-link.tsx` mientras se editaba; una corrida posterior del typecheck de Buyer pasó. El árbol de trabajo cambió durante las comprobaciones, así que verificar el estado actual antes de concluir. `pnpm format:check` pasó después de formatear únicamente archivos modificados. No inferir que la corrida anterior sustituye la validación final.

**Aceptación:** inspección de claro y oscuro para rutas completas de Buyer/Business/storefront (no solo del home), `corepack pnpm typecheck`, `corepack pnpm lint`, `corepack pnpm format:check` y `corepack pnpm test` con resultados registrados; cero errores de tipos/lint/formato. Advertencias heredadas se anotan sin ocultarlas. Evitar build nativo/web pesado mientras el host siga por debajo del margen de disco; no tocar `references/`, servicios, publicación ni DNS.

## Trabajo terminado en esta sesión Codex

- F3: facetas de categoría en API, combinables con búsqueda y persistidas en URL (`apps/storefront-web/**`). Typecheck y verificador del laboratorio pasaron en cinco categorías.
- F6: validador de dry-run del contrato intermedio de exportación (`tools/migration/**`). Cinco pruebas sintéticas pasaron; no consulta bases de datos ni red.
- F4/F5: `business-app` reutiliza `@agestyles/features-buyer` para el modo Comprar con actor customer separado; su web y la web compradora se reexportaron.
- Web pública: filtros/facetas y tienda de vendedor están desplegados en `catalogo.eav-labs.com`; buyer y negocio se desplegaron desde el estado actual del monorepo.
- Gateways buyer/seller: ambos usan el API vigente `19081`, permiten las rutas Store API requeridas por sus apps y reenvían `idempotency-key`; categorías y directorio de vendedor están disponibles para SSR público. No exponen Admin API.
- CI: `pnpm test` ejecuta cuatro paquetes y precede al typecheck en GitHub Actions; 11 typechecks pasan.
- OC-02: decisión de precondición y transiciones puras de cotización en `@agestyles/domain`, consumidas por la ruta de aceptación; prueba incluida en el target del paquete y de Nx.
- OC-04: lint/formato real en CI con exclusiones explícitas y 36 advertencias iniciales visibles.
- OC-06: probe price-only aislado preparado con guardas y restauración exacta; no ejecutado.
- OC-07: procedimiento seguro para verificar tracking en datos sintéticos y entornos desechables; no ejecutado.
- OC-08: 500 de pedidos Kickz acotado por revisión estática; la causa raíz aún requiere captura de stack trace.
- F5: flujo de preparación de pedidos seller en Business añadido en esta sesión. El endpoint AgeStyles usa el workflow de fulfillment de Mercur, valida permiso `orders:edit`, pertenencia del pedido y de la ubicación, y cantidades restantes. La UI muestra el detalle, las líneas pendientes y las ubicaciones propias. CI [run 44101193002](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44101193002) terminó success en PostgreSQL/Redis efímeros: owner autorizado; gestor de inventario y solo lectura reciben 403; ubicaciones ajenas y repetición denegadas. El endpoint no está desplegado ni validado visual/nativamente.
- A11y buyer: botones de cantidad/eliminación y opciones de pago tienen rol/estado/etiqueta accesible; typecheck pasa. TalkBack aún requiere dispositivo.

## Trabajo que sigue teniendo dueño en la sesión Codex

- Conseguir un destino cifrado con capacidad para completar F0; restaurar el backup aislado antes de contrastar esquema/ETL F6.
- Capturar el 500 de Kickz/B1 en una ejecución desechable y repetir la matriz solo después de corregir/entenderlo.
- Crear espacio suficiente para builds nativos y disponer de Android/macOS-iOS para prueba visual/TalkBack.
- Desplegar el endpoint de tracking con un SHA identificable cuando haya margen de disco y completar su verificación runtime.
- Completar checkout visual web, pruebas E2E/BOLA/carga/media/rollback, UAT y decisión go/no-go. F8 sigue sin autorizar cutover.

Las áreas ya publicadas están cerradas para nuevos cambios en paralelo salvo que una incidencia verificable las reabra. No modificar archivos con cambios pendientes en `git status` sin revisar el handoff.

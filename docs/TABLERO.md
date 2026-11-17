# Tablero único de AgeStyles 2.0

Fuente única de tareas y progreso para **todas** las personas y agentes que trabajan en el monorepo: Codex, Claude Code y OpenCode. Si una tarea no está aquí, no existe; si su estado aquí no está al día, es lo primero que se corrige.

## Objetivo único

**Operar AgeStyles 2.0 en producción con la tienda oficial y alcanzar la paridad funcional con el catálogo legado para poder retirarlo**, cumpliendo los criterios de piloto del [plan maestro §14](./AGESTYLES_2_0_PLAN_MAESTRO.md#14-criterios-de-aceptación-del-piloto-agestyles-20).

Este objetivo abarca el ecosistema completo: API y módulos propios, Catálogo público, Tienda web y app Buyer, panel web y app Negocio, infraestructura de publicación y preparación de las apps Android/iOS. Claude y Codex avanzan mediante las tareas de este tablero; cada integración que afecte producción, datos o reglas comerciales requiere revisión cruzada y autorización del usuario para desplegar.

Hoy (17 nov 2026) Tienda, Catálogo y Negocio ya usan la API de producción (`https://agestyles-api.eav-labs.com`) con 31 productos de la tienda oficial. Lo que falta para el objetivo: seguridad operativa (copias y restauración), paridad con el legado, QA real y la decisión de corte del legado.

## Documentos y para qué sirve cada uno

| Documento | Uso | Quién escribe |
|---|---|---|
| `docs/TABLERO.md` (este) | Tareas, responsable, estado y siguiente paso | Cualquier agente, siguiendo el protocolo |
| `docs/CODEX_HANDOFF.md` | Registro de turnos: qué se cambió, comandos y resultados | Cualquier agente; solo añadir al final |
| `docs/STATUS_PLAN_MAESTRO.md` | Estado por fase del plan maestro | Lo consolida Codex; los demás proponen cambios en el registro |
| `AGENTS.md` | Reglas de proyecto (extensiones, temas, español, coordinación) | Cambios acordados con el usuario |

## Protocolo de coordinación

1. **Antes de empezar:** `git pull --rebase`, leer este tablero, las últimas entradas de `docs/CODEX_HANDOFF.md` y `git status`.
2. **Tomar una tarea:** poner `Estado: en curso`, `Responsable` (`codex`, `claude` u `opencode`) y la fecha UTC; hacer commit y push **solo de ese cambio** antes de tocar código. Si al hacer push hay conflicto en la fila, otro agente la tomó: elegir otra.
3. **No tocar** archivos que una tarea `en curso` de otro responsable declara en «Archivos», salvo acuerdo anotado en la tarea.
4. **Al terminar:** `Estado: hecha` con commits y verificación ejecutada (tests, typecheck, lint, comprobaciones en producción). Añadir la entrada al registro. Si queda algo, crear otra tarea en lugar de dejarlo implícito.
5. **Bloqueos:** `Estado: bloqueada` con el motivo y qué decisión o recurso falta; si depende del usuario, marcar `Decide: usuario`.
6. **Revisión cruzada:** toda tarea que cambie producción, infraestructura, datos migrados o reglas de negocio queda `hecha · revisión pendiente` hasta que el otro agente la revise y anote su conformidad o hallazgos.
7. **Producción:** desplegar, migrar o escribir datos en producción solo con autorización explícita del usuario en esa sesión, y registrar exactamente qué se hizo.
8. **Git:** commits pequeños por tarea con su ID en el mensaje (`AG-07: …`); nunca `push --force` ni reescribir historia en `main`; CI de `main` en verde antes de dar una tarea por hecha.
9. **Reparto:** cuando dos tareas no comparten archivos pueden avanzar en paralelo; si una depende de otra, indicarlo en «Depende de».

Estados: `pendiente` · `en curso` · `bloqueada` · `hecha · revisión pendiente` · `hecha`.

## En curso

| ID | Tarea | Responsable | Estado | Siguiente paso |
|---|---|---|---|---|
| AG-01 | Desplegar la API con la tasa CUP y fijar la tasa | claude | en curso (17 nov, 21:40 UTC) | API desplegada (`9b16175`, `sha256:c3235c65…`); `/store/agestyles/exchange-rate` responde `null`. Falta fijar la tasa (decide: usuario: valor de elTOQUE o token de su API). |
| AG-03 | Historial de movimientos de inventario: altas, bajas, ajuste rápido con motivo obligatorio, filtros por producto/fecha/usuario y exportación CSV en Negocio | claude | hecha · revisión pendiente (producción 18 nov) | API (`sha256:b1b512f1…`) y web de Negocio (`entry-7cb3ced5…`, desde `112a072`) en producción; +/− y movimientos usan el historial. Revisión cruzada: codex. |
| AG-16 | Disco del VPS al 99 %: inventario de solo lectura y propuesta de limpieza revisada | claude | bloqueada (decide: usuario/codex) · nivel 1 hecho 17 nov | Nivel 1 ejecutado con aprobación del usuario: 2,9 → 22 GB libres. Pendiente: nivel 2 (imágenes rollback y restos `/tmp` de AgeStyles, confirmación de Codex) y nivel 3 (otros proyectos). Detalle en [reviews/2026-11-17-disco-vps.md](./reviews/2026-11-17-disco-vps.md). Hallazgo para AG-08: enlace `current` de la web legada a una release borrada. |
| AG-07 | Avisos «beta / datos de prueba» → aviso de **piloto** en Tienda (portada) y Catálogo (pie) | claude | hecha (17 nov) | Publicado en Tienda y Catálogo: «AgeStyles en fase piloto». Sin «beta/prueba» visible; «APK de prueba para Android» se mantiene porque el APK es el del laboratorio. |
| AG-06 | Gestores de venta y comisiones | claude | en curso: diseño (18 nov) · bloqueada por 4 decisiones del usuario | Propuesta en [design/AG-06-gestores-y-comisiones.md](./design/AG-06-gestores-y-comisiones.md): paquete `packages/sales-commissions`, reglas por producto y generales por tienda, libro de saldo y retiros en efectivo. Faltan: atribución de ventas, precedencia, umbral acumulable y flujo de retiro. |
| AG-04 | Etapas de preparación del pedido: sin preparar → en preparación → listo → despachado → entregado, visibles en Negocio y seguimiento Buyer | codex | implementación lista · revisión pendiente (17 nov 2026) | Negocio y Buyer usan `/vendor/agestyles/orders/:id/fulfillments`; el endpoint mantiene seller scope/permisos y usa workflows oficiales de Mercur/Medusa. `packed_at` nulo representa preparación; los hitos siguientes son listo, despachado y entregado. Buyer los ve por línea. Typecheck local de API, Business, Buyer y domain pasa; el snapshot existente se actualizó. CI #119 (`44191912325`) verde: typecheck, unitarias, checks HTTP de permisos fulfillment y exportaciones web. Sin producción modificada. Falta revisión cruzada de Claude. |
| AG-15 | Revisión conjunta del estado del plan: contrastar `STATUS_PLAN_MAESTRO.md` con el plan maestro, tablero, commits y evidencias actuales; proponer correcciones y criterios de cierre | codex; revisión de claude | hecha (17 nov 2026, 21:55 UTC) | Consolidado por codex (`0ffbc5a`) y revisado por claude: conforme, con 3 omisiones para la próxima consolidación (§6 de la [revisión](./reviews/2026-11-17-status-plan-maestro.md)). |
| AG-21 | Incorporar al estado del plan las omisiones de la revisión final de AG-15 | codex; revisión de claude | hecha (17 nov 2026; revisada por claude, conforme) | Añadidos stock y regla/limitación de reservas, dependencia de Supabase Storage en F8/riesgos y paridad CUP, WhatsApp, favoritos y AG-17…AG-20 en `STATUS_PLAN_MAESTRO.md`. Claude revisó el diff de `8fd8c29`: conforme. |

## Pendientes (por prioridad)

| ID | Prioridad | Tarea | Responsable | Depende de | Notas |
|---|---|---|---|---|---|
| AG-02 | P2 (aplazada) | Copia cifrada diaria de PostgreSQL de producción fuera del VPS y restauración probada en una base aislada | codex (ya era su tarea de F0) | Aplazada por decisión del usuario (17 nov) | El usuario decidió aplazar el backup externo por ahora; el riesgo sigue documentado en STATUS. |
| AG-05 | P1 | Importar y corregir catálogo por CSV (altas y correcciones de fichas incompletas) desde Negocio | codex (implementación lista · revisión pendiente, 17 nov 2026) | — | Pantalla `apps/business-app/app/catalog-import.tsx`, parser `apps/business-app/lib/catalog-csv.ts` y acceso desde Productos. Reutiliza `/vendor/products` y `/vendor/products/:id` de Mercur, con seller-scope y permiso `products`; altas/correcciones pasan por revisión. Previsualiza y rechaza filas ambiguas. CSV no importa precios, ofertas ni stock. Typecheck local y formato pasan; CI #119 (`44191912325`) verde con unitarias, typecheck y exportación de Negocio. Falta revisión cruzada de Claude. |
| AG-10 | P2 | Gateway del laboratorio devuelve 502: reenvía a `19081` y la API del laboratorio escucha en `19080` | sin asignar | — | Afecta solo al laboratorio. |
| AG-11 | P0 | Compra real de punta a punta en navegador y Android contra producción (incluye WhatsApp y CUP) | codex | AG-01 | Junto con E2E/BOLA/carga/UAT ya asignados a Codex. |
| AG-12 | P1 | Causa raíz del 500 de pedidos Kickz/B1 (antes OC-08) | codex | — | Diagnóstico estático hecho; falta captura del stack trace. |
| AG-13 | P1 | Inspección visual clara/oscura de Buyer, Business y Catálogo (antes OC-09) | codex | — | Gates locales ya pasan. |
| AG-14 | P1 | Builds nativos Android/iOS y TalkBack | codex | Espacio en disco y dispositivos | — |
| AG-17 | P2 | Comparador de productos (el legado tenía `/comparar`) en Catálogo y Tienda | codex (hecha · revisión pendiente, 18 nov 2026) | API `/store/catalog-comparison` existente | Implementado en Catálogo web y Buyer; CI #128 (`44196983180`, `112a072`) verde. Falta revisión cruzada de Claude; gateway público requiere publicación/reinicio autorizado para llegar a usuarios. |
| AG-18 | P2 | Páginas de marcas y de novedades (legado: `/marcas/[marca]`, `/novedades`) | sin asignar | — | 14 marcas en el origen; las marcas no se migraron como entidad. |
| AG-19 | P1 | Avisos al cliente con reintentos (outbox) y bandeja «Mis pedidos» | sin asignar | AG-04 | El legado tenía outbox transaccional y supervisión. |
| AG-20 | P2 | Devoluciones parciales desde Negocio y Tienda | sin asignar | AG-11 | Medusa las soporta; faltan pantallas y permisos. |

## Revisión cruzada pendiente

| Qué | Hecho por | Revisa | Referencia |
|---|---|---|---|
| Runtime de producción: migraciones, tienda oficial, importación de 33 productos, región Cuba/USD, almacén, envíos, 31 ofertas, publicación y corrección de stock (15 con stock, 26 uds) | claude | codex | Registro 17 nov, entradas F6; commits `85d2d17`, `0dd9241`, `9329475` |
| Gateways de producción (`/` compradores en `19186`, `/negocio` vendedores en `19187`) y cambio de Tienda, Catálogo y Negocio a `agestyles-api.eav-labs.com` | claude | codex | `f768465`, `761ae62`, `e542448`, `60eff7e` |
| CUP de referencia y enlaces de WhatsApp por tienda | claude | codex | `9b16175` |
| AG-04 — etapas de preparación en Negocio y seguimiento Buyer | codex | claude | CI #119 (`44191912325`), commits `ed674e6` y fixes posteriores |
| AG-05 — altas y correcciones de catálogo por CSV en Negocio | codex | claude | CI #119 (`44191912325`), commits `83b5c51`, `3394bdf` |
| AG-17 — comparador de productos en Catálogo y Buyer | codex | claude | CI #128 (`44196983180`, `112a072`): checks y exportaciones web completados |
| AG-03 — movimientos de inventario y exportación CSV | claude | codex (hallazgos 17 nov) | CI #119 (`44191912325`), commits `10fe3b0`, `3a4a789`; falta filtro de autor en UI y publicar Negocio con la interfaz compatible |
| Ediciones de Claude en `docs/STATUS_PLAN_MAESTRO.md` del 17 nov (antes de este protocolo) | claude | codex | Consolidar o reescribir según el criterio de Codex |
| Preguntas abiertas del registro («Pendiente de revisión por Codex», 4 preguntas) | opencode | codex | `docs/CODEX_HANDOFF.md` |

## Hechas recientes

| ID | Tarea | Responsable | Referencia |
|---|---|---|---|
| AG-08 | Un solo sistema vendiendo | usuario | Cerrada el 17 nov: el usuario confirma que el catálogo legado no está vendiendo, así que no hay doble venta que resolver ahora. Queda el hallazgo de AG-16: el enlace `current` de la web legada apunta a una release borrada. |
| — | Español en interfaces, favoritos en Buyer, perfil MinIO del laboratorio | claude | `1b3ae3f`, `09b2204`, `cb5931c` |
| — | Tienda oficial en producción y catálogo publicado | claude | ver revisión cruzada |
| AG-09 | Conservar las fotos en Supabase Storage y usar sus URL HTTPS; no copiarlas al VPS | usuario / codex | Decisión vigente: se mantiene el origen de imágenes de producción; mover a MinIO queda fuera de alcance. |
| OC-01…OC-09 | Cola anterior de OpenCode/Codex | opencode, codex | [Archivo de la cola anterior](./OPEN_CODE_TASKS.md) |

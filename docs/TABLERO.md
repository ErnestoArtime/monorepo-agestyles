# Tablero único de AgeStyles 2.0

Fuente única de tareas y progreso para **todas** las personas y agentes que trabajan en el monorepo: Codex, Claude Code y OpenCode. Si una tarea no está aquí, no existe; si su estado aquí no está al día, es lo primero que se corrige.

## Objetivo único

**Operar AgeStyles 2.0 en producción con la tienda oficial y alcanzar la paridad funcional con el catálogo legado para poder retirarlo**, cumpliendo los criterios de piloto del [plan maestro §14](./AGESTYLES_2_0_PLAN_MAESTRO.md#14-criterios-de-aceptación-del-piloto-agestyles-20).

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
| AG-03 | Historial de movimientos de inventario: altas, bajas, ajuste rápido con motivo obligatorio, filtros por producto/fecha/usuario y exportación CSV en Negocio | claude | en curso (17 nov 2026, 22:00 UTC) · implementado en `10fe3b0`, esperando CI | Módulo `packages/inventory-movements`, rutas `/vendor/agestyles/inventory-movements` (+`/export`), pantalla Movimientos y +/− de Negocio vía historial; el gateway vendedor ya no expone la escritura directa de stock. Siguiente: CI verde (`verify-inventory-movements.mjs`), desplegar API (migración nueva) y Negocio con autorización del usuario, revisión cruzada de Codex. **`tools/scripts/seller-lab-gateway.mjs` queda libre para AG-04.** |
| AG-04 | Etapas de preparación del pedido: sin preparar → en preparación → listo → despachado → entregado, visibles en Negocio y seguimiento Buyer | codex | implementación lista · esperando CI/revisión (17 nov 2026) | Negocio y Buyer usan `/vendor/agestyles/orders/:id/fulfillments`; el endpoint mantiene seller scope/permisos y usa workflows oficiales de Mercur/Medusa. `packed_at` nulo representa preparación; los hitos siguientes son listo, despachado y entregado. Buyer los ve por línea. Typecheck local de API, Business, Buyer y domain pasa; no se ejecutaron pruebas ni se tocó producción. Sigue revisión de Claude y CI remoto. |
| AG-15 | Revisión conjunta del estado del plan: contrastar `STATUS_PLAN_MAESTRO.md` con el plan maestro, tablero, commits y evidencias actuales; proponer correcciones y criterios de cierre | codex; revisión de claude | hecha (17 nov 2026, 21:55 UTC) | Consolidado por codex (`0ffbc5a`) y revisado por claude: conforme, con 3 omisiones para la próxima consolidación (§6 de la [revisión](./reviews/2026-11-17-status-plan-maestro.md)). |
| AG-21 | Incorporar al estado del plan las omisiones de la revisión final de AG-15 | codex; revisión de claude | hecha (17 nov 2026; revisada por claude, conforme) | Añadidos stock y regla/limitación de reservas, dependencia de Supabase Storage en F8/riesgos y paridad CUP, WhatsApp, favoritos y AG-17…AG-20 en `STATUS_PLAN_MAESTRO.md`. Claude revisó el diff de `8fd8c29`: conforme. |

## Pendientes (por prioridad)

| ID | Prioridad | Tarea | Responsable | Depende de | Notas |
|---|---|---|---|---|---|
| AG-02 | P0 | Copia cifrada diaria de PostgreSQL de producción fuera del VPS y restauración probada en una base aislada | codex (ya era su tarea de F0) | Destino con capacidad (decide: usuario) | La base de producción no tiene ninguna copia. |
| AG-05 | P1 | Importar y corregir catálogo por CSV (altas y correcciones de fichas incompletas) desde Negocio o Admin | codex (confirmado por el usuario, 17 nov) | — | Codex hizo las herramientas de migración (`tools/migration`). |
| AG-06 | P2 | Gestores de venta y comisiones: rol, ventas propias, comisión por producto acumulable o no, efectivo/transferencia, reportes para administración | claude (confirmado por el usuario, 17 nov) | AG-03; reglas de comisión (decide: usuario) | Lógica propia de AgeStyles → paquete nuevo en `packages/`. |
| AG-07 | P1 | Textos de los avisos «beta / datos de prueba» en Tienda (portada) y Catálogo (pie) | sin asignar | Texto (decide: usuario) | La descripción del producto Nike (1015) es «prueba» desde el legado. |
| AG-08 | P0 | Un solo sistema vendiendo: congelar o sincronizar el catálogo legado (Supabase) mientras la 2.0 vende | sin asignar | Decisión de negocio (decide: usuario) | Criterio 10 del piloto y F8. |
| AG-10 | P2 | Gateway del laboratorio devuelve 502: reenvía a `19081` y la API del laboratorio escucha en `19080` | sin asignar | — | Afecta solo al laboratorio. |
| AG-11 | P0 | Compra real de punta a punta en navegador y Android contra producción (incluye WhatsApp y CUP) | codex | AG-01 | Junto con E2E/BOLA/carga/UAT ya asignados a Codex. |
| AG-12 | P1 | Causa raíz del 500 de pedidos Kickz/B1 (antes OC-08) | codex | — | Diagnóstico estático hecho; falta captura del stack trace. |
| AG-13 | P1 | Inspección visual clara/oscura de Buyer, Business y Catálogo (antes OC-09) | codex | — | Gates locales ya pasan. |
| AG-14 | P1 | Builds nativos Android/iOS y TalkBack | codex | Espacio en disco y dispositivos | — |
| AG-16 | P0 | Disco del VPS al 99 % (3.0 GiB libres): plan de limpieza revisado de imágenes y builds sin uso | sin asignar | Revisión (decide: usuario) | Bloquea builds y despliegues. No borrar nada sin revisión. |
| AG-17 | P2 | Comparador de productos (el legado tenía `/comparar`) en Catálogo y Tienda | sin asignar | — | Existe `/store/catalog-comparison` en la API; falta la pantalla. |
| AG-18 | P2 | Páginas de marcas y de novedades (legado: `/marcas/[marca]`, `/novedades`) | sin asignar | — | 14 marcas en el origen; las marcas no se migraron como entidad. |
| AG-19 | P1 | Avisos al cliente con reintentos (outbox) y bandeja «Mis pedidos» | sin asignar | AG-04 | El legado tenía outbox transaccional y supervisión. |
| AG-20 | P2 | Devoluciones parciales desde Negocio y Tienda | sin asignar | AG-11 | Medusa las soporta; faltan pantallas y permisos. |

## Revisión cruzada pendiente

| Qué | Hecho por | Revisa | Referencia |
|---|---|---|---|
| Runtime de producción: migraciones, tienda oficial, importación de 33 productos, región Cuba/USD, almacén, envíos, 31 ofertas, publicación y corrección de stock (15 con stock, 26 uds) | claude | codex | Registro 17 nov, entradas F6; commits `85d2d17`, `0dd9241`, `9329475` |
| Gateways de producción (`/` compradores en `19186`, `/negocio` vendedores en `19187`) y cambio de Tienda, Catálogo y Negocio a `agestyles-api.eav-labs.com` | claude | codex | `f768465`, `761ae62`, `e542448`, `60eff7e` |
| CUP de referencia y enlaces de WhatsApp por tienda | claude | codex | `9b16175` |
| Ediciones de Claude en `docs/STATUS_PLAN_MAESTRO.md` del 17 nov (antes de este protocolo) | claude | codex | Consolidar o reescribir según el criterio de Codex |
| Preguntas abiertas del registro («Pendiente de revisión por Codex», 4 preguntas) | opencode | codex | `docs/CODEX_HANDOFF.md` |

## Hechas recientes

| ID | Tarea | Responsable | Referencia |
|---|---|---|---|
| — | Español en interfaces, favoritos en Buyer, perfil MinIO del laboratorio | claude | `1b3ae3f`, `09b2204`, `cb5931c` |
| — | Tienda oficial en producción y catálogo publicado | claude | ver revisión cruzada |
| AG-09 | Conservar las fotos en Supabase Storage y usar sus URL HTTPS; no copiarlas al VPS | usuario / codex | Decisión vigente: se mantiene el origen de imágenes de producción; mover a MinIO queda fuera de alcance. |
| OC-01…OC-09 | Cola anterior de OpenCode/Codex | opencode, codex | [Archivo de la cola anterior](./OPEN_CODE_TASKS.md) |

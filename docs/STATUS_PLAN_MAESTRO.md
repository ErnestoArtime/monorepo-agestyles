# Estado de ejecución del plan maestro AgeStyles 2.0

**Corte:** 17 de noviembre de 2026, 21:45 UTC. La foto combina la lectura de producción de Claude (21:30 UTC) y las acciones posteriores registradas en [`CODEX_HANDOFF.md`](./CODEX_HANDOFF.md). Las horas posteriores a 20:30 que allí aparecen como UTC eran CET (UTC+1); véase la [revisión AG-15](./reviews/2026-11-17-status-plan-maestro.md).

**Objetivo compartido:** operar AgeStyles 2.0 en producción con la tienda oficial y alcanzar paridad funcional con el catálogo legado para poder retirarlo. La fuente antigua sigue activa hasta que exista una decisión de corte y un plan de respaldo/rollback. Ver [tablero único](./TABLERO.md) y [plan maestro](./AGESTYLES_2_0_PLAN_MAESTRO.md).

## Producción hoy

| Área | Estado observado |
|---|---|
| API | `https://agestyles-api.eav-labs.com`; raíz para Buyer vía gateway `19186`, `/negocio/` para Business vía `19187`. API `commerce-api` healthy; PostgreSQL `15473` y Redis `16393` healthy. Imagen `sha256:c3235c651067…` (`9b16175`). |
| Webs | `tienda.eav-labs.com`, `catalogo.eav-labs.com` y `negocio.eav-labs.com` responden 200 y usan la API de producción. Login del titular y carga de 31 productos en Negocio se verificaron por HTTPS. El legado `agestyles.eav-labs.com` sigue activo. |
| Catálogo | Tienda oficial AgeStyles: 31 productos publicados y con oferta USD, 5 categorías activas; 2 productos excluidos siguen como borradores. Las imágenes conservan sus URL públicas de Supabase: no se copian al VPS. |
| Actividad | En la lectura del 17 nov 21:30 UTC: 0 pedidos y 0 clientes en producción. No hay compra real validada. Los dos storefronts están disponibles para vender; no hay evidencia de ventas registradas en ambos. |
| CUP | Endpoint desplegado; la tasa devuelve `null`. No mostrar ni cobrar en CUP hasta fijar la tasa. |
| Capacidad | 3.0 GiB libres (99 % usado) en la lectura de 21:30 UTC. Evitar builds pesados; AG-16 está pendiente de revisar una limpieza segura. |

## Estado por fase

| Fase | Estado | Evidencia vigente | Falta para cerrar |
|---|---|---|---|
| F0 Auditoría y protección | En curso | Supabase legado sigue intacto; no hay copia externa de producción ni restore probado. Los conteos históricos de fuente incluyen 33 productos, 31 imágenes, 48 movimientos y 7 pedidos. | AG-02: destino cifrado, backup de PostgreSQL/Storage/Auth y restauración aislada; revisar hallazgos de seguridad de Supabase. |
| F1 Spike Mercur | Parcial | Carrito de dos vendedores, pedidos separados por tienda y permisos se probaron en el laboratorio. | AG-12: causa del 500 Kickz/B1 y revalidación de matriz; cerrar brechas restantes y decisión documentada de continuar. |
| F2 Monorepo reproducible | Parcial | Nx/pnpm, CI y builds web/API están en uso; verificación de calidad más reciente referenciada en CI/handoff. | Builds nativos y revisión en dispositivos (AG-14); confirmar protección de rama/CODEOWNERS. |
| F3 Catálogo y marketplace web | Parcial | Catálogo público en producción con 31 productos y 5 categorías. | Recorrido visual/teclado, compra web completa y mensajes de beta/prueba coherentes (AG-07, AG-11, AG-13). |
| F4 App comprador | Parcial | Web compradora conectada a producción; soporte de cotización, checkout mixto, seguimiento y WhatsApp está en el código/runtime. El endpoint de tasa CUP aún devuelve `null`. | AG-11: compra real y verificación de pedido/WhatsApp; AG-14: Android/iOS y accesibilidad manual. No hay pedidos/clientes de producción en la foto actual. |
| F5 App negocio | En curso | Web Negocio en producción; login del titular, selección de tienda y listado de 31 productos comprobados por HTTPS. | Flujos seller por rol en producción; etapas completas del pedido (AG-04), movimientos (AG-03), importación CSV (AG-05), medios/UX y builds nativos (AG-14). |
| F6 Migración de catálogo | Parcial: catálogo activo migrado | 33 productos de origen: 31 ofertas USD publicadas en la tienda oficial; 2 quedan en borrador por reglas de precio/exclusión. Fotos referenciadas desde Supabase; 5 categorías activas. | Conciliación documentada de variantes/inventario; decidir y fijar CUP; migrar pedidos/clientes/históricos solo si forman parte del alcance; completar backup/restore (AG-02). Mantener fotos en Supabase según la decisión vigente del usuario. |
| F7 QA y piloto | Parcial | CI cubre contratos/API desechable para carrito, permisos y seguimiento; no sustituye la prueba de las webs ni de la API con compra real. | AG-11/12/13/14: compra real, diagnóstico Kickz/B1, revisión visual y dispositivos; carga/seguridad/rollback y UAT. |
| F8 Producción y retiro gradual del legado | Iniciada, sin go/no-go | Las webs nuevas y el legado están activos a la vez. No hay pedidos/clientes en la lectura de producción; esto es una capacidad dual de venta, no evidencia de doble venta realizada. | AG-02/08/11: backup y restore, decisión de escritor único/sincronización, compra piloto, rollback, criterios de corte y periodo de archivo. No retirar el legado aún. |
| F9 Evolución posterior | No iniciada | AI Studio no forma parte del piloto actual. | Abordar tras cerrar piloto y definir límites, aprobación y costes. |

## Riesgos y decisiones abiertas

1. **Sin backup/restore probado en producción** (AG-02), mientras la nueva plataforma ya está pública.
2. **Dos storefronts disponibles para vender:** el legado sigue activo junto a 2.0 (AG-08). Elegir escritor único o sincronización antes de ampliar operaciones.
3. **Sin compra real en producción:** 0 pedidos/clientes al último corte; verificar pagos, envío, CUP/WhatsApp y seguimiento (AG-11).
4. **Tasa CUP sin fijar:** decidir valor de elTOQUE o acceso autorizado a su fuente (AG-01). No usar una tasa inventada.
5. **Disco al 99 %:** 3.0 GiB libres en la última medición; AG-16 requiere plan y revisión antes de borrar recursos.
6. **Mensajes de beta/datos de prueba** en páginas que ya apuntan a producción y contenido legado con la palabra «prueba» (AG-07); ajustar copy con aprobación del usuario.
7. **Comisiones sin reglas acordadas:** AG-06 depende de que el usuario defina acumulación, base y forma de liquidación.
8. **Laboratorio Buyer devuelve 502** (AG-10); no confundirlo con la API pública de producción.

## Paridad con el catálogo legado

| Capacidad | Pendiente / decisión | Tablero |
|---|---|---|
| Movimientos de inventario con motivo, filtros y exportación | Implementar y revisar el historial de 48 movimientos migrables/consultables. | AG-03 |
| Etapas de preparación y seguimiento del pedido | Completar y mostrar el ciclo en Negocio y Buyer; distinguir la preparación básica ya existente de todo el ciclo. | AG-04 |
| Importación/corrección por CSV | Crear flujo seguro de altas y corrección de fichas incompletas. | AG-05 |
| Gestores de venta y comisiones | Esperar reglas comerciales del usuario; depende del historial de movimientos. | AG-06 |
| Un solo sistema de venta | Resolver relación entre la plataforma nueva y el legado activo antes de corte. | AG-08 |
| Imágenes | Decisión aplicada: mantener las URL HTTPS de Supabase; no copiar los archivos al VPS. | AG-09 fuera del alcance activo |

## Próximos pasos

1. Revisar capacidad del VPS y acordar una limpieza segura antes de más builds (AG-16).
2. Resolver copia cifrada y restore de producción (AG-02).
3. Fijar la tasa CUP desde una fuente acordada; después verificar visualización y condiciones de cobro (AG-01).
4. Ejecutar una compra real controlada y documentar resultado/rollback (AG-11).
5. Avanzar paridad por tareas AG-03–AG-06; mantener revisión cruzada para cambios de negocio/producción.
6. Decidir cuándo congelar o sincronizar el legado y aprobar el go/no-go de corte (AG-08).

## Fuentes y alcance de esta revisión

- Foto de producción de Claude: [revisión AG-15](./reviews/2026-11-17-status-plan-maestro.md), §0; lecturas de solo lectura fechadas 17 nov 2026, 21:30 UTC.
- Cambios posteriores y verificaciones por dominio: [`CODEX_HANDOFF.md`](./CODEX_HANDOFF.md), entradas de catálogo publicado, stock corregido y webs conectadas.
- Estado operativo de tareas: [`TABLERO.md`](./TABLERO.md). Los apuntes anteriores del informe se conservaron en [`status-archive/2026-11-17.md`](./status-archive/2026-11-17.md); no deben leerse como estado actual.
- No se repitieron pruebas ni se escribió en producción durante esta consolidación.

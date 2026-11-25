# Estado del proyecto y siguientes pasos · 25 nov 2026

Revisión pedida por el usuario: estado actual, qué afrontar a continuación, docs y ramas distintas de
`main`. Lecturas de solo lectura en el VPS y por HTTPS; la única escritura es este documento y la
cabecera del tablero. El estado por fase sigue en [`STATUS_PLAN_MAESTRO.md`](../STATUS_PLAN_MAESTRO.md)
(lo consolida Codex).

## 1. Producción, comprobada hoy

| Qué | Resultado |
|---|---|
| API | Imagen de `1dc0feb` (`sha256:bb917a77…`), contenedor `healthy` 30 h. Rutas de AG-54 y AG-55 activas. |
| `main` | HEAD `e1905b3`, CI verde y su imagen de la API ya publicada, **sin desplegar**: lleva AG-62 (bloqueo de cotizaciones) y AG-57 (entrega parcial). |
| Webs | Tienda, Negocio y Catálogo responden 200. `catalogo.eav-labs.com/terminos` da 404: las páginas legales de AG-59 no están publicadas. |
| Tasa CUP | `975` CUP/USD, fuente «elTOQUE (web)», actualizada hoy 14:00 UTC (dato de elTOQUE de las 08:48). Actualización cada 30 min confirmada → **AG-01 se puede cerrar**. |
| Ficha de tienda | `GET /store/agestyles/store-info?handle=agestyles` responde (AG-55 en producción). |
| Disco | 76 % usado, 48 GB libres (antes 95–100 %): la poda de AG-64 liberó unos 37 GB sin tocar contenedores. |
| Reversión | Solo queda la imagen actual de la API en local; las anteriores se pueden volver a descargar de GHCR. |

## 2. Ramas y PRs distintos de `main`

| Rama / PR | Estado | Qué hacer |
|---|---|---|
| `muse/revisiones-2026-11-25` · **PR #6** | Abierto, sin conflictos, CI del PR en verde. 3 commits: revisiones cruzadas (AG-62, AG-61, AG-57, AG-50, AG-05), documentos AG-63/AG-64, test de purga de eventos, `.env.example` y runbook apuntando a producción. | **Fusionar.** Revisado: el test pasa (`product-events purge: ok`) y los cambios de código son de configuración y de un test. No lo fusioné yo: la subida a `main` quedó sin autorización explícita. |
| `muse/sidebar-busqueda-movil` (PR #2), `muse/seguridad-checklist-27` (#3), `muse/legales-eventos-vistas` (#4), `muse/ci-y-verificacion-lab` (#5) | Fusionadas; 0 commits por delante de `main`. | Borrar las ramas remotas cuando se quiera (solo orden). |
| `ccr-1a2bc70d-nc1skf` (PR #1, AG-30) | Fusionada hace tiempo; 0 por delante, 159 por detrás. | Borrar la rama remota. |

Ninguna rama ajena tiene trabajo pendiente de integrar salvo el PR #6.

## 3. Qué afrontar a continuación (por orden)

1. **Fusionar el PR #6** (documentación y test; sin riesgo).
2. **Desplegar la API de `e1905b3`** (AG-62 + AG-57). Imagen publicada, sin migraciones, mismo
   procedimiento ya usado (copia de BD, validar digest, `up`, recrear gateways). Rollback: la imagen
   `bb917a77…` anterior. Requiere autorización.
3. **Publicar Tienda y Catálogo con eventos y páginas legales (AG-59/61).** El único bloqueo real es el
   contenido legal (**B1**): identidad del responsable y política de cambios y devoluciones. Las otras
   barreras (B2, B4, B6) son del camino por GitHub Actions; las webs se pueden seguir publicando desde el
   VPS como hasta ahora. Después, probar el panel «Vistas y clics» con una sesión de vendedor.
4. **AG-11, recorrido en Android** con Tienda 1.5.0 y Negocio 1.3.0: instalar sobre la versión anterior,
   comprar con dos tiendas, ver CUP, WhatsApp y seguimiento, y una entrega parcial en Negocio. Solo se
   puede con un móvil; ningún agente tiene uno conectado.
5. **Copias de seguridad (AG-02), hoy aplazada.** La plataforma es pública y solo hay volcados manuales
   antes de cada despliegue. Mínimo razonable sin decidir destino externo: volcado diario local con
   rotación. Con destino cifrado externo, restauración aislada.
6. **Catálogo comercial (AG-28/29/42):** activar marcas en Codificadores, asignar familias y resolver el
   SKU de variantes para que comparador, filtros e importación CSV funcionen con datos reales.
7. **Revisiones cruzadas que siguen abiertas para Claude:** AG-49, AG-51, AG-52 y AG-56. Las de AG-50,
   AG-57 y AG-61/62 ya las hizo Muse en el PR #6.
8. **Con decisión del usuario:** AG-38 (AI Studio comercial, espera claves de IA), AG-08 (corte del legado)
   y AG-12 (causa del 500 de Kickz/B1: falta la contraseña de la siembra del laboratorio).

## 4. Docs

- `TABLERO.md`: la cabecera decía «Hoy (17 nov 2026)»; actualizada. Siguen pendientes, y lo harían mejor
  Codex o Muse tras fusionar el PR #6 (que edita esas filas): AG-01 a «hecha», y mover al apartado «Hechas
  recientes» las tareas ya terminadas que siguen en «En curso» (AG-07, AG-22, AG-30…AG-37, AG-47, AG-48).
- `STATUS_PLAN_MAESTRO.md` (de Codex) — cambios propuestos: CUP 970 → 975 con actualización automática
  cada 30 min; disco 95 % / 11 GiB → 76 % / 48 GB; añadir que `main` (`e1905b3`) tiene una imagen de la API
  publicada y sin desplegar.
- `CODEX_HANDOFF.md`: entrada de esta revisión añadida al final.

## 5. No verificado

- Android y cualquier recorrido con sesión real; las variables de GitHub Actions (no legibles desde el VPS).
- Que la API de `e1905b3` se comporte bien en producción: aún no se ha desplegado.
- Que el PR #6 pase el CI tras fusionarse en `main` (el verde es el del PR).

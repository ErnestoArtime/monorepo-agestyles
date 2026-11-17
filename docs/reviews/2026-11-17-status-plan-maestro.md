# Revisión de `STATUS_PLAN_MAESTRO.md` — propuesta de Claude para Codex

**Fecha:** 17 nov 2026, 22:30 UTC · **Tarea:** AG-15 en el [tablero](../TABLERO.md) · **Autor:** claude · **Decide:** codex (consolida el documento) con el visto bueno del usuario.

Esta revisión no modifica `STATUS_PLAN_MAESTRO.md`. Propone qué está desactualizado, qué falta y cómo mejorar su estructura. Codex acepta, ajusta o rechaza cada punto y lo anota aquí.

## 1. Datos que ya no son ciertos

| # | Dónde | Dice | Realidad verificada (17 nov, 22:20 UTC) |
|---|---|---|---|
| 1 | Cabecera, «Regla de protección» | Supabase sigue siendo el sistema operativo; el laboratorio no es producción | Hay un runtime de producción 2.0 (API `19085`, BD `15473`) y Tienda, Catálogo y Negocio lo usan desde `agestyles-api.eav-labs.com`. El legado (`agestyles.eav-labs.com`) sigue vendiendo: **hay dos sistemas escribiendo ventas y stock** (AG-08). |
| 2 | F8 «No iniciada» | No se migraron datos; la beta es de prueba | El catálogo se migró y las webs públicas usan producción. En la práctica F8 empezó **sin go/no-go, sin backup y sin plan de rollback**. Hay que reflejarlo con honestidad, no ocultarlo. |
| 3 | F6, columna de criterio | «31 ofertas con 13 uds», «configurar oferta/precios USD y medios HTTPS», «backup antes de publicación» | 31 ofertas, 15 con stock (26 uds) tras corregir la regla de disponibilidad del legado; precios USD hechos; medios HTTPS no; la publicación ya ocurrió **sin** backup. La columna mezcla evidencia, historia y pendientes. |
| 4 | F6, evidencia | «El storefront público sigue apuntando a `descargas…/agestyles-lab`» | Apunta a producción desde las 22:45 UTC. |
| 5 | F4 | Tracking: «el API público devuelve `Cannot GET`» | `GET /store/orders/:id/tracking` en producción responde 401 (ruta presente, exige sesión). Falta la verificación con un pedido real. |
| 6 | F5 | «`negocio.eav-labs.com` publica una exportación anterior» | Publica la exportación conectada a producción (`/negocio`); login del titular, selección de tienda y 31 productos verificados por HTTPS. |
| 7 | «Verificación de infraestructura» | Gateways del laboratorio reenvían a `19081`; el proceso de `19080` no forma parte de las betas | La API del laboratorio escucha en `19080` y nada escucha en `19081`: `descargas…/agestyles-lab` devuelve 502 (AG-10). La sección no menciona producción. |
| 8 | «Próximas puertas de trabajo» | Orientadas a staging y laboratorio | Las puertas reales son: backup de producción, un solo escritor, compra real, paridad con el legado. |
| 9 | Cabecera, «Corte de auditoría 19:30 UTC» | — | Hay secciones hasta las 22:45 UTC y fuera de orden (21:45 aparece después de 22:30). |
| 10 | Disco | Varias cifras (2.8, 3.1, 4.8, 7.3 GiB) | 3.0 GiB libres (99 %) tras descargar imágenes; riesgo operativo inmediato para builds y despliegues. |

## 2. Lo que falta

- **Foto de producción**: hosts, puertos, imagen por digest, servicios, conteos de datos y quién puede desplegar. Hoy solo está repartida entre secciones fechadas.
- **Riesgos abiertos** priorizados: sin backup con producción viva; dos escritores; disco al 99 %; avisos «de prueba» en webs que ya venden; CI de `main` estuvo en rojo desde `f768465` hasta `874033b` por un test de configuración.
- **Paridad con el legado**: qué hacía `Agestyles-Catalogo` y qué tiene ya la 2.0 (CUP, WhatsApp, movimientos, gestores de venta, CSV, etapas de preparación…), enlazado a las tareas AG del tablero. `MATRIZ_REUTILIZACION.md` habla de reutilización, no de paridad funcional.
- **Enlace a tareas**: cada criterio pendiente debería apuntar a su `AG-xx`, para que el estado y el tablero no se contradigan.
- **Decisiones del usuario pendientes**: tasa CUP o token de elTOQUE, reglas de comisión, textos de los avisos, política de un solo escritor, destino del backup.

## 3. Mejoras de estructura

1. **Separar estado de registro.** El documento tiene 325 líneas y unas 35 secciones «Actualización…» con fecha; eso es un registro que ya existe en `CODEX_HANDOFF.md`. Propuesta: mover esas secciones a `docs/status-archive/2026-11-17.md` y dejar en STATUS solo lo vigente.
2. **Estructura fija propuesta** (una pantalla por bloque):
   1. Objetivo y fecha de corte (una línea, el mismo objetivo del tablero).
   2. Producción hoy (tabla corta).
   3. Estado por fase: `Estado` · `Evidencia vigente` (máx. 3–4 frases con enlaces) · `Pendiente para cerrar` (lista de `AG-xx`).
   4. Riesgos abiertos (ordenados, con responsable).
   5. Paridad con el legado (tabla con `AG-xx`).
   6. Decisiones pendientes del usuario.
3. **Una sola fecha de corte** y solo cifras con su fecha de medición.
4. **Regla de actualización**: el tablero cambia en cada tarea; STATUS solo cuando cambia el estado de una fase o un riesgo, y lo consolida Codex.

## 4. Cambios de estado de fase que propongo

| Fase | Ahora | Propuesta | Motivo |
|---|---|---|---|
| F3 | Parcial | Parcial | Catálogo público en producción; falta recorrido visual/teclado y compra web. |
| F4 | Parcial | Parcial | Tienda en producción con CUP de referencia y WhatsApp; falta compra real (AG-11) y nativo (AG-14). |
| F5 | En curso | En curso | Negocio en producción; faltan medios, etapas de preparación (AG-04) y movimientos (AG-03). |
| F6 | En curso | **Parcial: catálogo en producción** | Catálogo, ofertas y stock migrados y conciliados por regla del legado; faltan pedidos/clientes/históricos, backup y conciliación formal. |
| F8 | No iniciada | **Iniciada sin go/no-go** | Webs públicas sobre producción con el legado aún activo; requiere decisión de un solo escritor (AG-08) y backup (AG-02). |

## 5. Respuesta de Codex

_Pendiente. Codex anota aquí qué acepta, qué cambia y en qué commit consolida STATUS._

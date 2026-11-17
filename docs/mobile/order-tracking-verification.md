# Verificación segura del seguimiento por línea

**Estado:** procedimiento preparado; no ejecutado. La ruta fuente existe, pero el servicio publicado respondió `Cannot GET /store/orders/{id}/tracking` en el último corte. El código fuente, por sí solo, no demuestra que una imagen desplegada registre la ruta.

## Alcance y evidencia actual

- La ruta `apps/commerce-api/src/api/store/orders/[id]/tracking/route.ts` exige `actor_id` de customer y aplica `id`, `is_draft_order: false` y `customer_id` conjuntamente en la consulta. Un pedido ajeno y un ID desconocido terminan en `404` sin proyectar líneas ni etiquetas.
- `packages/domain/src/tracking.ts` transforma fulfillments en envíos por línea, ignora cancelados y líneas sin correspondencia, y limita las cantidades a la cantidad comprada.
- `apps/commerce-api/src/scripts/verify-order-tracking.ts` ejecuta workflows reales para crear fulfillment y envío. Elige pedidos existentes por estado y puede encontrar relaciones incompletas; luego intenta restablecer campos del fulfillment antes de cancelarlo. En el laboratorio compartido ya hubo una relación de fulfillment inconsistente y una limpieza que no se pudo confirmar.
- Este documento no declara aprobado el endpoint publicado ni autoriza ejecutar el verificador actual sobre el laboratorio compartido.

## Nivel A — Contrato de ruta con datos sintéticos

**Aislamiento:** prueba automatizada local. No iniciar Medusa, PostgreSQL, Redis ni hacer llamadas de red. Importar `GET` y suministrar un request sintético, un `scope.resolve(QUERY)` falso y un response con `status/json` capturados. Todo fulfillment, pedido y actor son fixtures en memoria.

### Casos requeridos

1. **Sin customer autenticado:** esperar `401`; comprobar que `QUERY.graph` no se invoque.
2. **Pedido propio:** respuesta `200`, estructura `{ tracking }`, `order_id` correcto y estado/líneas calculados desde el fixture.
3. **Aislamiento de ownership:** comprobar que la consulta incluya simultáneamente el ID solicitado, `customer_id` del actor y `is_draft_order: false`. Para un customer ajeno, devolver conjunto vacío y verificar `404` igual que para un ID inexistente; comparar tipo/código y mensaje observable para descartar enumeración.
4. **Borrador:** no debe llegar al resultado, incluso si el ID coincide.
5. **Pedido sin fulfillments o relación nula:** `200` con cada línea en `not_fulfilled` y `shipments: []`; no debe lanzar por relaciones ausentes.
6. **Envío parcial y dividido:** uno o más fulfillments con líneas distintas, cantidades parciales, timestamps y etiquetas. Las cantidades por línea no exceden lo comprado; la línea no enviada no contiene tracking; el estado global representa entrega parcial.
7. **Datos que no pertenecen a la compra:** fulfillment cancelado, `line_item_id` nulo/desconocido y exceso de cantidad no deben filtrar datos o incrementar la cantidad proyectada.
8. **Entrega completa:** los timestamps y cantidades de entrega producen `delivered` solo cuando todas las líneas están completas.

### Aprobación

- El actor nunca puede obtener una orden ajena, aunque conozca su ID.
- El filtro de customer se ejecuta dentro de la consulta, no en una comparación posterior.
- Relaciones ausentes y cada tipo de fulfillment quedan cubiertos sin red ni datos reales.
- Un `401`, `404` y el cuerpo público no revelan IDs, líneas ni etiquetas del pedido ajeno.

## Nivel B — Workflow real en infraestructura desechable

Este nivel crea un envío real y cambia reservas/estado de fulfillment. Solo debe ejecutarse contra una copia desechable de PostgreSQL y Redis, nunca contra Supabase, producción, beta pública o el laboratorio compartido actual.

### Precondiciones obligatorias

1. Crear un entorno Compose propio con nombres de proyecto, red, volúmenes, puertos y credenciales exclusivos. Verificar que API, `DATABASE_URL`, Redis y storage apunten a ese entorno. Rechazar hosts, volúmenes o nombres que puedan resolver a producción o al laboratorio compartido.
2. Restaurar una copia consistente preparada para QA o sembrar fixture sintético. No traer datos personales de Supabase. No exponer puertos de DB/Redis públicamente.
3. Generar un `run_id` aleatorio por ejecución y asociarlo a los metadatos del pedido y del fixture de prueba. Registrar SHA de la aplicación, versiones, IDs sintéticos creados, hora UTC y correlación de logs; no registrar contraseñas, tokens, direcciones ni PII.
4. Crear un customer dueño y otro customer independiente. Crear una orden nueva para el dueño mediante workflows soportados, con al menos dos líneas o cantidades superiores a uno, método de envío válido, inventario disponible y **cero fulfillments**.
5. Antes de ejecutar, releer el pedido por workflow/query y demostrar: customer esperado, líneas/stock reservado, shipping option existente, `fulfillment_status` pendiente y `fulfillments` vacío. Si no concuerda, abortar y descartar el entorno; no seleccionar una orden antigua “parecida”.
6. Tener logs y healthchecks habilitados, notificaciones externas desactivadas y ninguna integración de pagos/envíos externa conectada.

### Recorrido

1. Con el customer dueño, leer el tracking de su propia orden antes del envío: `200`, cantidades enviadas en cero y sin tracking.
2. Ejecutar el workflow oficial de creación de fulfillment para una unidad de una línea, seguido del workflow oficial de envío con una etiqueta sintética `run_id` y URL HTTPS de prueba. No actualizar directamente tablas, `shipped_at`, etiquetas ni reservas.
3. Leer de nuevo como dueño y confirmar la línea correcta, cantidad enviada parcial, fecha, número/URL sintéticos y que las otras líneas no muestran el envío.
4. Leer el mismo ID como el segundo customer y como una sesión no autenticada. El segundo customer debe recibir el mismo `404` que un ID inventado; el no autenticado debe recibir `401`. Ninguna respuesta debe contener datos del dueño.
5. Si se prueba envío múltiple o entrega, hacerlo con otra base desechable nueva o continuar dentro de este mismo `run_id`, comprobando cantidades acumuladas y estados sin sobrepasar lo comprado.
6. Capturar logs de workflow y API asociados al `run_id`, IDs sintéticos, respuestas sin credenciales y estado de health. Confirmar que no hubo notificación externa ni escritura fuera de los contenedores desechables.

### Limpieza y restauración

- El envío es una transición comercial que no se debe “deshacer” editando `shipped_at`, etiquetas o filas directamente. Tampoco se debe borrar el fulfillment ni cancelar como mecanismo de rollback del test.
- Al terminar —también si hay una aserción fallida— conservar únicamente logs técnicos saneados y el manifiesto del `run_id`; detener y **descartar los volúmenes completos** de PostgreSQL/Redis de esa ejecución. Restaurar desde snapshot limpio antes de otra corrida.
- Si la plataforma de CI no permite descartar el volumen completo, detenerse antes de crear fulfillment. No reutilizar esa base hasta restaurarla desde cero y comprobar nuevamente los pre-requisitos.

### Criterios de aprobado/fallido

**Aprobado:** recorrido dueño/ajeno/anónimo cumple status y privacidad; la proyección refleja exactamente líneas y cantidades; workflow y API registran el `run_id`; el fixture inicial era limpio y todo el entorno desechable se descartó después.

**Fallido o inconcluso:** ruta ausente/`404` para el dueño, `500`, fulfillment ya existente, relación inconsistente, cambio inesperado de stock/reservas, envío ajeno visible, cantidades incorrectas, notificación externa, origen de datos no confirmado, cleanup parcial o imposibilidad de demostrar que la DB/Redis eran desechables. Ante cualquiera, no repetir sobre el mismo volumen.

## Nivel C — Comprobación del servicio publicado

La ruta debe estar incluida en una imagen construida desde un SHA identificable y desplegada con espacio suficiente. Después de publicar explícitamente esa imagen al ambiente de beta, comprobar en runtime la ruta registrada, una lectura customer autenticada de fixture no mutante, el `401` sin sesión y el `404` para pedido ajeno/ID desconocido. Confirmar logs de la misma versión y que Admin/Vendor APIs siguen sin estar expuestas por los gateways buyer.

Hasta que el API público responda con evidencia de esa versión, el resultado histórico `Cannot GET /store/orders/{id}/tracking` sigue siendo **no disponible/no verificado**. La prueba runtime no debe crear fulfillment ni cambiar stock en la beta; esas mutaciones pertenecen únicamente al Nivel B desechable.

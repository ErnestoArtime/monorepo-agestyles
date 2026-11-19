# AG-39 — Panel comercial de Negocio

**Estado:** propuesta (19 nov 2026) · **Prioridad:** P2 · **Pedido del usuario.** Se coordina con AG-25 (codex, resumen inicial de Negocio): AG-25 es la portada operativa del día; AG-39 es el análisis comercial en su propia pantalla («Análisis»), sin tocar `app/(tabs)/index.tsx`.

## Indicadores

| Bloque | Qué muestra | Fuente existente |
|---|---|---|
| Ventas por período | Importe, pedidos, unidades y ticket medio por día/semana/mes; comparación con el período anterior; por canal (online / gestor) | Pedidos de Medusa (`order_seller` de Mercur), ventas de gestor (AG-06) |
| Productos más vendidos | Ranking por unidades e importe | Líneas de pedido; informe de AG-06 fase 3 |
| Sin rotación | Productos con stock y sin ventas en 30/60/90 días, días sin vender y stock inmovilizado | Pedidos + inventario + movimientos (AG-03) |
| Próximos a agotarse | Stock actual, ventas medias diarias y días estimados hasta agotarse; umbral configurable | Inventario + ventas de los últimos 30 días |
| Pedidos pendientes | Por etapa (sin preparar, en preparación, listo, despachado) y antigüedad; pagos manuales por verificar | Etapas AG-04, pagos manuales |
| Rentabilidad | Margen bruto por producto y período (precio − coste), margen después de comisiones | **Falta el coste** (ver decisiones) + comisiones AG-06 |
| Gestores y comisiones | Ventas, comisión generada, saldo y retiros por gestor | Módulo `sales-commissions` (AG-06) |

Todo filtrable por período y exportable a CSV; móvil en tarjetas, escritorio en panel con gráficos.

## Diseño técnico

- Rutas de solo lectura `GET /vendor/agestyles/analytics/*` (ventas, rotación, stock, pendientes, rentabilidad, gestores), siempre limitadas a la tienda elegida y al permiso (`orders`/`products` ver; rentabilidad y comisiones solo titular o administración).
- Agregados calculados en el servidor con consultas sobre pedidos, movimientos e inventario; caché corta por tienda. Sin tablas nuevas salvo el coste.
- Pantalla «Análisis» en Negocio (menú «Tienda») y versión para toda la plataforma en Administración (AG-32).

## Decisiones del usuario

1. **Coste de compra:** dónde se registra. Propuesta: campo de coste por variante y tienda (en la oferta, con historial al cambiar), editable en Negocio y por CSV; las entradas de stock (AG-03) pueden anotar el coste de ese lote.
2. Umbral de «sin rotación» (propuesta 60 días) y de «próximo a agotarse» (propuesta 7 días de stock).
3. Moneda de los informes: USD (actual) y CUP cuando se fije la tasa (AG-01).

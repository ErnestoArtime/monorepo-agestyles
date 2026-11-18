# AG-06 — Gestores de venta y comisiones: propuesta de diseño

**Estado:** propuesta (claude, 18 nov 2026) · **Decide:** usuario · **Revisión cruzada:** codex.

## Reglas confirmadas por el usuario (17 nov)

1. Cada **producto** puede definir cuánta comisión da a los gestores de venta.
2. Cada **tienda** puede definir porcentajes generales de comisión.
3. Los gestores **acumulan saldo** y lo **retiran en efectivo cuando quieran**.

## Lo que hacía el legado (`Agestyles-Catalogo`)

- Comisión por producto como **importe fijo** (`commission_amount`), opcionalmente **acumulable**: el gestor cobra cuando completa un umbral de unidades (`commission_is_cumulative`, `commission_unit_threshold`, `commission_units`).
- Rol «Gestor de venta» con acceso solo al módulo de ventas; ve sus ventas, su comisión y cuántas unidades le faltan para el umbral.
- Administración ve todas las ventas, busca y filtra, reportes de ingresos por día, gestores con más ventas y productos más vendidos.
- Cada venta indica si fue en **efectivo o transferencia** y se asigna a un gestor.

## Modelo propuesto

Paquete nuevo `packages/sales-commissions` (módulo Medusa propio de AgeStyles, como `inventory-movements`), sin tocar Mercur.

| Entidad | Para qué |
|---|---|
| `sales_agent` | Un miembro de la tienda marcado como gestor de venta (`seller_id`, `member_id`, activo). Mercur solo tiene roles fijos (`role_seller_*`), así que «gestor» es una marca de AgeStyles, combinable con cualquier rol. |
| `commission_rule` | Regla de la tienda: `seller_id`, `product_id` opcional, `kind` = `percent` o `fixed`, `value`, y opcionalmente `unit_threshold` (acumulable). Sin `product_id` = regla general de la tienda. |
| `agent_sale` | Venta atribuida a un gestor: pedido o venta registrada en tienda, líneas, importe, forma de pago (`cash`/`transfer`), estado. |
| `commission_entry` | Libro de movimientos del saldo del gestor: `earned` (+), `reversed` (−, por devolución o cancelación), `withdrawn` (−, retiro). El saldo es la suma; nunca se edita, solo se añaden asientos. |
| `withdrawal` | Retiro en efectivo: importe, solicitado por, entregado por, fecha y estado. |

Cálculo por línea vendida: se toma la regla del producto si existe; si no, la regla general de la tienda; si no hay ninguna, la comisión es 0. `percent` se aplica sobre el precio de la línea, `fixed` por unidad. Con `unit_threshold`, la comisión se acredita cuando el gestor acumula esas unidades del producto (como en el legado). Moneda: USD, con el equivalente CUP de referencia cuando haya tasa.

## Pantallas (Negocio)

- **Gestor:** «Mis ventas», saldo disponible, progreso hacia umbrales y botón «Solicitar retiro».
- **Titular/administración:** reglas de comisión (general y por producto), gestores, ventas con filtros, retiros pendientes («Entregado en efectivo»), reportes: ingresos por día, ranking de gestores y productos más vendidos, exportación CSV.

## Seguridad

Todo se valida en el servidor y por tienda: un gestor solo ve sus ventas y su saldo; solo el titular o administración configuran reglas y confirman retiros; ningún retiro puede superar el saldo (con bloqueo como en AG-03); el libro es solo de añadir.

## Decisiones del usuario (18 nov 2026)

1. **Atribución:** el gestor **registra en Negocio** las ventas que hace (en tienda, por WhatsApp…), cobradas en efectivo o por transferencia; además, un cliente puede **comprar online con el código del gestor** y la venta queda a su nombre (fase 4).
2. **Precedencia:** se aplica **la comisión del producto**; la regla general de la tienda es **un porcentaje** y solo cubre productos sin comisión propia.
3. **Acumulable:** opción **por producto** con importe fijo: la comisión se acredita cada vez que el gestor completa el umbral de unidades; sin umbral, en cada venta.
4. **Retiros:** el gestor **solicita** y el titular **confirma** la entrega del efectivo (o la rechaza); el saldo baja al confirmar.
5. **Acreditación:** las ventas registradas por el gestor se consideran cobradas al registrarlas; las online, al confirmarse el pago. Se revierten con devolución o cancelación (pendiente: fase 4).

## Plan por fases

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Paquete `sales-commissions`: modelos, migración y reglas puras con tests | Hecha (`9e6c2b9`) |
| 2 | Rutas vendor: gestores, reglas, venta registrada por el gestor (descuenta stock como `venta` de AG-03), saldo, retiros; verificador HTTP en CI | Código hecho (`00844f3`, `5e50367`); verificador en ajuste |
| 3 | Pantallas de Negocio: Comisiones (gestor y titular) y Registrar venta | Hecha (`4c7f02b`); sin revisión visual |
| 4 | Ventas online con código del gestor y reversión por devolución/cancelación | Hecha en código (18 nov), sin desplegar; ver abajo |

## Fase 4 — implementación (18 nov 2026)

- **Código en la compra:** la Tienda ofrece «¿Te atendió un gestor de venta?» en el paso de pago; valida el código con `GET /store/agestyles/sales-agents/:code` (solo devuelve código y nombre de la tienda, nunca quién es el gestor) y lo guarda en `cart.metadata.agestyles_agent_code`. Un enlace `https://tienda.eav-labs.com/?gestor=CODIGO` lo recuerda en el dispositivo y lo aplica al llegar al pago.
- **Atribución en el servidor:** Mercur 2.4.1 (`complete-cart-with-split-orders`) copia `cart.metadata` a cada pedido hijo. El subscriber `agent-sale-order-placed` (`order.placed`) crea una venta `online` en estado `pending` solo si el código pertenece a un gestor activo **de la tienda de ese pedido**; los pedidos de otras tiendas del mismo carrito se ignoran. Idempotente por pedido (bloqueo `agestyles-agent-order:<pedido>`).
- **Acreditación:** `agent-sale-payment` escucha `agestyles.manual_payment.verified` y `payment.captured`; con el bloqueo del gestor recalcula la comisión con las reglas vigentes y los umbrales acumulables, marca la venta `paid` y añade los asientos `earned` en el workflow `agestyles-settle-agent-sale` (compensable).
- **Reversión:** `agent-sale-order-canceled` (`order.canceled`) y la ruta del titular `POST /vendor/agestyles/agent-sales/:id/reverse` añaden asientos `reversed` por lo que la venta ganó y aún no se revirtió (idempotente) y la marcan `reversed`. El saldo puede quedar negativo si el gestor ya retiró esa comisión. El stock no se toca: si la mercancía vuelve, se registra como alta en Movimientos.
- **Negocio:** el gestor ve su código y copia o comparte su enlace; el titular ve «Ventas de la tienda» con estado («Pendiente de pago», «Anulada») y «Anular» con confirmación.
- **Sin migración:** el modelo ya tenía `source`, `order_id`, `status` y `payment_method = online`.
- **Pendiente:** devoluciones parciales (AG-20) aún no revierten la parte devuelta; prueba de compra real con código (AG-11).

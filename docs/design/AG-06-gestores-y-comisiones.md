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

## Decisiones que faltan (usuario)

1. **Cómo se atribuye una venta a un gestor.**
2. **Precedencia** entre la regla del producto y el porcentaje general de la tienda.
3. Si se mantiene la comisión **acumulable con umbral de unidades** del legado.
4. **Cómo se retira el efectivo:** con solicitud y confirmación del titular, o lo anota directamente el titular.
5. (Propuesta por defecto, salvo indicación contraria) La comisión se acredita cuando la venta queda **pagada**, y se revierte si hay devolución o cancelación.

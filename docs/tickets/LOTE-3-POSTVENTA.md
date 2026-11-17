# Lote 3 — Dinero y postventa

**Ticket:** NX-03 (postventa) · **Prioridad:** P0 tras Lote 2 · **Esfuerzo:** 3–4 sesiones
**Estado:** **v1 de comprobantes manuales completada el 17/11/2026**; tracking, notificaciones y reportes pendientes
**Origen:** [MATRIZ_REUTILIZACION.md](../MATRIZ_REUTILIZACION.md) §2.3–2.4, preguntas #3 y #4
**Regla:** no se reimplementa lo que Medusa/Mercur ya resuelven; el dinero y el stock siguen siendo de Medusa.

## Alcance del lote

| # | Capacidad | Cobertura upstream | Decisión | Estado |
|---|---|---|---|---|
| 1 | Aceptación de cotización → pedidos hijos | Mercur `order-group` + split de pedidos | **USAR** (ya verificado en F1) | Hecho |
| 2 | Comprobantes de pago manual (transferencia, depósito, efectivo) | No existe en Mercur 2.4.1 | **CONSTRUIR** módulo propio | **v1 hecha** |
| 3 | Tracking por línea / envío | Medusa fulfillment, shipments y `tracking_numbers` | **ADAPTAR** lectura para comprador y vendedor | Pendiente |
| 4 | Notificaciones de estado (pago verificado/rechazado, envío) | Medusa notification + subscribers | **ADAPTAR** con outbox | Pendiente |
| 5 | Reportes de postventa (pagos verificados, pedidos por vendedor) | No existe | **CONSTRUIR** lectura agregada | Pendiente |

## v1 — Comprobantes de pago manual (17/11/2026)

Ver [ADR-005](../adr/ADR-005-manual-payment-proofs.md) para las decisiones.

| # | Entregable | Archivos | Estado |
|---|---|---|---|
| 1 | Modelo `agestyles_manual_payment` (pedido, grupo, comprador, vendedor, importe, moneda, método, referencia, comprobante, estado, revisión) | `packages/manual-payments/src/models/manual-payment.ts` | Hecho |
| 2 | Migración generada con `amount numeric` y único parcial de un comprobante pendiente por pedido/vendedor | `packages/manual-payments/src/migrations/*` | Hecho |
| 3 | Validación pura: método, moneda ISO, importe positivo con 2 decimales, referencia, URL http(s), notas, motivo de rechazo, conciliación con el pedido | `packages/manual-payments/src/validation.ts` | Hecho |
| 4 | Servicio: enviar, verificar (idempotente), rechazar (idempotente), listar por pedido y por estado | `packages/manual-payments/src/service.ts` | Hecho |
| 5 | API comprador autenticada: enviar y listar comprobantes de un pedido propio; 404 para pedidos ajenos | `apps/commerce-api/src/api/store/orders/[id]/manual-payments/route.ts` | Hecho |
| 6 | API admin: cola por estado, verificar (concilia importe/moneda), rechazar con motivo | `apps/commerce-api/src/api/admin/manual-payments/**` | Hecho |
| 7 | Registro del módulo | `apps/commerce-api/medusa-config.ts`, `packages/manual-payments/package.json` | Hecho |
| 8 | Pruebas de reglas y verificador de laboratorio | `packages/manual-payments/test/*`, `apps/commerce-api/src/scripts/verify-manual-payments.ts` | Hecho |

### Verificación ejecutada

| Comando | Resultado |
|---|---|
| `pnpm typecheck` | **11/11 tareas, exit 0** |
| `pnpm --filter @agestyles/manual-payments test` | `PASS: manual payment input bounds, method/currency/amount rules and order reconciliation` |
| `medusa db:generate agestylesManualPayments` | `Generated successfully (Migration20261117011559.ts)`; `amount numeric not null` |
| `medusa db:migrate` | Migración aplicada en el laboratorio aislado |
| `medusa exec ./src/scripts/verify-manual-payments.ts` | `{"depositAccepted":true,"overTotalRejected":true,"wrongCurrencyRejected":true,"foreignOrderHidden":true,"duplicatePendingRejected":true,"rejectionRequiresReason":true,"resubmitAfterRejection":true,"verifiedMatchesOrder":true,"verifyIdempotent":true,"verifiedCannotBeRejected":true}` |

**Nota operativa:** igual que el resto de rutas nuevas, los handlers se verificaron con `medusa exec`; el contenedor `agestyles-buyer-api` no monta el repositorio y sigue con la imagen anterior.

## Criterio de aceptación del lote

1. Un pedido no puede tener dos comprobantes pendientes a la vez. **Cumplido** (índice único parcial + servicio).
2. Verificar exige que importe y moneda coincidan con el pedido. **Cumplido.**
3. Rechazar exige motivo y no se puede revertir una verificación. **Cumplido.**
4. El comprador solo ve sus propios comprobantes. **Cumplido** (404 uniforme).
5. Tracking por línea y notificaciones se apoyan en fulfillment/notification de Medusa, sin duplicar envíos. **Pendiente.**
6. Reportes agregados sin duplicar pedidos ni pagos. **Pendiente.**

## No entra en este lote

- Cobros con tarjeta o pasarela: se decide en F8.
- Devoluciones/reembolsos completos: primero el registro de comprobantes.
- Cambios en Supabase o en el sitio actual.

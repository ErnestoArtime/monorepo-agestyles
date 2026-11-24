# ADR-006: eventos propios de vistas y clics por tienda y producto

- Estado: aceptado (AG-59, 24 nov 2026)
- Contexto: el plan de las 4 cosas de Domenek.studio (Fases 1 y 5). El «Análisis»
  de Negocio (AG-39) solo mide ventas; no hay vistas ni clics en ningún sitio.
  Google Analytics mide el tráfico global, pero no atribuye por vendedor de
  forma fiable, depende de Google y se pierde con bloqueadores.
- Decisión: registrar los eventos en la propia API, en el módulo nuevo
  `packages/product-events` (`agestyles_product_event`), y exponerlos con la
  ruta pública `POST /store/agestyles/events`.

## Eventos

| Tipo | Cuándo |
| --- | --- |
| `product_view` | Se abre la ficha de un producto (vitrina o Tienda) |
| `store_view` | Se abre la página de una tienda |
| `product_click` | Se pulsa un producto en un listado o el enlace a su tienda |
| `add_to_cart_click` | Se pulsa «Añadir al carrito» con una oferta elegida |

Cada evento lleva `product_id` (nulo en `store_view`), `seller_id`,
`surface` (`vitrina`, `tienda-web`, `tienda-app`), un `session_id` anónimo
y la fecha del servidor. Una ficha con varios vendedores registra una
`product_view` por vendedor: el tráfico de cada tienda es suyo.

## Decisiones asumidas (Ernesto no respondió a las preguntas de la Fase 0)

- **Vistas totales, no únicas por sesión.** El servicio solo ignora el mismo
  evento de la misma visita dentro de 60 segundos (recargas, montajes dobles,
  reintentos). Reversible: bastaría con contar sesiones distintas en la Fase 6.
- **Retención de 90 días.** El job diario `agestyles-purge-product-events`
  borra lo anterior; nunca borra nada más reciente que el corte.
- **Sesión anónima generada en el cliente** (`localStorage` en la vitrina,
  `AsyncStorage` en Tienda). No es un identificador de usuario, dispositivo
  ni cuenta.
- **Sin IP, sin agente de usuario, sin fecha del cliente.** El cuerpo se
  valida con zod en la ruta y otra vez en el servicio; cualquier campo extra
  se descarta.
- **Límite en memoria por IP (60/min, 429).** Igual que el resto de los
  límites de la API hoy; el paso a Redis queda pendiente, como ya recoge la
  auditoría de seguridad.

## Lo que no hace esta entrega

- No instala Google Analytics (Fase 4) ni verifica Search Console (Fase 3).
- No hay interfaz de Análisis con estos datos (Fase 6): la agregación por
  tienda y producto y su pantalla en Negocio son el siguiente paso.
- No se cuentan las vistas rápidas (quick view) de la vitrina ni los clics
  de la portada y de Novedades, que muestran productos de varias tiendas sin
  un vendedor único; la vista se registra al abrir la ficha completa.
- La purga depende del job programado de Medusa; si el planificador no
  corre, los eventos se acumulan hasta que se ejecute.

## Alternativas descartadas

- **Solo Google Analytics:** no atribuye por vendedor sin trabajo manual por
  tienda y no pertenece a AgeStyles.
- **Contar visitas únicas por sesión:** se descartó por ahora porque la
  pregunta que Ernesto hizo es «cuántas visualizaciones», no «cuántos
  visitantes»; se puede cambiar en la agregación sin tocar la recogida.

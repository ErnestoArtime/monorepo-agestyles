# AG-38 — AI Studio como herramienta comercial

**Estado:** propuesta (19 nov 2026) · **Prioridad:** P2 · **Pedido del usuario.**

## Qué hay hoy (AG-27)

- `packages/ai-studio`: título y descripción desde foto con la cadena Gemini → OpenRouter → Groq (`describeProduct`), registro `agestyles_ai_request` (`describe` | `remove_background`).
- Quitar fondos en el VPS (`background-remover`, rembg).
- Cuota: un único límite mensual global `AGESTYLES_AI_MONTHLY_LIMIT` (100) contado por tienda con un candado en Redis; solo titular o administración de la tienda.
- Sin claves de IA en producción todavía: «Sugerir con IA» está oculto.

## Qué se añade

Cada herramienta devuelve un **borrador**: nada se guarda en el producto sin que una persona lo vea y lo acepte (vista previa, editar, aplicar o descartar).

1. **Mejora de fotos:** recorte automático al producto, fondo blanco o neutro, luz y contraste, enderezado y tamaño cuadrado para el catálogo. Base: rembg (ya instalado) + sharp (AG-36), sin coste de IA. Antes/después lado a lado.
2. **Títulos optimizados:** variantes de título (claro, con marca/modelo, orientado a búsqueda) con longitud recomendada y sin promesas que el producto no tenga.
3. **Sugerencia de atributos:** a partir de foto, título y categoría propone valores para la familia de características (AG-28: material, color, talla, capacidad…). Solo atributos de la familia; la persona confirma cada uno.
4. **Textos para redes sociales:** publicación para WhatsApp, Instagram y Facebook (texto, emojis moderados, hashtags y enlace al producto), con precio y tienda reales. Copiar o compartir; no publica por su cuenta.
5. **Historial de borradores** por producto (qué se generó, quién lo aplicó).

## Controles de consumo por tienda

- Cuota mensual **por tienda** y por tipo (texto / foto), configurable por la administración (AG-32) con un valor por defecto; las fotos locales cuentan aparte porque no tienen coste externo.
- La tienda ve su consumo del mes y lo que le queda; aviso al 80 % y bloqueo al 100 %.
- Administración: consumo por tienda, proveedor y coste estimado.
- La cuota se reserva antes de llamar al proveedor (como hoy) y se devuelve si falla.

## Reglas

- Siempre en el servidor: permiso por tienda, cuota y validación del borrador.
- Textos en español, sin datos personales del cliente, sin inventar características (el prompt solo usa los datos del producto).
- Proveedores y modelos por variable de entorno; si no hay claves, la herramienta se oculta.

## Decisiones del usuario

1. Claves de IA (pendientes desde AG-27).
2. Cuota por defecto por tienda (propuesta: 100 textos y 200 fotos al mes) y si alguna tienda paga por más.
3. Redes sociales: solo copiar/compartir (propuesto) o publicar directamente (requiere conectar cuentas de Meta).

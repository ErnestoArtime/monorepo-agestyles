# AG-26/AG-27 · Alta de productos con fotos y AI Studio en Negocio

Estado: decisión de proveedores tomada por el usuario el 18 nov 2026. Sin código todavía.

## Punto de partida

**Catálogo antiguo (`Agestyles-Catalogo`, agestyles.eav-labs.com):**

- AI-01, parcial: `ProductCopyAssistant` + `lib/productCopyDraft.ts`. Propone título (nombre + marca, 120 caracteres) y descripción factual a partir de nombre, marca, categoría y atributos con unidades. Ofrece detalle breve/completo y tono comercial, técnico o directo. El gestor edita y aplica. Son reglas fijas, sin proveedor de IA.
- AI-02, parcial: `ImageCropper`. Recorta en 1:1, 4:5 o 16:9; lado máximo de 800, 1200, 1600 o 2048 px; brillo entre 80 % y 120 %; rellena la transparencia con blanco o gris; compara antes/después; sube al bucket público `product-images`. No quita fondos.
- `src/app/api/admin/product-ai/descriptions/` es una carpeta vacía sin seguimiento en git: el endpoint con proveedor nunca se escribió.
- AI-00 (contrato con el proveedor), AI-03 (fondos generativos), AI-04 (uso por negocio) y AI-05 (lotes): diferidos.

**Monorepo:** no hay nada de IA. Negocio no tiene formulario de alta: solo se crean productos importando CSV (AG-05). Tampoco hay subida de fotos.

**Lo que ya se usa en el VPS:**

- **Coliseo** (`nx-monorepo/supabase/functions/chat`): cadena de proveedores Bynara → Groq → OpenRouter → Gemini, todos con API compatible con OpenAI salvo Gemini. Gemini también sirve los embeddings (`_shared/gemini.ts`). Las claves están en los secretos de Supabase de Coliseo, no en archivos locales.
- **Lavía** (`beauty-saas`, `docs/virtual-studio.md`):
  - Generación de imágenes con Replicate (`black-forest-labs/flux-2-pro`) o Runway (`gen4_image`). Las dos claves están definidas en la release activa.
  - Patrón reutilizable: proveedor intercambiable (`studio.provider.ts`), almacenamiento privado, normalización y borrado de EXIF, cuotas mensuales por negocio que cuentan también los fallos, tareas en PostgreSQL con `SKIP LOCKED`, idempotencia, ningún reintento automático de llamadas de pago y aprobación humana del resultado.
  - Segmentación local con MediaPipe en el navegador. Está pensada para personas, no para productos.

## Decisiones del usuario (18 nov 2026)

1. **Texto:** cadena como en Coliseo, con Gemini primero y OpenRouter/Groq de respaldo.
2. **Quitar fondos:** en nuestro servidor, con un modelo libre en el VPS. Sin coste por foto y sin que las fotos salgan del servidor.
3. **Cuentas:** se reutilizan las existentes (Gemini, Groq y OpenRouter de Coliseo; Replicate de Lavía si más adelante se generan fondos).

## Consecuencias técnicas

- **Fotos en la cadena de texto.** El asistente envía una foto, así que cada eslabón necesita un modelo que lea imágenes. Los modelos que Coliseo usa por defecto en Groq (`llama-3.3-70b-versatile`) y OpenRouter (`openrouter/free`) son solo de texto. Para AgeStyles hay que configurar modelos con visión. Si ninguno está disponible, se envían solo los datos de la ficha. Los modelos concretos se verifican al implementar.
- **Claves.** Las claves de Coliseo viven en los secretos de Supabase y no se pueden leer desde aquí. El usuario tendrá que copiarlas a `~/.config/agestyles-commerce-production/ai.env` (permisos 600). Nunca van en el repositorio ni en la app.
- **Desde dónde se llama.** Las llamadas salen del servidor (`commerce-api`), nunca del móvil: los proveedores bloquean Cuba y las claves no deben llegar al cliente.
- **Gasto compartido.** Al compartir cuenta, el consumo de AgeStyles se mezcla con el de Coliseo y Lavía. AgeStyles registra sus propias solicitudes por tienda para poder separarlo.
- **Quitar fondos en el VPS.** Contenedor propio con un modelo de segmentación de objetos (familia rembg / BiRefNet / ISNet; se decide al medir calidad y tiempo en CPU) y una API interna solo en loopback. Hay que medir RAM y segundos por foto antes de activarlo.

## Fases propuestas

- **AG-26 · Alta de producto con fotos en Negocio (sin IA):**
  - Formulario de alta con nombre, categoría, precio y variante.
  - Subida de fotos a un almacenamiento propio, con recorte, tamaño máximo y compresión en el dispositivo, equivalente a `ImageCropper`.
  - El asistente local de títulos y descripciones pasa a un paquete compartido.
- **AG-27 · AI Studio:**
  - Módulo `packages/ai-studio`, registrado en `commerce-api`.
  - Descripción y título sugeridos desde la foto y la ficha con la cadena de proveedores.
  - Quitar fondos en el VPS.
  - Siempre como borrador revisable, sin inventar especificaciones.
  - Original guardado en privado.
  - Cuota mensual por tienda y solo para el propietario al principio.
  - Registro de uso y aprobación explícita antes de publicar.
  - Se reutilizan los patrones de Lavía.
- **Después:** fondos generativos con Replicate (AI-03) y generación por lotes (AI-05). Sin fecha.

# Codificadores: catálogo antiguo frente a AgeStyles 2.0 (19 nov 2026)

Pedido del usuario: revisar cómo se gestionaban los codificadores en agestyles.eav-labs.com. Revisión de solo lectura del código del catálogo antiguo (`~/proyectos/Agestyles-Catalogo`, `cc0a810`) y de producción 2.0.

## Cómo funcionaba en el catálogo antiguo

Administración → **Codificadores** (`src/app/admin/codificadores/page.tsx`), una pantalla con pestañas. Cada pestaña tenía alta, edición y borrado en un modal, y una API `/api/admin/*` restringida a la administración de la tienda (`authorizeStoreAdmin`).

| Pestaña | Datos | Reglas |
|---|---|---|
| Categorías | nombre, slug, descripción, orden, **usa género** (ropa) | La base impide borrar si hay productos; el error se traduce a mensaje |
| Subcategorías | categoría madre, nombre, slug, descripción, orden | Igual |
| Marcas | nombre, slug, logo | 14 marcas en origen; los productos tenían `brand_id` vacío |
| Tallas | nombre, **tipo de talla** (calzado, pullovers, camiseta, shorts, pantalón…), orden, activa | Cada tipo trae tallas predefinidas (calzado 5–14 de medio en medio, ropa XS–XXL, pantalón 24–34) |
| Familias* | campos por categoría: atributo, tipo (texto, número, sí/no, selección, selección múltiple), unidad, obligatorio, visible, filtrable, comparable, opciones | Versión e «impacto» antes de cambiar una familia en uso |
| Biblioteca* | atributos compartidos con sus opciones, y **unidades** (código, nombre, símbolo, magnitud) | Reutilizables entre familias |

\* Solo con `NEXT_PUBLIC_CONFIGURABLE_CATALOG=true`.

## Qué hay hoy en 2.0

| Codificador | Dónde vive | Gestión hoy | Falta |
|---|---|---|---|
| Categorías y subcategorías | Medusa `product_category` (árbol con padre) · 30 en producción | Solo se **crean** al aprobar una solicitud de tienda (AG-35) | Listar el árbol, editar, reordenar, activar/desactivar y borrar sin productos; «usa género» |
| Marcas | — | Nada (AG-18, decisión pendiente) | Modelo y pantalla |
| Tallas | Valores de opción de cada producto (atributos de Mercur con `is_variant_axis`, creados por producto) | Se escriben a mano en cada alta | Tallas comunes por tipo para elegir en lugar de escribir |
| Atributos (biblioteca) | Mercur `product_attribute` + valores. Los 39 de producción son **por producto** (Color, Marca, Modelo, Talla, Tamaño, Tipo, Tono); ninguno compartido | La API de administración de Mercur ya permite crear, editar y borrar atributos y valores (`/admin/product-attributes`) | Pantalla y atributos globales |
| Familias | Módulo propio `catalog-pim` (`agestyles_catalog_family` + versiones) y `/admin/catalog-families` · 0 en producción | API sin pantalla | Pantalla; asignar familia a los productos (AG-28) |
| Unidades | — | Nada | Lista de unidades para atributos numéricos |

## Propuesta (AG-42)

Negocio → Administración → **Codificadores**, con las mismas pestañas que el catálogo antiguo, sobre lo que ya existe y sin tocar el núcleo:

1. **Categorías:** árbol con subcategorías; crear, renombrar, mover de padre, ordenar, activar/desactivar; borrar solo si no tiene productos ni subcategorías. Vía `/admin/product-categories` de Medusa. «Usa género» en `metadata`. Desde aquí también se enlazan las solicitudes de las tiendas (AG-35).
2. **Tallas:** atributos globales de Mercur, uno por tipo («Talla de calzado», «Talla de ropa», «Talla de pantalón»…), con las tallas predefinidas del catálogo antiguo ordenadas (`rank`). Al dar de alta un producto en Negocio, la tienda las elige en lugar de escribirlas.
3. **Marcas:** atributo global «Marca» de Mercur (valores con logo en `metadata`), filtrable en la Tienda. Base para las páginas de marca de AG-18.
4. **Biblioteca de atributos y unidades:** atributos globales de Mercur (tipo, obligatorio, filtrable) y unidades en un catálogo propio pequeño.
5. **Familias:** pantalla sobre `catalog-pim` (campos de la biblioteca, por categoría, con versión) y asignación a productos (AG-28).

Orden sugerido: 1 → 2 → 3 (lo que más usan las tiendas al dar de alta productos); después 4 y 5 junto con AG-28.

## Decisiones del usuario

- Alcance y orden de las pestañas.
- Marcas: atributo global (propuesto) o entidad propia con página de marca desde el principio.
- Si las tiendas pueden proponer valores nuevos (una talla o una marca que falte), igual que las categorías, o solo la administración.

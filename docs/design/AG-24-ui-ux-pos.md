# AG-24 — UI/UX de Tienda y Negocio inspirada en medusa-pos-starter

**Estado:** propuesta (claude, 18 nov 2026) · **Decide:** usuario · **Revisión cruzada:** codex.

El usuario quiere que Tienda (`apps/buyer-app`) y Negocio (`apps/business-app`) adopten la experiencia de [Agilo/medusa-pos-starter](https://github.com/Agilo/medusa-pos-starter) (MIT, Expo SDK 54 — la misma versión que usamos). Tomamos sus **patrones de interfaz**; no copiamos su código ni su marca: se reimplementan con `@agestyles/design-tokens`, `@agestyles/icons`, español y temas claro/oscuro, como exige `AGENTS.md`.

## Lenguaje visual de la referencia

| Patrón | Cómo es |
|---|---|
| Base | Monocroma: fondo blanco, acción principal casi negra, bordes gris claro, radios ~12 px, sin barra de cabecera de color |
| Títulos | Título grande y en negrita alineado a la izquierda en cada pantalla («Carrito», «Pedidos») |
| Catálogo | Buscador redondeado arriba; cuadrícula de 2 columnas con foto cuadrada sobre gris claro, nombre normal y precio en negrita |
| Ficha | Hoja inferior (bottom sheet) con carrusel, nombre y precio en una línea, opciones como píldoras (seleccionada rellena), selector − 1 + y botón grande «Añadir al carrito» |
| Carrito / pago | Filas con miniatura, atributos «etiqueta gris: valor en negrita», selector compacto; total fijo abajo con dos botones (contorno + relleno) |
| Pedidos | Tarjetas con borde: «Pedido #226» en negrita, fecha en gris, cliente, total y **insignia de estado** con icono y color suave; filtros «Estado» y «Fechas» como botones de contorno con calendario en hoja inferior |
| Detalle de pedido | Hoja inferior con líneas y bloque «Detalles» de pares clave–valor con insignias |
| Confirmaciones | Modal centrado con aviso verde y botones «Ver pedido» / «Seguir comprando» |
| Navegación | Barra inferior con icono pequeño y etiqueta; activo en negro |

Encaja con la dirección «Modern Luxury» (blanco, negro/grafito, neutros cálidos) que el usuario ya eligió para AgeStyles.

## Estado actual (capturas de 390×844, 18 nov)

- **Tienda:** portada con un bloque azul grande, banner de la APK de Android y píldoras azules; más cargada que la referencia. **Bug:** muestra **20 de 31 productos** porque `listStoreProducts` usa `limit = 20` y la portada no pagina.
- **Negocio:** inicio de sesión ya cercano al estilo de referencia; las pantallas internas usan listas con estilos propios por pantalla.
- **Catálogo web:** estilo editorial propio; su barra superior aún dice «BETA DE PRUEBA» (se escapó en AG-07).

## Propuesta

1. **Paquete compartido `packages/ui-native`** (componentes React Native sobre los tokens, sin depender de módulos de servidor): `LargeTitle`, `SearchField`, `Button` (relleno/contorno), `Pill`/grupo de opciones, `Stepper`, `StatusBadge`, `Card`, `KeyValueRow`, `ProductTile`, `BottomSheet`, `ConfirmDialog`, `DateRangeSheet`. Ambos apps lo usan; así Tienda y Negocio se ven como un mismo producto.
2. **Tienda:** portada con título grande, buscador, categorías en píldoras negras y cuadrícula de 2 columnas (con precio CUP de referencia cuando haya tasa); la APK pasa al menú/cuenta; ficha como hoja inferior; carrito y pago con el patrón de la referencia; confirmación en modal; «Mis pedidos» con tarjetas e insignias.
3. **Negocio:** Productos en cuadrícula; Pedidos con tarjetas, insignias de estado (incluidas las etapas de AG-04) y filtros Estado/Fechas; detalle en hoja inferior; Inventario, Movimientos y Comisiones con los mismos componentes.
4. **Arreglos inmediatos** (no esperan al rediseño): mostrar los 31 productos (paginar o subir el límite) y quitar «BETA DE PRUEBA» del Catálogo.

No se incorpora NativeWind/Tailwind: añadiría un segundo sistema de estilos; seguimos con `StyleSheet` y tokens.

## Decisiones del usuario

1. ¿Ficha de producto como **hoja inferior** (como la referencia) o pantalla completa?
2. ¿Se quita el bloque grande de la portada y el banner de la APK?
3. Reparto con Codex: propuesta en el tablero (AG-24).

## Plan

| Fase | Contenido |
|---|---|
| 0 | Arreglos inmediatos (31 productos, «BETA DE PRUEBA») |
| 1 | `packages/ui-native` con los componentes y su documentación en `docs/design-system.md` |
| 2 | Tienda: portada, ficha, carrito, pago, confirmación y pedidos |
| 3 | Negocio: productos, pedidos (con AG-04), inventario, movimientos y comisiones |
| 4 | Revisión visual clara/oscura con capturas a 390 px y 1440 px (enlaza con AG-13) |

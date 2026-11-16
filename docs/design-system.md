# Sistema visual y de iconos AgeStyles

La tienda, la app compradora, la app de negocio y los paneles web comparten una sola dirección visual y una sola biblioteca de iconos.

## Iconos

- Importar iconos siempre desde @agestyles/icons.
- La biblioteca base es Lucide; sus versiones web y React Native mantienen las mismas formas, nombres semánticos y trazo.
- Web usa SVG en línea; Android y iOS usan React Native SVG. No depender de fuentes de iconos que aparezcan después de cargar la pantalla.
- No importar lucide-react, lucide-react-native, @expo/vector-icons ni otra colección directamente en una app. Si falta un icono, añadirlo a las dos entradas de packages/icons y usar el nombre semántico común.
- Usar 20–24 px para controles, trazo de 1.8 por defecto y el color activo/inactivo del control. Todo icono dentro de un botón debe tener una etiqueta accesible en el botón.

## Dirección visual

- Modern Luxury claro: fondos blancos o marfil, grafito para texto, azul noche para acciones y acentos cálidos discretos.
- El símbolo AgeStyles se conserva en las cabeceras y assets de marca.
- Catálogo con fotografía amplia, títulos y precios legibles, filtros visibles y comparación de vendedores en la ficha de producto.
- Las pantallas nativas y web siguen la misma jerarquía y vocabulario; cada plataforma adapta navegación y densidad sin cambiar el lenguaje visual.

## Referencias funcionales

- https://agestyles.eav-labs.com: estructura que ya conocen los clientes: catálogo, novedades, tiendas, categorías, búsqueda, filtros y comparación.
- references/mobile/medusa-examples/react-native-expo: Store API, carrito y flujo comprador Medusa.
- references/mobile/medusa-pos-starter: organización clara de tareas y controles de operación; su Admin API no se usa con credenciales globales en apps móviles.
- references/mobile/ecommerce-mobile-template: inspiración de catálogo, producto y presentación visual; no fuente de lógica comercial.
- Las referencias se adaptan a los contratos y controles de AgeStyles. No se mezclan sus sistemas de identidad, tokens administrativos o bases de datos.

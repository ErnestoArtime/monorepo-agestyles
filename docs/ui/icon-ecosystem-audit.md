# Auditoría del ecosistema de iconos

**Tarea:** OC-05 de [docs/OPEN_CODE_TASKS.md](../OPEN_CODE_TASKS.md)
**Fecha:** 17 de noviembre de 2026
**Naturaleza:** auditoría de solo lectura. No se editó código de aplicación, no se instalaron paquetes y no se publicó nada.

## 1. Alcance y método

Se revisaron las tres apps que consumen iconos (`buyer-app`, `business-app`, `storefront-web`), el paquete `packages/icons` y `docs/design-system.md`. La evidencia se obtuvo con lecturas de archivo y búsquedas estáticas sobre el árbol de trabajo; no se abrió emulador ni dispositivo porque el host está en `blocked-by-capacity` (OC-03).

Fuera de alcance por instrucción: `references/**` (material de consulta), `node_modules`, `dist` y los assets de marca (`agestyles-mark.svg`), que son logotipos y no iconos de interfaz.

## 2. Inventario del paquete

| Aspecto | Estado | Evidencia |
|---|---|---|
| Entradas por plataforma | `index.web.tsx` (Lucide React + SVG en línea) y `index.native.tsx` (Lucide React Native) | `packages/icons/package.json` (`exports` con condición `react-native`/`browser`) |
| Catálogo de glifos | **40 nombres semánticos**, idénticos en ambas entradas (sin nombres exclusivos de una plataforma) | comparación automática de las claves de `glyphs` |
| Trazo y tamaño por defecto | 1.8 y 20 px en ambas entradas | `index.web.tsx:35`, `index.native.tsx:35` |
| Color por defecto | Web `currentColor`; nativo `#171717` (literal, fuera de tokens) | `index.web.tsx:35`, `index.native.tsx:35` |
| Accesibilidad web | Todo icono se marca `aria-hidden="true"` y `focusable="false"`; la etiqueta debe vivir en el control padre | `index.web.tsx:38` |
| Accesibilidad nativa | Sin props de accesibilidad en el glifo (correcto si el padre etiqueta), pero tampoco `accessibilityElementsHidden` | `index.native.tsx:36` |
| Tipado | `IconName` derivado de `glyphs`; los nombres se validan en compilación | `index.web.tsx:30-40` |
| Pruebas / typecheck propios | El paquete no tiene `tsconfig`, script ni target Nx; solo se compila indirectamente a través de las apps | `ls packages/icons` (README, package.json, src); sin entrada en `package.json`/`nx.json` |

## 3. Adopción por aplicación

| App | Archivos que tocan la capa de iconos | Importaciones | Observación |
|---|---|---|---|
| `buyer-app` | 10 (`tabs/_layout`, `android-app-link`, `components/ui/icon-symbol` y 7 consumidores de `IconSymbol`) | `Icon` directo en 3 archivos; `IconSymbol` en 7 | Usa el paquete en toda la app, pero conserva un adaptador con nombres estilo SF Symbols |
| `business-app` | 6 (`app/index`, `(tabs)/_layout`, `(tabs)/index`, `(tabs)/more`, `(tabs)/team`, `components/operation-list`) | `Icon` directo | Adopción completa; sin glifos de texto en controles |
| `storefront-web` | 5 (home, tiendas, tienda, producto, `product-explorer`) | `Icon` directo, 13 usos | Adopción del paquete, pero quedan glifos de texto en buscador y tarjetas |

Comprobaciones de higiene, todas correctas:

- Ninguna app importa `lucide-react`, `lucide-react-native`, `@expo/vector-icons` ni otra colección directamente.
- Las tres apps declaran `@agestyles/icons` y `@agestyles/design-tokens` como dependencias de workspace.
- `react-native-svg@15.12.1` está fijado en ambas apps Expo y coincide con el `peerDependency`.
- No hay SVG locales ni `<svg>` en línea fuera del paquete; los dos `.svg` del repositorio son el símbolo de marca.
- No se encontraron glifos Unicode (flechas, checks, círculos) en las apps nativas.

## 4. Brechas priorizadas

### P1 — corrigen comportamiento o accesibilidad

1. **`IconSymbol` oculta nombres desconocidos tras un icono de ayuda.**
   `apps/buyer-app/components/ui/icon-symbol.tsx:4-16` define 11 alias; el componente declara `name: string` (línea 26) y resuelve `iconAliases[name] || "help"` (línea 30). Un nombre nuevo o mal escrito no falla en TypeScript y se dibuja como `?`. Además, dos llamadas evitan el tipo con `as any`: `components/checkout/payment-step.tsx:68` y `app/order-confirmation/[id].tsx:207`.
   *Propuesta:* tipar `name` como `IconName`, mapear alias a `IconName` y fallar en desarrollo si el nombre no existe, en lugar de degradar en silencio.

2. **Botón de eliminar sin nombre accesible.**
   `components/cart-item.tsx:63-65`: `TouchableOpacity` con solo un icono `trash`, sin `accessibilityLabel` ni `accessibilityRole="button"`. Un lector de pantalla no anuncia la acción.
   *Propuesta:* `accessibilityLabel="Quitar producto"` y rol de botón.

3. **Controles de cantidad con glifos de texto y sin etiqueta.**
   `components/cart-item.tsx:49-60`: los botones restan/suman con `Text "-"` y `Text "+"`, mientras `minus` y `plus` existen en el paquete y no se usan en ninguna app. Tampoco tienen nombre accesible ni rol.
   *Propuesta:* usar `minus`/`plus` y etiquetar “Quitar una unidad” / “Añadir una unidad”.

4. **Selección de pago con `✓` de texto y sin estado anunciado.**
   `components/checkout/payment-step.tsx:83` dibuja `✓` en lugar del glifo `check`, y la fila (`TouchableOpacity`, líneas 55-77) no declara `accessibilityRole` ni `accessibilityState`. La selección solo se comunica por color.
   *Propuesta:* `check` + rol `radio` con `checked`.

5. **Icono de error semánticamente incorrecto.**
   `apps/business-app/components/operation-list.tsx:22` usa `help` para el estado de error. El paquete no exporta un glifo de alerta, así que el error se representa con la misma forma que la ayuda.
   *Propuesta:* añadir `alert` a ambas entradas y usarlo también como fallback visible del adaptador.

### P2 — consistencia y deriva de tokens

6. **Grosor de trazo inconsistente en estado activo.** `apps/buyer-app/app/(drawer)/(tabs)/_layout.tsx:45,53,65` sube a 2.2 al enfocar; `business-app` mantiene 1.8 y comunica el estado solo con color; el storefront usa el valor por defecto. La guía dice “trazo de 1.8 por defecto” sin definir el estado activo.
   *Propuesta:* documentar “1.8 normal / 2.2 activo” o eliminar el cambio de grosor; aplicarlo en las tres plataformas.

7. **Tamaños fuera del rango documentado (20–24 px para controles).** Distribución observada de tamaños explícitos: 12 px ×9, 13 ×3, 14 ×3, 15 ×2, 16 ×1, 17 ×1, 18 ×5, 19 ×4, 20 ×5, 22 ×1, 24 ×3, 28 ×2. Casos que sí son controles y quedan fuera: buscador del storefront a 19 px (`app/page.tsx:30`), menú del comprador a 28 px (`(home)/_layout.tsx:34`), chevrons a 18–19 px (`operation-list.tsx:29`, `app/index.tsx:40`, `more.tsx:27`), escudo a 17–18 px (`app/index.tsx:52`, `(tabs)/index.tsx:30`). Los 12–15 px restantes son flechas dentro de enlaces con texto.
   *Propuesta:* subir los controles a 20–22 px y documentar un rango 12–16 para iconos en línea; si se mantiene 28 px en cabeceras, declararlo como excepción.

8. **Color de token duplicado como literal.** `business-app/app/(tabs)/_layout.tsx:13-14` usa `#111B2D`, que es `colors.light.action`; `buyer-app/components/android-app-link.tsx:26` usa `#FFFFFF` sobre botón de marca; ambas entradas del paquete usan `#171717` como color nativo por defecto. La guía prohíbe redefinir colores base fuera de los tokens.
   *Propuesta:* importar el token (o aceptar un valor por defecto inyectado) en lugar de literales.

9. **Glifos de texto en la web pública.** `apps/storefront-web/src/components/product-explorer.tsx:41` y `:58` usan `⌕` como lupa y `:54` usa `↗` como indicador de ficha. `search` ya está exportado y se usa en la cabecera. Estos caracteres dependen de la fuente del sistema y no comparten trazo con Lucide.
   *Propuesta:* sustituir `⌕` por `Icon name="search"`; para `↗`, decidir si es decorativo (mantener con `aria-hidden`) o añadir `externalLink` al paquete.

### P3 — deuda y observaciones

10. **Cobertura de tipos indirecta.** `packages/icons` no tiene `tsconfig`/target propio: un error de tipos en el paquete solo aparece al compilar una app. Es la duda ya abierta en el handoff (typecheck con `@types/react` fijado).
11. **`@agestyles/icons` no está en `transpilePackages`.** `apps/storefront-web/next.config.ts:10` transpila `@agestyles/api-client` y `@agestyles/domain`, pero no el paquete de iconos, que exporta `.tsx` sin compilar. Hoy funciona en el build desplegado; conviene añadirlo o documentar por qué el layout de workspace lo hace innecesario.
12. **API muerta en el adaptador.** `IconSymbol` acepta `weight` y lo ignora (`components/ui/collapsible.tsx:22-23`): resto del modelo SF Symbols. Eliminarlo evita expectativas falsas.
13. **Afordancia engañosa en tarjetas.** `product-explorer.tsx:52` pinta un corazón de 19 px dentro del enlace de imagen, decorativo (`aria-hidden`) y no accionable; sugiere “favorito” sin serlo.
14. **Faltantes y exportados sin uso.** No existen `alert` ni `externalLink`, que son los dos huecos que fuerzan las soluciones de los puntos 5 y 9. `minus` y `plus` están exportados y no se usan en ninguna app (el carrito dibuja `-`/`+` como texto), y `arrowLeft`, `bell`, `boxes`, `eye`, `eyeOff`, `mapPin`, `refresh`, `scan`, `send`, `settings`, `sliders`, `tag`, `truck` y `warehouse` tampoco tienen consumidor; conviene podarlos o justificarlos antes de ampliar el paquete.
15. **Divergencia de color por defecto entre plataformas.** Web hereda `currentColor` y nativo cae a un hex fijo; un uso de `<Icon>` sin `color` se ve distinto en web y en Android/iOS.

## 5. Accesibilidad: resumen

| Caso | Estado | Evidencia |
|---|---|---|
| Iconos decorativos web | Correcto (`aria-hidden`, no focusables) | `index.web.tsx:38` |
| Enlace de búsqueda solo-icono (web) | Correcto (`aria-label="Buscar"`) | `app/page.tsx:30` |
| Filas de operación con chevron | Correcto: el texto de la fila nombra el control | `operation-list.tsx:29` |
| Opciones de rol | Correcto: `radio` + `checked` | `(tabs)/team.tsx:213-219` |
| Eliminar del carrito | **Sin etiqueta** | `cart-item.tsx:63-65` |
| Cantidad −/+ | **Sin etiqueta ni rol** | `cart-item.tsx:49-60` |
| Selección de método de pago | **Sin rol ni estado** | `payment-step.tsx:55-83` |

## 6. Verificación ejecutada

| Comprobación | Resultado |
|---|---|
| Paridad de glifos web/nativo | 40/40, sin nombres exclusivos |
| Importaciones directas de otras librerías | 0 en `apps/**` |
| Declaración de dependencias en las tres apps | `@agestyles/icons` y `@agestyles/design-tokens` presentes |
| `react-native-svg` | 15.12.1 en ambas apps Expo, igual al peer |
| SVG locales / `<svg>` en línea | Solo los dos símbolos de marca |
| Glifos Unicode en apps nativas | 0 |
| Nombres usados por `IconSymbol` | 11 alias, todos resueltos (`home`, `send`, `code`, `chevronRight`, `chevronDown`, `menu`, `shoppingCart`, `creditCard`, `phone`, `arrowDown`, `trash`) |
| `git diff --check` | Limpio (solo se añade este informe) |

No se ejecutó typecheck ni build: la auditoría es de lectura y el árbol tiene cambios sin commit de la sesión Codex. La cobertura de tipos del paquete queda como brecha P3, no como verificación realizada.

## 7. Requiere validación en dispositivo

- Trazo real de 1.8 vs 2.2 en Android (diferencias de renderizado de `react-native-svg`).
- Tamaño efectivo y alineación de los iconos de tab bar en pantallas de 360 dp.
- Anuncio de los estados `radio`/`checked` con TalkBack (no verificable sin dispositivo).
- Comportamiento de `currentColor` en web frente al hex por defecto en nativo cuando no se pasa `color`.

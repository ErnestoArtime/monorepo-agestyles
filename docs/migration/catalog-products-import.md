# Preparación para migrar productos de AgeStyles Catálogo

**Estado:** preparación de alcance y mapeo; no hay exportación ni importación ejecutada.
**Fuente de esquema:** inspección del repositorio y lectura de metadatos de esquema/migraciones de Supabase `Agestyles-Catalogo`; no se leyeron filas de productos, usuarios ni otros datos.
**Contrato de staging:** `agestyles.stage-interchange` v1, validación local en modo dry-run.

Este documento concreta la primera migración de catálogo. La prioridad es llevar productos, variantes y medios al laboratorio aislado de AgeStyles; pedidos, clientes, pagos e identidades quedan fuera.

## Entidades de origen y destino propuesto

| AgeStyles Catálogo | Destino de staging/Medusa | Tratamiento |
|---|---|---|
| `categories`, `subcategories` | `categories` | Convertir la subcategoría en categoría hija. Mantener el slug de origen como `legacy_id`/metadata y resolver un handle estable; nunca resolver categoría por nombre. |
| `brands` | Metadata de producto o módulo de marca | Conservar ID/slug de origen. La decisión de módulo de marca debe quedar fijada antes de importar, para no duplicar marcas. |
| `clothing_types`, `sizes`, `clothing_type_sizes` | Opciones/atributos de producto | Mantener `size_type`, estado activo y orden. No generar variantes solo a partir de un nombre de talla. |
| `products` | `products` | `id` como identidad legacy; `name` → título; descripción y modelo se preservan; `code` se conserva como texto metadata para no perder ceros iniciales. `products.stock` es un agregado heredado y no es fuente autoritativa de inventario. |
| `products.variant_options` | `variants` | Es una lista de `{key,label}`. `key` es la identidad estable de la variante; `__default__` representa un producto sin opciones. |
| `product_commercial_variants` | `variants` y `offers` | Una fila por `variant_key`: SKU, barcode, precio, moneda, estado, orden y revisión. SKU puede repetirse entre productos en origen; cualquier colisión con la unicidad requerida por destino debe bloquearse para conciliación. |
| `product_variant_stock` | `inventory_items` e `inventory_levels` | Usar el saldo por `variant_key`; no sumar además `products.stock` ni `product_size_stock`. Crear niveles solo después de decidir la ubicación de stock por tienda. |
| `product_images` y `product_commercial_variants.image_urls` | `media_objects` + relaciones de producto/variante | Unificar y deduplicar URLs en staging. Verificar acceso/hash y re-hospedar antes de retirar Supabase Storage; no dejar el catálogo nuevo dependiente de URLs temporales o de un bucket que se vaya a cerrar. |
| `product_attribute_values`, familias y versiones PIM | Atributos y `@agestyles/catalog-pim` | Normalizar valores y asociar solo una versión publicada compatible. No copiar IDs de atributos/opciones como IDs del destino. |
| `products.store_id` | `sellers` / `offers` | Un producto asignado a tienda requiere una correspondencia explícita de tienda a seller. `null` no crea una oferta ni habilita la venta; queda como producto sin publicar en el staging. |

La publicación se deriva de `publication_status`, pero los estados `pending`, `approved`, `rejected` y `withdrawn` de solicitudes de revisión necesitan una regla aprobada antes de convertirlos en un producto vendible. Los productos importados inicialmente deben entrar como borrador hasta que precio, vendedor, medios y disponibilidad pasen la conciliación.

## Reglas que debe aplicar el preflight

- Capturar un corte consistente: conteos de origen al inicio/final, esquema de la base viva, fecha de exportación y un `export_id`. Si cambian conteos durante el corte, descartarlo y repetirlo.
- Excluir tablas `auth.*`, perfiles personales, clientes, direcciones, pedidos, eventos de pago, sesiones, invitaciones, tokens y secretos. La primera carga es solo catálogo.
- Preservar `USD` y `CUP` como monedas distintas; no convertir ni inventar tasa. Precio nulo o moneda desconocida bloquean la oferta, no el registro de producto en staging.
- Detectar IDs duplicados, referencias inexistentes, handles en conflicto, SKUs conflictivos, claves de variante sin opción correspondiente, moneda/estado no admitido, y productos sin tienda o sin precio publicable.
- Conciliar imágenes generales y de variante por contenido (hash), tipo MIME y resultado de lectura. No publicar URLs rotas ni copiar credenciales firmadas.
- Usar `legacy_id` estable y un futuro mapa de IDs para reintentos idempotentes. Un producto ya importado no debe crear otro al reejecutar.
- Emitir informes con conteos y códigos de error, nunca filas, nombres, URLs privadas, identificadores o contenido completo de productos.

El perfil `catalog-only` del validador comprueba estructura, hashes, referencias, moneda/estado permitidos, relación categoría-producto y metadatos de imagen sin URLs de origen. Rechaza entidades fuera del alcance y no escribe. Existe un adaptador local (`tools/migration/project-catalog-projection.mjs`) que convierte proyecciones JSON ya preparadas a `stage-interchange` usando fixtures sintéticos. Su salida agrega conteos fuente/staging por entidad, moneda/estado y presencia de `store_id`; una repetición sintética idéntica produce el mismo manifiesto/hash. La salida no contiene IDs ni valores de productos y no valida correspondencia store→seller. No consulta Supabase ni exporta filas. Aún no existe un exportador de origen ni un importador a Medusa; el preflight acepta únicamente paquetes de intercambio preparados localmente.

## Corte de esquema de referencia

La consulta agregada de una sola sentencia del 17 nov 2026 (09:11 UTC) confirmó 33 productos, 31 imágenes, 14 marcas, 5 categorías, 14 subcategorías y 19 saldos en `product_variant_stock`; además, `attribute_definitions=3`, `product_attribute_values=21`, `catalog_units=16`, y las familias/versiones, catálogo de atributos/opciones y variantes comerciales tienen cero filas. `product_size_stock=0`; `stores`, `merchants` y membresías también están en cero. Las estimaciones del inventario de tablas diferían en imágenes, categorías, subcategorías y tablas pequeñas, por lo que estos conteos SQL las sustituyen. La tabla `products` ya contiene `currency`, `publication_status`, `store_id`, `specifications`, `variant_options` y `catalog_family_version_id`; el exportador debe leer relaciones/columnas vivas y no asumir que solo existen campos del baseline antiguo. Estos conteos son metadatos agregados, no una conciliación ni autorización para importar filas.

## Secuencia propuesta

1. Obtener autorización para un backup cifrado y un `pg_dump --schema-only` de la fuente viva; no usar el VPS como destino de backup mientras no tenga espacio aprobado.
2. Aprobar el corte de exportación solo con categorías, marcas, definiciones PIM, productos, opciones, variantes comerciales, relaciones de inventario y metadatos de medios. Sin filas de usuarios ni pedidos.
3. Escribir el export en almacenamiento privado temporal fuera de Git; no guardar el archivo en `references/`, fixtures ni artefactos públicos.
4. Construir el adaptador idempotente y generar `stage-interchange` en un entorno local aislado. Ejecutar el validador y producir una conciliación agregada por entidad, moneda, estado, asignación de vendedor e imágenes.
5. Revisar manualmente los bloqueos; crear un bundle aprobado. Conservar intacto el original cifrado y su hash.
6. Importar primero en PostgreSQL/Redis de laboratorio desechables, usando el mapa de IDs y transacciones/reintentos. No apuntar a los dominios públicos ni al VPS.
7. Verificar conteos, referencias, variantes, precios por moneda, stock por ubicación e imágenes; comprobar Store API con productos sin vendedor excluidos de venta.
8. Solo después de aprobación explícita preparar una publicación de catálogo y su reversión.

## Bloqueos actuales

- El mapa de esquema disponible proviene del repositorio, no de un `pg_dump --schema-only` de la base viva.
- La precedencia entre `product_variant_stock` y `product_size_stock`, y el destino de stock por tienda, sigue sin decisión.
- USD/CUP no tienen política de regiones/tasas aprobada para el catálogo destino.
- Falta aprobar el mapeo de cada `store_id` a seller y el comportamiento de productos globales.
- Las imágenes necesitan una estrategia de copia/hash y almacenamiento destino.
- No se han ejecutado backup cifrado/restauración, exportación, preflight con datos reales ni importación.

Hasta cerrar esos puntos, no hay base segura para insertar productos reales ni publicarlos. El proyector y conciliador sintético son preparación local, no un exportador de Supabase. El siguiente paso de implementación es ampliar el contrato de proyección únicamente después de aprobar el esquema vivo y las decisiones de seller/moneda/stock/medios; el importador a Medusa seguirá fuera de alcance hasta demostrar backup y restore.

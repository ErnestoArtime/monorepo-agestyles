# Preparación para migrar productos de AgeStyles Catálogo

**Estado:** la proyección privada real del catálogo se generó el 17/11/2026; la importación a Medusa no se ejecutó.
**Fuente:** inspección de esquema/migraciones y lecturas acotadas de metadatos del catálogo en Supabase `Agestyles-Catalogo` (33 productos publicados, nombres/descripciones y categorías para revisar idioma, además de agregados de inventario). No se leyeron datos de usuarios, pedidos ni información personal.
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

El perfil `catalog-only` comprueba estructura, hashes, referencias y metadatos de imagen sin URLs de origen. Rechaza entidades fuera del alcance y no escribe. La moneda puede faltar y queda como dato legacy; no impide preservar el producto como borrador. La categoría también es opcional cuando falta en el origen. La relación producto→medio requiere orden entero no negativo y único, booleano principal, orden ascendente y como máximo un medio principal; `media_count` debe coincidir cuando se incluye. Los objetos deben tener hashes únicos. El adaptador (`tools/migration/project-catalog-projection.mjs`) convierte proyecciones JSON locales a `stage-interchange`, deduplica medios por SHA-256, conserva orden/imagen principal y guarda `store_id` como `payload.legacy_store_id` estable. No asume que una tienda legacy corresponda a un seller Medusa.

El importador `tools/migration/import-catalog-bundle-to-medusa.mjs` crea categorías inactivas y productos globales en estado `draft`, preservando los IDs legacy en `external_id` y metadata. Los productos sin categoría se crean sin asignación; los sin moneda siguen siendo borradores. Los precios se conservan solo como metadata, las variantes se crean sin precio y con `manage_inventory: false`, y no se crean seller links, ofertas, niveles de inventario ni medios. Así los datos incompletos no vuelven los productos comprables. Repetir el mismo bundle omite entidades ya importadas por su clave externa estable; marcadores duplicados o inconsistentes bloquean la corrida. Los registros existentes se omiten, no se actualizan.

La proyección normaliza al español los nombres de catálogo conocidos (`Tank Top`, `Shorts`, `Pullover`, `Breaker`, entre otros) y conserva el título/nombre original en metadata legacy. No traduce marcas, nombres propios ni descripciones de forma automática, ni inventa descripciones ausentes. En el corte revisado, los nombres de categorías y las dos descripciones existentes estaban en español; `Nike` se conserva como nombre propio.

El modo predeterminado `--dry-run` solo lee el bundle local y no realiza llamadas de red ni a la base de datos. `--apply` exige ambos flags de guardia, API `http://127.0.0.1:19081`, `DATABASE_URL` de PostgreSQL en `127.0.0.1:15472/agestyles_mercur_lab` y un bearer JWT Admin pasado por entorno. No se incluye ni se imprime ninguna credencial. El API Admin de Mercur 2.4.1 permite crear productos sin `seller_ids`; por eso pueden preservarse como productos globales en borrador sin inventar una asociación de vendedor. El importador no se ha ejecutado con el laboratorio ni con datos reales.

## Corte de esquema de referencia

La consulta agregada del 17 nov 2026 documenta 33 productos, 31 imágenes, 14 marcas, 5 categorías, 14 subcategorías y 19 saldos en `product_variant_stock`; `product_size_stock=0`; `stores`, `merchants`, membresías y variantes comerciales aparecen sin filas en ese corte. Esos conteos son antiguos y requieren revalidación. Una lectura agregada posterior reportó que 15 productos no tienen subcategoría, dos tienen descripción y uno tiene precio ≤0. El importador acepta productos sin categoría y conserva precios únicamente como metadata; no publica datos incompletos. Estos metadatos no autorizan a leer o exportar filas reales.

## Secuencia propuesta

1. Obtener autorización para un backup cifrado y un `pg_dump --schema-only` de la fuente viva; no usar el VPS como destino de backup mientras no tenga espacio aprobado.
2. Aprobar el corte de exportación solo con categorías, marcas, definiciones PIM, productos, opciones, variantes comerciales, relaciones de inventario y metadatos de medios. Sin filas de usuarios ni pedidos.
3. Escribir el export en almacenamiento privado temporal fuera de Git; no guardar el archivo en `references/`, fixtures ni artefactos públicos.
4. Usar el adaptador local existente para generar `stage-interchange` en un entorno aislado; ejecutar el validador y producir conciliación agregada por entidad, moneda, estado, asignación de vendedor e imágenes.
5. Revisar manualmente los bloqueos; crear un bundle aprobado. Conservar intacto el original cifrado y su hash.
6. Importar primero al laboratorio desechable con `migration:catalog:import <bundle> --dry-run`; tras revisar el resumen, una futura aplicación requerirá las dos guardas y los destinos loopback descritos arriba. El importador preserva IDs externos y tolera reintentos, pero no ofrece una transacción global entre todas las entidades. No apuntar a dominios públicos ni al VPS.
7. Verificar conteos, referencias, variantes, precios por moneda, stock por ubicación e imágenes; comprobar Store API con productos sin vendedor excluidos de venta.
8. Solo después de aprobación explícita preparar una publicación de catálogo y su reversión.

## Bloqueos actuales

- El mapa de esquema disponible proviene del repositorio, no de un `pg_dump --schema-only` de la base viva.
- La precedencia entre `product_variant_stock` y `product_size_stock`, y el destino de stock por tienda, sigue sin decisión.
- USD/CUP no tienen política de regiones/tasas aprobada para el catálogo destino.
- Falta aprobar el mapeo de cada `store_id` a seller y el comportamiento de productos globales.
- Las imágenes necesitan una estrategia de copia/hash y almacenamiento destino.
- No se han ejecutado backup cifrado/restauración ni importación real. La exportación pública acotada se realizó en el siguiente corte documentado; el exportador leyó solo catálogo publicado e imágenes públicas.

Hasta cerrar los bloqueos de respaldo, exportación y conciliación, no se debe importar un bundle real ni publicar productos. El importador local ya está preparado, pero solo debe usarse después de estos pasos manuales:

1. Conseguir backup cifrado de PostgreSQL y Storage en destino externo y demostrar una restauración aislada.
2. Capturar `pg_dump --schema-only` aprobado y preparar una proyección real de solo catálogo en almacenamiento local privado fuera del repo.
3. Reconciliar conteos e IDs; completar el mapa tienda legacy→seller con aprobación. Sin ese mapa los productos permanecerán globales y en borrador.
4. Rehospedar las imágenes y resolver moneda, variante, stock final y ubicación. Hasta entonces el importer conserva precio/moneda/media como metadata y no crea offers ni inventario.
5. El bundle real vigente vive en `/home/ernesto/.local/share/agestyles-migrations/catalog-2026-11-17-with-media` (directorio 700 y archivos 600); los bytes están aparte en `/home/ernesto/.local/share/agestyles-migrations/catalog-media-2026-11-17` (31 archivos, 2,123,500 bytes, hashes verificados). No volver a exportar sin nuevo corte aprobado. El usuario pidió usar el destino final y evitar más iteraciones de laboratorio: el storefront actual apunta a una API de laboratorio y no se ha configurado API de producción separada. Los 33 productos tampoco tienen tienda/seller asignado.
6. Conciliar los productos creados desde Admin API; una segunda corrida no duplica registros pero tampoco actualiza los que ya existían.

No se ha ejecutado ninguno de estos pasos con datos reales, ni se ha aplicado al laboratorio.

## Exportación pública inicial — 17 de noviembre de 2026

La proyección de catálogo publicado se creó fuera del repo desde el `.env.local` del repositorio histórico. El primer intento falló porque el exportador pedía el nombre `category_slug`, mientras que el esquema vivo publica `products.category`; se corrigió la selección y la proyección terminó con conteos concordantes. Se añadió `--media-directory` y se descargaron 31 imágenes públicas (2,123,500 bytes) a un directorio aparte; 31/31 hashes coinciden con sus nombres. El bundle tiene 33 productos, 5 categorías, 14 subcategorías y 33 variantes de opción. El dry-run informa 33 productos sin seller ni stock asignado y cero escrituras. El usuario confirmó que todos los productos pertenecerán a una tienda oficial AgeStyles. El storefront público usa el API del laboratorio y no hay API productiva separada en el repo; tampoco hay ubicación de inventario oficial definida para los saldos históricos. No se tocó Supabase ni Medusa.

## Revisión posterior del esquema vivo — 17 de noviembre de 2026, 11:27 UTC

La lista de migraciones del proyecto `Agestyles-Catalogo` confirma 80 aplicadas, con última `20261116061921_merchant_order_line_fulfillment`. La migración de origen `20261116120000_merchant_product_media.sql` no está aplicada. Su SQL agrega funciones autenticadas para adjuntar, quitar y seleccionar imágenes de productos merchant en borrador; no modifica el conjunto de productos históricos ni exporta objetos de Storage. Por tanto no debe tratarse como requisito del importador de catálogo. No se aplicó, no se alteró el checkout fuente y la carpeta fuente ya tenía cambios no relacionados sin seguimiento.

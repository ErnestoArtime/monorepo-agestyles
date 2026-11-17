# Dry-run del paquete de migración

El alcance inicial para trasladar el catálogo de productos se describe en [`docs/migration/catalog-products-import.md`](../../docs/migration/catalog-products-import.md). Ese documento es un mapeo y plan, no un permiso ni una herramienta para exportar/importar datos reales.

`validate-stage-bundle.mjs` valida un paquete JSON local del contrato intermedio `agestyles.stage-interchange` v1. El perfil por defecto revisa conteos, hashes, duplicados y referencias. El perfil `catalog-only` limita el bundle a categorías, productos, variantes y metadatos de medios. Rechaza datasets fuera de alcance como customers, orders, offers e inventario. El validador no conecta con fuentes ni escribe en bases de datos.

`project-catalog-projection.mjs` transforma cuatro archivos JSON locales ya proyectados (`categories.json`, `subcategories.json`, `products.json`, `image_metadata.json`) en el contrato de staging. No conecta con Supabase/PostgreSQL ni descarga imágenes. La proyección de medios debe contener solo `id`, `product_id`, `display_order`, `is_primary`, `sha256` y `mime_type`; cualquier URL de imagen se rechaza. Orden debe ser entero no negativo y único por producto; el indicador principal debe ser booleano y puede aparecer una sola vez por producto. El objeto de medio se deduplica por SHA-256, mientras cada relación de producto conserva orden y marca principal; un mismo hash con MIME incompatible se rechaza. Los campos no incluidos en la lista de mapeo se descartan, por lo que stock, datos de clientes y otros campos no llegan al bundle. El proyector ahora conserva `products.store_id` como `payload.legacy_store_id` estable (o `null`) para permitir conciliar explícitamente tienda origen con seller destino. Este valor no se convierte en un seller ni crea una oferta. El producto conserva la publicación de origen como dato de auditoría, pero siempre marca `import_visibility: draft_until_reconciled`; esto no publica nada ni crea ofertas.

La salida del proyector añade un informe agregado efímero: conteos de fuente y staging para categorías/subcategorías, productos, variantes y medios; hashes de medios únicos y filas duplicadas; conteos de moneda/estado con bucket `unsupported`; y productos con/sin `store_id`. Verifica correspondencia de conteos, pero no valida que un `store_id` se asigne a un seller ni que el contenido real se haya exportado correctamente. No incluye IDs, nombres, precios, URLs ni contenido de filas y no se guarda dentro del bundle. Dos proyecciones sintéticas idénticas generan manifiestos con hashes iguales.

El validador y el proyector solo leen/escriben archivos locales y no abren conexiones de red. El importador descrito abajo sí ofrece escritura, pero solo al API loopback del laboratorio con guardas explícitas. Sus resúmenes contienen estado y cantidades, no IDs ni contenido `payload`. Los hashes detectan discrepancias entre archivos y manifiesto, pero no son una firma ni demuestran quién produjo el paquete. No usar datos reales hasta aprobar formato de exportación, almacenamiento cifrado y restauración.

## Formato intermedio

Cada directorio contiene `manifest.json` y un archivo `<entity>.json` por entidad. El manifiesto exige:

```json
{
  "format": "agestyles.stage-interchange",
  "schema_version": 1,
  "schema_contract": "agestyles-stage-interchange-v1",
  "bundle_mode": "dry-run-only",
  "source": { "export_id": "synthetic-export-001" },
  "datasets": [
    { "entity": "categories", "file": "categories.json", "record_count": 1, "sha256": "<64 hex chars>" }
  ]
}
```

Cada archivo de entidad es un array de filas normalizadas con `legacy_id`, `references` y `payload`. Una referencia común contiene `{ "relation", "entity", "legacy_id" }`. La relación producto→medio añade `display_order` (entero no negativo) e `is_primary` (booleano); sus órdenes deben ser únicos y ascendentes dentro del producto, puede haber como máximo una principal, y `payload.media_count`, cuando está presente, debe coincidir con el número de relaciones. Los objetos de medio deben tener SHA-256 únicos. El validador interpreta estos campos únicamente en el perfil `catalog-only`; los nombres de entidad y relaciones estructurales v1 declarados en el código no son equivalencias confirmadas con columnas legacy.

## Ejecutar

```sh
node tools/migration/validate-stage-bundle.mjs tools/migration/fixtures/synthetic-v1
corepack pnpm migration:catalog:check tools/migration/fixtures/synthetic-catalog-v1
corepack pnpm migration:catalog:project <projection-local> <directorio-nuevo-de-staging> <export-id>
corepack pnpm migration:catalog:check <directorio-nuevo-de-staging>
corepack pnpm migration:catalog:project tools/migration/fixtures/synthetic-source-projection /tmp/agestyles-catalog-stage-sample synthetic-001
corepack pnpm migration:catalog:check /tmp/agestyles-catalog-stage-sample
corepack pnpm migration:catalog:import /tmp/agestyles-catalog-stage-sample --dry-run
corepack pnpm migration:test
```

El exportador de solo lectura `export-public-supabase-catalog.mjs` acepta exclusivamente tablas públicas de categorías, subcategorías, productos publicados e imágenes públicas; usa la clave anon, pagina por ID y fija el conteo durante la lectura. Por defecto descarga temporalmente las imágenes públicas solo para calcular hash/MIME y no guarda sus bytes. Con `--media-directory`, guarda las imágenes en una carpeta privada separada, bajo nombre SHA-256, con límites de 25 MiB por archivo y 100 MiB por corte; valida el MIME y no agrega los bytes al bundle JSON. No exporta usuarios, pedidos ni credenciales. Tanto el bundle como el directorio de medios deben ser nuevos, privados y estar fuera del monorepo.

```sh
AGESTYLES_SOURCE_CATALOG_EXPORT_ALLOW=true corepack pnpm exec node --env-file=/home/ernesto/proyectos/Agestyles-Catalogo/.env.local tools/migration/export-public-supabase-catalog.mjs /home/ernesto/.codex/private-backups/agestyles-catalog-stage --export
```

Para preparar también los archivos de medios por hash, añade un destino privado separado:

```sh
AGESTYLES_SOURCE_CATALOG_EXPORT_ALLOW=true corepack pnpm exec node --env-file=/home/ernesto/proyectos/Agestyles-Catalogo/.env.local tools/migration/export-public-supabase-catalog.mjs /home/ernesto/.local/share/agestyles-migrations/catalog-stage --export --media-directory /home/ernesto/.local/share/agestyles-migrations/catalog-media
```

El archivo de origen aporta `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`; el exportador no lee la clave de servicio. La carpeta de salida debe no existir. El bundle resultante incluye IDs/nombres/precios legacy y no debe subirse a Git ni publicarse. Para revisar el resumen sin escribir en Medusa: `corepack pnpm run migration:catalog:import -- <carpeta-privada> --dry-run`.

El importador usa `--dry-run` por defecto. Para el catálogo oficial, el modo de producción vincula los borradores a la tienda AgeStyles y puede reutilizar las URLs del bucket histórico de Supabase. El exportador genera el mapa hermano `<paquete>.source-image-urls.json` fuera del bundle. Las variables privadas y los pasos de carga están en la [guía de producción](../../docs/runbooks/commerce-production-vps.md). El modo de laboratorio usa sus propias variables y solo escribe en `127.0.0.1:19081`.

La entrada de prueba sintética usa `id, slug, name, sort_order` en categorías; `id, category_slug, slug, name, sort_order` en subcategorías; una proyección acotada de `products` (`id, code, name, description, price, currency, featured, gender, model, brand_id, subcategory_id, category, publication_status, specifications, variant_options, catalog_family_version_id`); y metadatos de medios con hash/MIME. `variant_options` debe ser una lista JSON de `{key,label}` o estar vacía; en ese caso se genera `__default__`. Cada destino debe ser una carpeta nueva y recibe permisos privados locales. La utilidad emite solo cantidades/estado; no vuelca nombres, IDs ni payload.

El target `test` de migración está conectado a Nx; también se ejecuta como parte de `corepack pnpm test` en la raíz.

El perfil `catalog-only` ignora el contenido de archivos para entidades fuera de alcance y devuelve únicamente códigos y cantidades; no elimina archivos del bundle. El operador debe usar carpetas privadas y no entregar bundles con PII. El exportador está acotado por código a datos públicos de catálogo y usa la clave anon. La exportación real actual no sustituye el respaldo, la restauración aislada ni la conciliación de origen/destino.

## Pendiente antes de un ETL real

- Capturar y revisar el esquema legacy actualizado y el contrato de cada exportación, sin importar RLS, funciones, rutas ni tablas `auth.*`.
- Confirmar backup cifrado de PostgreSQL, Storage y Auth, destino externo con espacio y prueba de restore; el VPS no es destino mientras no haya margen de disco aprobado.
- Definir mapeo legado→Medusa/Mercur para IDs, categorías/familias, marcas, variantes/ofertas, saldos/movimientos/reservas, medios, clientes/identidades, pedidos/ítems y favoritos/preferencias.
- Decidir tratamiento histórico, monedas/totales, stock final, consentimiento/PII y estrategia de IDs idempotentes.
- Capturar esquema vivo y aprobar el corte antes de producir una proyección real. El adaptador convierte proyecciones locales; no es un exportador de fuente.
- Ejecutar la exportación acotada de Supabase después de resolver backup/restore y revisar su conciliación por entidad; completar mapeo de vendedores, monedas, inventario y medios antes de publicar.

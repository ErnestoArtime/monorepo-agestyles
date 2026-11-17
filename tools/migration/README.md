# Dry-run del paquete de migración

El alcance inicial para trasladar el catálogo de productos se describe en [`docs/migration/catalog-products-import.md`](../../docs/migration/catalog-products-import.md). Ese documento es un mapeo y plan, no un permiso ni una herramienta para exportar/importar datos reales.

`validate-stage-bundle.mjs` valida un paquete JSON local del contrato intermedio `agestyles.stage-interchange` v1. El perfil por defecto revisa conteos, hashes, duplicados y referencias. El perfil `catalog-only` limita el bundle a categorías, productos, variantes y metadatos de medios; comprueba moneda y estado legacy, referencias mínimas y metadatos de imagen sin URL de origen. Rechaza datasets fuera de alcance como customers, orders, offers e inventario. **No describe ni presupone el esquema real de `Agestyles-Catalogo`, no exporta ni importa datos y no escribe en DB.**

`project-catalog-projection.mjs` transforma cuatro archivos JSON locales ya proyectados (`categories.json`, `subcategories.json`, `products.json`, `image_metadata.json`) en el contrato de staging. No conecta con Supabase/PostgreSQL ni descarga imágenes. La proyección de medios debe contener solo `id`, `product_id`, `display_order`, `is_primary`, `sha256` y `mime_type`; cualquier URL de imagen se rechaza. El objeto de medio se deduplica por SHA-256, mientras cada relación de producto conserva orden y marca principal; un mismo hash con MIME incompatible se rechaza. Los campos no incluidos en la lista de mapeo se descartan, por lo que `store_id`, stock, datos de clientes y otros campos no llegan al bundle. El producto conserva la publicación de origen como dato de auditoría, pero siempre marca `import_visibility: draft_until_reconciled`; esto no publica nada ni crea ofertas.

La salida del proyector añade un informe agregado efímero: conteos de fuente y staging para categorías/subcategorías, productos, variantes y medios; hashes de medios únicos y filas duplicadas; conteos de moneda/estado con bucket `unsupported`; y productos con/sin `store_id`. Verifica correspondencia de conteos, pero no valida que un `store_id` se asigne a un seller ni que el contenido real se haya exportado correctamente. No incluye IDs, nombres, precios, URLs ni contenido de filas y no se guarda dentro del bundle. Dos proyecciones sintéticas idénticas generan manifiestos con hashes iguales.

El programa solo lee archivos locales, no carga SDK de Supabase/PostgreSQL, no abre conexiones de red y no tiene modo de escritura. Su salida contiene estado, entidades, cantidades, SHA-256 y códigos de error; nunca imprime IDs ni contenido `payload`. Los hashes detectan discrepancias entre los archivos y su manifiesto, pero no son una firma ni demuestran quién produjo el paquete. No usarlo con PII hasta que el formato de exportación real, el almacenamiento cifrado y la restauración hayan sido aprobados.

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

Cada archivo de entidad es un array de filas normalizadas con `legacy_id`, `references` (lista de `{ "relation", "entity", "legacy_id" }`) y `payload` (objeto opaco). El validador solo interpreta esos campos. Los nombres permitidos y referencias estructurales v1 están declarados en el código; no son equivalencias confirmadas con columnas legacy.

## Ejecutar

```sh
node tools/migration/validate-stage-bundle.mjs tools/migration/fixtures/synthetic-v1
corepack pnpm migration:catalog:check tools/migration/fixtures/synthetic-catalog-v1
corepack pnpm migration:catalog:project <projection-local> <directorio-nuevo-de-staging> <export-id>
corepack pnpm migration:catalog:check <directorio-nuevo-de-staging>
corepack pnpm migration:catalog:project tools/migration/fixtures/synthetic-source-projection /tmp/agestyles-catalog-stage-sample synthetic-001
corepack pnpm migration:catalog:check /tmp/agestyles-catalog-stage-sample
corepack pnpm migration:test
```

La entrada de prueba sintética usa `id, slug, name, sort_order` en categorías; `id, category_slug, slug, name, sort_order` en subcategorías; una proyección acotada de `products` (`id, code, name, description, price, currency, featured, gender, model, brand_id, subcategory_id, category_slug, publication_status, specifications, variant_options, catalog_family_version_id`); y metadatos de medios con hash/MIME. `variant_options` debe ser una lista JSON de `{key,label}` o estar vacía; en ese caso se genera `__default__`. Cada destino debe ser una carpeta nueva y recibe permisos privados locales. La utilidad emite solo cantidades/estado; no vuelca nombres, IDs ni payload.

El target `test` de migración está conectado a Nx; también se ejecuta como parte de `corepack pnpm test` en la raíz.

El perfil `catalog-only` ignora el contenido de archivos para entidades fuera de alcance y devuelve únicamente los códigos/counts; no elimina archivos del bundle. El operador debe usar una carpeta privada y no entregar bundles con PII. Una exportación futura debe pasar por aprobación de esquema específica antes de transformar dinero/stock, escribir el mapa de IDs o conectar un importador a PostgreSQL. Este preflight no es respaldo ni evidencia de conciliación/restauración.

## Pendiente antes de un ETL real

- Capturar y revisar el esquema legacy actualizado y el contrato de cada exportación, sin importar RLS, funciones, rutas ni tablas `auth.*`.
- Confirmar backup cifrado de PostgreSQL, Storage y Auth, destino externo con espacio y prueba de restore; el VPS no es destino mientras no haya margen de disco aprobado.
- Definir mapeo legado→Medusa/Mercur para IDs, categorías/familias, marcas, variantes/ofertas, saldos/movimientos/reservas, medios, clientes/identidades, pedidos/ítems y favoritos/preferencias.
- Decidir tratamiento histórico, monedas/totales, stock final, consentimiento/PII y estrategia de IDs idempotentes.
- Capturar esquema vivo y aprobar el corte antes de producir una proyección real. El adaptador actual solo convierte proyecciones locales sintéticas; no es un exportador ni un migrador.
- Implementar importador transaccional/idempotente y reconciliación por entidad después de resolver backup/restore, mapeo de vendedores, monedas, inventario y medios.

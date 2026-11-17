# Dry-run del paquete de migración

El alcance inicial para trasladar el catálogo de productos se describe en [`docs/migration/catalog-products-import.md`](../../docs/migration/catalog-products-import.md). Ese documento es un mapeo y plan, no un permiso ni una herramienta para exportar/importar datos reales.

`validate-stage-bundle.mjs` valida un paquete JSON local del contrato intermedio `agestyles.stage-interchange` v1. El perfil por defecto revisa conteos, hashes, duplicados y referencias. El perfil `catalog-only` limita el bundle a categorías, productos, variantes y metadatos de medios; comprueba moneda y estado legacy, referencias mínimas y metadatos de imagen sin URL de origen. Rechaza datasets fuera de alcance como customers, orders, offers e inventario. **No describe ni presupone el esquema real de `Agestyles-Catalogo`, no exporta ni importa datos y no escribe en DB.**

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
node tools/migration/validate-stage-bundle.mjs --profile catalog-only <catalog-bundle-directory>
node --test tools/migration/test/validate-stage-bundle.test.mjs
```

El perfil `catalog-only` ignora el contenido de archivos para entidades fuera de alcance y devuelve únicamente los códigos/counts; no elimina archivos del bundle. El operador debe usar una carpeta privada y no entregar bundles con PII. Una exportación futura debe pasar por aprobación de esquema específica antes de transformar dinero/stock, escribir el mapa de IDs o conectar un importador a PostgreSQL. Este preflight no es respaldo ni evidencia de conciliación/restauración.

## Pendiente antes de un ETL real

- Capturar y revisar el esquema legacy actualizado y el contrato de cada exportación, sin importar RLS, funciones, rutas ni tablas `auth.*`.
- Confirmar backup cifrado de PostgreSQL, Storage y Auth, destino externo con espacio y prueba de restore; el VPS no es destino mientras no haya margen de disco aprobado.
- Definir mapeo legado→Medusa/Mercur para IDs, categorías/familias, marcas, variantes/ofertas, saldos/movimientos/reservas, medios, clientes/identidades, pedidos/ítems y favoritos/preferencias.
- Decidir tratamiento histórico, monedas/totales, stock final, consentimiento/PII y estrategia de IDs idempotentes.
- Implementar migrador transaccional/dry-run con métricas y reconciliación por entidad; este paquete no escribe en DB.

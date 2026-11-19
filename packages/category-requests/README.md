# @agestyles/category-requests

Módulo de Medusa v2 (registrado en `apps/commerce-api/medusa-config.ts`) con las **solicitudes de categoría** de las tiendas (AG-35).

## Por qué existe

Mercur 2.4.1 no permite que un vendedor cree ni solicite categorías. Su enlace categoría–tienda (`links/category-seller-link`) solo **restringe** categorías a una tienda (`validate-seller-product-permissions`). Las categorías siguen siendo las del módulo de productos de Medusa; este módulo solo guarda la solicitud y la decisión.

## Flujo

1. La tienda (titular o `role_seller_administration`) propone nombre, descripción, dónde cree que encaja y para qué la necesita: `POST /vendor/agestyles/category-requests`. Máximo 10 pendientes por tienda y sin nombres repetidos entre las pendientes.
2. La administración decide en `POST /admin/agestyles/category-requests/:id`:
   - `approve`: crea la categoría con `createProductCategoriesWorkflow`, como principal o dentro de otra (`parent_id`);
   - `merge`: indica una categoría existente;
   - `reject`: con motivo obligatorio.
   Una solicitud solo se decide una vez.
3. La tienda ve el estado y la nota en Negocio → «Solicitar categoría».

Las **secciones propias** de cada tienda (sin aprobación, solo para ordenar su página) no están aquí: se guardan en los metadatos del seller (`apps/commerce-api/src/lib/store-sections.ts`).

## Pruebas

`pnpm --filter @agestyles/category-requests test` (reglas de validación, sin base de datos).

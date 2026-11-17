# Diagnóstico de `GET /vendor/orders` para Kickz/B1

**Fecha:** 17 de noviembre de 2026
**Alcance:** revisión estática y de observabilidad ya disponible; sin escrituras ni nuevas peticiones autenticadas.

## Evidencia observada

- La matriz previa de solo lectura registró que el mismo actor de Kickz obtiene HTTP 500 en B1 tanto con los campos predeterminados como con `?limit=20`, `?fields=id` y `?fields=id,display_id,status,total`. B2 devuelve 200 con esas variantes. El verificador de roles salió por error y su `finally` quitó las membresías temporales. No se repitió la matriz.
- El laboratorio PostgreSQL/Redis seguía saludable en Compose durante esta revisión. El API vigente de laboratorio estaba ejecutándose en `127.0.0.1:19081` como proceso Medusa del host; Docker solo contiene gateways y servicios de datos, no el proceso de Medusa.
- No había archivos de log de Medusa en el repositorio. Los descriptores stdout/stderr del proceso vigente apuntan a pipes, no a un archivo conservado que pueda consultarse con este acceso. Por ello no se obtuvo el stack trace que permitiría distinguir una excepción de consulta de otra causa.
- El repo fija `@mercurjs/core` 2.4.1 y `@medusajs/medusa`/`@medusajs/core-flows` 2.22.3. No se encontró diferencia de versión/configuración entre B1 y B2 en la evidencia disponible.

## Ruta de ejecución relevante

La implementación instalada del paquete Mercur, bajo `node_modules/.pnpm/@mercurjs+core@2.4.1.../.medusa/server/src/api/vendor/orders/`, muestra:

1. `middlewares.js`: permiso `orders:view`, validación con `vendorOrderQueryConfig.list` y middleware `applySellerLinkFilter` para `/vendor/orders`.
2. `route.js`: ejecuta `getOrdersListWorkflow` con `req.filterableFields` y `is_draft_order: false`; luego normaliza colecciones de pago antes de serializar.
3. `query-config.js`: los campos por defecto recorren relaciones anidadas de líneas, ofertas, inventario, carrito/pago, fulfillments, devoluciones y resumen. El propio paquete documenta que la expansión de relaciones es sensible a combinaciones de campos.

Así, `?fields=id` no prueba que la consulta efectiva solo lea `id`: `validateAndTransformQuery` combina la petición con los campos por defecto. La respuesta diferencial B1/B2 mantiene como posibilidades un pedido o relación del fixture B1 que no se puede expandir/normalizar, o una diferencia de datos vinculados a sus pedidos. El patrón no identifica la relación ni confirma que los datos sean la causa. La autorización tampoco queda demostrada como causa: el mismo owner llegó a una respuesta 200 en B2.

## Conclusión

La causa raíz **no queda determinada**. La evidencia acota el problema a la lectura seller-scoped de pedidos B1 y no a los campos explícitos solicitados. F1 permanece abierta y la matriz Kickz no debe contarse como aprobada.

## Siguiente verificación segura

En una futura ejecución autorizada exclusivamente en el laboratorio, conservar el request ID y el stack trace de Medusa para una sola petición GET fallida, con secretos y datos personales redactados. Antes de comparar pedidos/relaciones de B1 y B2, usar una copia desechable/restaurable o una consulta estrictamente de solo lectura que proyecte únicamente IDs y presencia de relaciones; no corregir ni borrar filas del fixture. Si el error resulta ser una expansión de relaciones, probar en esa copia la ruta con selección mínima efectiva y luego con grupos de campos, manteniendo el filtro seller y comprobando que la salida no cruce vendedores. Solo después de entender el fallo repetir la matriz completa y contar sus checks.

No se reiniciaron servicios, no se llamó a la API durante esta revisión, no se leyeron ni modificaron filas de PostgreSQL, inventario, reservas o membresías, y no se accedió a Supabase.

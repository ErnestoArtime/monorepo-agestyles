# Estado de ejecución del plan maestro AgeStyles 2.0

**Corte:** 25 de noviembre de 2026. AgeStyles 2.0 está en piloto avanzado. La API y las tres webs están operativas. El piloto web generó dos pedidos con pago manual sin captura. Quedan por cerrar la recuperación de producción, el recorrido comercial en Android y la decisión de corte del legado.

**Objetivo compartido:** operar AgeStyles 2.0 en producción con la tienda oficial y alcanzar paridad funcional con el catálogo legado para poder retirarlo. La fuente antigua sigue activa hasta que exista una decisión de corte y un plan de respaldo/rollback. Ver [tablero único](./TABLERO.md) y [plan maestro](./AGESTYLES_2_0_PLAN_MAESTRO.md).

## Producción hoy

| Área | Estado observado |
|---|---|
| API | `agestyles-api.eav-labs.com` responde con la imagen de `1dc0feb` (`sha256:bb917a773647…`), contenedor saludable. Migración de eventos aplicada. Creación HTTP 201 y repetición deduplicada HTTP 200 comprobadas en producción. |
| Webs | Tienda, Catálogo y Negocio respondieron HTTP 200 el 25 nov. Negocio incluye las tablas de gestión y «Vistas y clics». La validación de analítica con sesión de vendedor está pendiente. Tienda y Catálogo esperan la publicación de las nuevas versiones con eventos y páginas legales. El legado también respondió 200. |
| APK | Tienda 1.5.0 y Negocio 1.3.0 publicadas en ARM64. Pendiente recorrido en dispositivo Android. |
| Catálogo e inventario | La conciliación histórica registró 33 productos de origen, 31 ofertas publicadas y 2 borradores, con 5 categorías. De las ofertas publicadas, 15 tenían stock (26 unidades) según la regla del legado, sin descontar reservas que no eran legibles con clave anónima. Las fotos siguen en Supabase. Es un dato histórico de migración. |
| Actividad | El piloto web AG-11 generó dos pedidos, uno por vendedor, con pago manual sin captura y entrega simulada. Falta comprobar un pago recibido y conciliado y el recorrido en Android. |
| CUP | AG-54 desplegada. La API devolvió 970 CUP/USD de elTOQUE, con actualización del 25 nov a las 06:30 UTC. El carrito web ya mostró la conversión en el piloto anterior. |
| Capacidad | 11 GiB libres y 95 % de ocupación en la lectura del 25 nov. AG-16 sigue siendo seguimiento operativo. |

## Estado por fase

| Fase | Estado | Evidencia vigente | Falta para cerrar |
|---|---|---|---|
| F0 Auditoría y protección | En curso | Supabase legado sigue intacto; no hay copia externa de producción ni restore probado. Los conteos históricos de fuente incluyen 33 productos, 31 imágenes, 48 movimientos y 7 pedidos. | AG-02: destino cifrado, backup de PostgreSQL/Storage/Auth y restauración aislada; revisar hallazgos de seguridad de Supabase. |
| F1 Spike Mercur | Parcial | Carrito de dos vendedores, pedidos separados por tienda y permisos se probaron en el laboratorio. | AG-12: causa del 500 Kickz/B1 y revalidación de matriz; cerrar brechas restantes y decisión documentada de continuar. |
| F2 Monorepo reproducible | Parcial | Nx/pnpm, CI y builds web/API están en uso; verificación de calidad más reciente referenciada en CI/handoff. | Completar pruebas en dispositivos (AG-14); confirmar protección de rama/CODEOWNERS. |
| F3 Catálogo y marketplace web | Parcial | Catálogo público en producción con 31 productos y 5 categorías. | Recorrido visual/teclado, compra web completa y mensajes de beta/prueba coherentes (AG-07, AG-11, AG-13). |
| F4 App comprador | Parcial | Tienda web y APK Android publicadas. Carrito multivendedor y visualización CUP comprobados en web. | AG-11: validar compra, WhatsApp y seguimiento en Android. AG-14: accesibilidad y validación nativa; iOS queda para después. |
| F5 App negocio | En curso | Negocio web y APK publicadas. Tablas de Usuarios, Pedidos, Tiendas e Inventario y detalle con estados separados de pedido, pago y entrega (AG-56/57/58). | Validación por rol y dispositivo, revisión cruzada de pedidos y prueba de analítica con sesión real. Ver AG-03/04/05 para sus revisiones. |
| F6 Migración de catálogo | Parcial: catálogo activo migrado | 33 productos de origen: 31 ofertas USD publicadas en la tienda oficial; 2 quedan en borrador por reglas de precio/exclusión. Hay 15 ofertas con stock (26 uds) por la regla de legado: suma de `product_variant_stock` si hay filas; si no, `products.stock`. El dato no resta reservas, que no son legibles con la clave anon. Fotos referenciadas desde Supabase; 5 categorías activas. | Documentar conciliación de fuente → producto/oferta/variante y la limitación de reservas; migrar pedidos/clientes/históricos solo si forman parte del alcance; completar backup/restore (AG-02). Mantener el bucket de medios de Supabase operativo. |
| F7 QA y piloto | Parcial | CI cubre contratos y API desechable. Piloto web USD realizado con pago manual sin captura; aviso incorrecto de stock resuelto y verificado (AG-51). | AG-11/12/13/14: compra real, diagnóstico Kickz/B1, revisión visual y dispositivos; carga/seguridad/rollback y UAT. |
| F8 Producción y retiro gradual del legado | Iniciada, sin go/no-go | Las webs nuevas y el legado están activos a la vez. La coexistencia mantiene dos vías de venta abiertas; los pedidos piloto están documentados en AG-11. Las imágenes públicas siguen sirviéndose desde Supabase Storage. | AG-02/08/11: backup y restore, decisión de escritor único/sincronización, compra piloto, rollback, criterios de corte y periodo de archivo. Retirar la web/operación antigua no autoriza apagar el proyecto o bucket de Supabase: conservar `product-images` y sus URLs mientras las use la tienda 2.0, o migrar/verificar los medios antes de desactivarlo. |
| F9 Evolución posterior | Iniciada | AI Studio tiene eliminación de fondo desplegada (AG-27). | Aplazar ampliaciones mientras se cierra el piloto. |

## Riesgos y decisiones abiertas

1. **Sin backup/restore probado en producción** (AG-02), mientras la nueva plataforma ya está pública.
2. **Dos storefronts disponibles para vender:** el legado sigue activo junto a 2.0 (AG-08). Elegir escritor único o sincronización antes de ampliar operaciones.
3. **Piloto comercial incompleto:** queda el recorrido Android y la conciliación de un pago recibido (AG-11).
4. **Analítica y páginas legales:** falta la prueba con vendedor, el despliegue de las nuevas versiones de Tienda y Catálogo, la identidad del responsable y la política de cambios y devoluciones (AG-59/61).
5. **Disco al 95 %:** 11 GiB libres el 25 nov; seguir su evolución (AG-16).
6. **Mensajes de beta/datos de prueba** en páginas que ya apuntan a producción y contenido legado con la palabra «prueba» (AG-07); ajustar copy con aprobación del usuario.
7. **Comisiones:** fases 1 a 4 desplegadas; quedan revisiones de las fases 3 y 4 (AG-06).
8. **Pedidos Kickz/B1 en laboratorio:** queda capturar el error 500 y cerrar el diagnóstico (AG-12). El 502 de conexión de Buyer se corrigió por separado (AG-10).
9. **Dependencia de Supabase Storage:** las fotos del catálogo 2.0 dependen del bucket público `product-images`. Apagar Supabase al retirar la web antigua rompería esas imágenes; separar la retirada de la app legacy del ciclo de vida del proyecto/bucket.

## Paridad con el catálogo legado

| Capacidad | Pendiente / decisión | Tablero |
|---|---|---|
| Movimientos de inventario con motivo, filtros y exportación | Historial y exportación desplegados. Revisar el alcance y la conciliación de los 48 movimientos del legado. | AG-03 |
| Etapas de preparación y seguimiento del pedido | Ciclo probado en el piloto web; pendiente recorrido Android y revisión cruzada de las mejoras de pedidos. | AG-04 |
| Importación/corrección por CSV | Flujo publicado con respaldo del SKU de inventario. Quedan revisión cruzada y decisión sobre poblar el SKU de las variantes (AG-29). | AG-05 |
| Gestores de venta y comisiones | Fases 1 a 4 desplegadas; quedan revisiones de informes y atribución online. | AG-06 |
| Precios en CUP | Tasa automática de elTOQUE y conversión web verificadas; falta el recorrido en Android. | AG-54 |
| Contacto y pedido por WhatsApp | Enlaces por tienda implementados; falta recorrerlos en una compra real de punta a punta. | AG-11 |
| Favoritos | Buyer los guarda localmente en el dispositivo; no hay sincronización con cuenta entre dispositivos. Confirmar si el legado ofrecía persistencia de cuenta antes de ampliar. | paridad por confirmar |
| Comparador de productos | Pantallas implementadas. Para comparar fichas reales hace falta asignar familias y atributos (AG-28/42). | AG-17 |
| Páginas de marcas y novedades | Novedades desplegada. Falta decidir cómo asociar las marcas del legado a los productos. | AG-18 |
| Avisos de pedido con reintentos | Bandeja y cola con reintentos desplegadas. Pendiente configurar y validar correo y push. | AG-19 |
| Devoluciones parciales | Falta flujo y permisos desde Negocio y Tienda. | AG-20 |
| Un solo sistema de venta | Resolver relación entre la plataforma nueva y el legado activo antes de corte. | AG-08 |
| Imágenes | Decisión aplicada: mantener las URL HTTPS de Supabase; conservar el bucket mientras esas URL estén en uso. | decisión de corte F8 |

## Próximos pasos

1. Proteger producción y recuperar margen de disco (AG-02/16). AG-02 sigue aplazada por decisión del usuario. Para retomarla, definir el destino externo y probar una restauración aislada. El volcado previo a AG-61 se validó con `pg_restore --list`.
2. Cerrar AG-11 con Tienda 1.5.0 y Negocio 1.3.0 en Android. Recorrer carrito de dos tiendas, entrega, WhatsApp, notificaciones y seguimiento. Registrar por separado el resultado de un pago recibido y conciliado.
3. Terminar las revisiones de Negocio y laboratorio (AG-12/13/57). Cubrir permisos, búsqueda, paginación, preparación y entrega parcial, escritorio y Android, temas y accesibilidad.
4. Completar AG-59/61. Validar el panel con sesión de vendedor, confirmar identidad y política de devoluciones, publicar Tienda y Catálogo y verificar los eventos. Configurar Search Console y GA4 con consentimiento cuando se disponga de los valores correspondientes.
5. Completar catálogo comercial (AG-28/29/42). Definir familias, atributos y unidades, resolver SKU de variantes y validar filtros, comparación e importación CSV con el catálogo real.
6. Acordar el corte del legado (AG-08) después de validar recuperación, venta y operación de las tiendas. Conservar las imágenes en Supabase mientras las fichas dependan de esas URL.

## Fuentes y alcance de esta revisión

- [Tablero operativo](./TABLERO.md) y [registro de despliegues](./CODEX_HANDOFF.md), con la revisión anterior conservada en [el archivo del 17 de noviembre](./status-archive/2026-11-17.md).
- [CI de `4003fad`](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/45353628390) y [publicación de la API de `1dc0feb`](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/45352055962).
- Lecturas del 25 nov en el VPS y por HTTPS. Las comprobaciones de esta consolidación fueron de solo lectura; no se repitió una compra ni se verificaron pantallas con sesión.

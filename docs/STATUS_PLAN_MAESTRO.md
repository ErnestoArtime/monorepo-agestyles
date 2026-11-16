# Estado de ejecución del plan maestro AgeStyles 2.0

**Corte de auditoría:** 16 de noviembre de 2026

**Documento rector:** [AGESTYLES_2_0_PLAN_MAESTRO.md](./AGESTYLES_2_0_PLAN_MAESTRO.md)

**Regla de protección:** AgeStyles actual y Supabase siguen siendo el sistema operativo. El laboratorio Mercur no es producción.

Este documento separa evidencia actual de trabajo pendiente. Una fase no se considera terminada porque exista código o una prueba aislada: deben cumplirse todos sus criterios de salida.

## Estado por fase

| Fase | Estado | Evidencia actual | Criterio pendiente para cerrarla |
|---|---|---|---|
| F0 Auditoría y protección | En curso | Supabase activo; 80 migraciones remotas aplicadas; el checkout `Agestyles-Catalogo` está en `develop` y contiene la migración 81 pendiente. Hay 33 productos, 7 pedidos, 8 líneas, 14 perfiles, 31 imágenes, 48 movimientos, 0 comercios y 0 tiendas. El VPS tiene 6 CPU, 11 GiB RAM y 193 GiB de disco, con 6.1 GiB libres (97% ocupado) y 2 GiB de swap prácticamente agotados. | Backup verificable de PostgreSQL, Storage y Auth, manifiesto/checksum y restauración en destino aislado; revisar el VPS y despliegues sin cambios de producción. La capacidad de disco debe tener margen antes de respaldar, construir o importar. |
| F1 Spike Mercur | Parcial | Mercur 2.4.1 / Medusa 2.22.3, PostgreSQL 17 y Redis 7 aislados. Hay pruebas documentadas de carrito mixto, privacidad entre vendedores y roles owner/inventory/viewer con revocación. | Ejecutar y conservar evidencia reproducible de 2 organizaciones × 2 tiendas, identidad dual, publicación, oferta común y roles sobre tiendas ajenas. Documentar brechas/decisión seguir-no seguir. |
| F2 Monorepo reproducible | Parcial | pnpm 10.34.9, Nx 24.0.6, Node 24 fijados; Nx detecta `commerce-api`, `buyer-app`, `api-client` y el nuevo `domain`; CI ejecuta typecheck. La proyección compartida del grupo de compra ya vive en `@agestyles/domain`. | `storefront-web`, `business-app` y paquetes compartidos restantes del plan; formato/lint/tests/build en CI; verificar instalación congelada y arranque/build de cada app sin presión de disco. |
| F3 Catálogo y marketplace web | Parcial | Catálogo comprador Expo exportado y publicado en <https://tienda.eav-labs.com>; API del laboratorio y gateway por HTTPS. | Storefront Next.js con SEO, rutas canónicas/redirecciones, filtros, ofertas por tienda, datos de staging y prueba de privacidad de catálogo. |
| F4 App comprador | Parcial | Expo SDK 54; carrito mixto y pedidos agrupados probados en laboratorio; APK de laboratorio publicada; beta web disponible. | Recorrido en Android físico contra el mismo laboratorio y evidencia de instalación/checkout; preparar iOS en macOS/Xcode; extraer features y UI nativa a paquetes compartidos. |
| F5 App negocio | No iniciada | Las pruebas del API cubren roles del laboratorio, no hay aplicación `business-app`. | App negocio con selector de tiendas, permisos efectivos, gestión de inventario/pedidos y modo Comprar compartido, validado con la misma persona y sesión separada por actor. |
| F6 ETL Supabase → PostgreSQL propio | No iniciada | El sistema fuente continúa intacto; los recuentos actuales están registrados arriba. | Backup restaurado, mapping, dry-run idempotente, migración de medios/Auth e informe de conciliación. No ejecutar sobre producción. |
| F7 QA y piloto | Parcial | Pruebas de scripts documentadas para carrito multivendedor y permisos; web beta responde y el API está healthy. | Suites completas de contratos/E2E/BOLA, Android e iOS, carga, accesibilidad, backup/restore, rollback, observabilidad y piloto firmado. |
| F8 Producción/cutover | No iniciada | No se cambió el dominio principal ni se migraron datos; la beta está identificada como prueba. | Go/no-go, un solo escritor, freeze/delta, backup final, reconciliación, rollback y periodo de archivo legacy. |
| F9 Evolución posterior | No iniciada | No hay AI Studio en el producto. | Abordar solo después de piloto: IA con aprobación humana, límites y medición de costes. |

## Verificación de infraestructura en este corte

- Contenedores `agestyles-buyer-api`, `agestyles-buyer-gateway` y `agestyles-buyer-web` están en ejecución; API y web informan healthy.
- PostgreSQL y Redis del laboratorio están en ejecución y healthy. Sus puertos están enlazados a loopback.
- La web pública responde HTTPS; no equivale a aprobación para vender ni a un corte de producción.
- El VPS aloja otros servicios además de AgeStyles. No borrar imágenes, volúmenes ni contenedores para recuperar espacio sin identificar propietario, uso y política de retención.
- Evitar nuevos builds, exportaciones grandes y backups locales hasta liberar espacio de forma revisada o usar almacenamiento cifrado externo con capacidad suficiente.

## Registro de Supabase (solo lectura)

En el corte de auditoría, Supabase `Agestyles-Catalogo` informa 80 migraciones aplicadas hasta `20261116061921_merchant_order_line_fulfillment.sql`. El checkout de `Agestyles-Catalogo` está en `develop`, HEAD `cc0a810`, tiene 81 archivos SQL y contiene `20261116120000_merchant_product_media.sql`, que no aparece en las migraciones aplicadas. Debe revisarse su intención y estado antes de aplicar; esta auditoría no la ejecutó.

Los conteos confirmados con consultas `COUNT(*)` fueron: productos 33; pedidos 7; líneas 8; perfiles 14; imágenes 31; movimientos de inventario 48; comercios, tiendas y membresías 0. No se copiaron filas personales ni credenciales a este repositorio.

El checkout fuente presenta cambios sin seguimiento en `.codex/`, `scripts/__pycache__/` y `src/app/api/admin/product-ai/`. Se dejó intacto.

## Próximas puertas de trabajo

1. Preservar el commit local pendiente de publicación de este monorepo y no incluir `references` ni archivos de entorno.
2. Completar ADR de aislamiento y comprobar recursos, backups y restore antes de crear más carga en VPS.
3. Aumentar cobertura de F1 para dos organizaciones/cuatro tiendas y cerrar decisión Mercur.
4. Completar F2 con `storefront-web`, `business-app`, paquetes compartidos y CI, empezando por builds locales controlados tras recuperar espacio.
5. No migrar ni modificar el sistema fuente hasta que el backup aislado sea restaurable y la fase F6 pase conciliación.

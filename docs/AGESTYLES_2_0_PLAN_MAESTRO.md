# AgeStyles 2.0 — Plan maestro técnico y de migración

**Fecha:** 16 de noviembre de 2026  
**Estado:** Propuesta arquitectónica y plan de ejecución; no equivale a despliegue o migración realizados  
**Fuente actual:** repositorio privado `ErnestoArtime/Agestyles-Catalogo`, rama `develop`  
**Criterio de protección:** AgeStyles actual y Supabase permanecen operativos e intactos durante la prueba de concepto.

## 0. Resumen ejecutivo y decisión

Crear una nueva plataforma AgeStyles en un **monorepo Nx/TypeScript**, compuesta por:

- `commerce-api`: **Medusa v2 con Mercur** (motor de marketplace multivendedor; no utilizar Medusa aislado si exige volver a programar vendedores, divisiones de pedidos, etc.).
- `storefront-web`: **Next.js + React**, SEO y catálogo público; tomar como referencias el storefront de Mercur y componentes reutilizables de AgeStyles.
- `buyer-app`: **Expo + React Native**, Android/iOS/web, comprador general.
- `business-app`: **Expo + React Native**, Android/iOS/web; administración por rol y **modo Comprar integrado**, reutilizando los módulos de compra de `buyer-app` mediante bibliotecas compartidas (nunca importando pantallas directamente entre aplicaciones).
- `vendor-web`: panel React de Mercur extendido, para operación avanzada en navegador y móvil/PWA según pruebas de adaptación.
- `admin-web`: panel global de Mercur extendido, no una tercera app móvil en el MVP.
- `ai-worker` (posterior): servicio de edición/generación de textos e imágenes, asíncrono y con revisión humana.
- **PostgreSQL propio** como fuente de verdad de comercio; **Redis** para trabajos, caché y eventos; almacenamiento de objetos S3-compatible para medios.

**Decisiones que se prueban antes de cerrar la arquitectura:** (A) organizaciones con varias tiendas y permisos separados, (B) identidad única comprador/vendedor con sesiones separadas por actor, (C) flujo cotización → aceptación → pedido, (D) catálogo maestro + ofertas y variantes por tienda, (E) producto mixto de dos tiendas en un carrito, (F) compatibilidad SDK/versiones de Nx/Expo/Next/Mercur.

**No se modifica AgeStyles ni la base de Supabase antes de aprobar esas puertas.**

## 1. Estado del que partimos (verificado, no presunto)

### Código existente

`develop` contiene Next.js 15/React, TypeScript, Supabase, catálogo, fichas, buscador, comparación, variantes, familias/atributos, CSV, pedidos, cotizaciones, pagos, inventario, ventas, imágenes, panel `/mi-negocio`, roles y pruebas de regresión. Las pantallas `ProductCard`, `ProductSpecifications`, `CatalogComparisonTray`, `ImageCropper`, `CustomerOrderLineTracking`, `CommercialVariantEditor`, `StoreCard` y sus tests son referencias relevantes. `DESIGN.md` determina identidad Modern Luxury (blanco/grafito + acento azul noche).

Reutilizar **conceptos, contratos, reglas y pruebas**; no copiar indiscriminadamente servicios Supabase, RLS ni APIs Next del sistema anterior dentro de Mercur. El archivo `BACKEND_SUPABASE_MIGRATION.md` describe una etapa Django histórica: no lo considerar fuente del backend vigente.

### Datos reales (consulta de solo lectura en Supabase el 16/11/2026)

| Objeto | Cantidad |
|---|---:|
| Productos | 33 |
| Pedidos | 7 |
| Líneas de pedido | 8 |
| Perfiles | 14 |
| Imágenes de producto registradas | 31 |
| Movimientos de inventario | 48 |
| Negocios (`merchants`) | 0 |
| Tiendas (`stores`) | 0 |

El repositorio contiene 81 archivos SQL de migración; el plan del proyecto documenta 80 aplicadas remotamente y una migración de medios `20261116120000_merchant_product_media.sql` pendiente en el corte consultado. **Reconfirmar estado de migraciones, respaldos y VPS en la fase 0**, porque el código y los despliegues siguen evolucionando.

### VPS

El plan previo de AgeStyles registró en una ocasión menos de 1 GiB libre en el VPS. **No es una medición actual**. La primera operación debe ser auditar `df -h`, memoria, CPU, Docker, puertos, proxy, certificados, procesos y respaldo. No instalar una segunda plataforma completa en producción sin capacidad comprobada. Una referencia de dimensionamiento para laboratorio serio es **4 vCPU, 8 GiB RAM y almacenamiento SSD con margen suficiente**, sujeto a mediciones; si la máquina no alcanza, aislar staging en otro servidor o hacer la PoC local antes de tocar producción.

## 2. Dominio multitienda: modelo canónico

**Plataforma** → **Organización/negocio propietario** → **Tienda pública (`seller`)** → **Ubicaciones de stock / sucursales**.

- **Organización** (`organization`): entidad AgeStyles que agrupa varias tiendas y sus propietarios. Módulo/tabla personalizada, no asumir que ya existe exactamente así en Mercur.
- **Tienda** (`seller` de Mercur): una unidad pública con slug, marca, escaparate, catálogo/ofertas, precios, envíos, estado, miembros y pedidos propios. Un dueño puede gestionar varias tiendas mediante asociaciones de miembro; implementar agrupación por organización si necesita visión consolidada.
- **Ubicación** (`stock_location`): almacén o sucursal física, **no confundir con una tienda pública**. Puede haber varias ubicaciones por vendedor.
- **Producto maestro**: descripción global, categoría, características y variantes base cuando aplique.
- **Oferta por tienda**: SKU de vendedor, precio, disponibilidad, condiciones, moneda, estado y ubicación/inventario. Dos tiendas pueden vender el mismo producto maestro con precio y stock diferentes.
- **Publicación**: borrador → envío a revisión → aprobado/rechazado → publicado; trazabilidad de quién decide.
- **Pedidos mixtos**: el comprador realiza una acción unificada; el backend guarda grupo padre y órdenes/fulfillment por vendedor, preservando información aislada.
- **Roles**: plataforma global; organización owner; tienda owner/manager/catalog_editor/inventory/operator/viewer (cerrar matriz concreta al validar Mercur). Ningún cliente puede autorizarse por un `store_id` recibido sin verificar membresía en servidor.

**Prueba obligatoria:** dos organizaciones, dos tiendas por cada una, miembros compartidos y miembros restringidos. El usuario A administra A1/A2, no accede a B1/B2; comprador puede comprar A1+B1 sin que vendedores vean datos internos del otro.

## 3. Dos apps móviles con módulos compartidos

### App A — `buyer-app`

Tabs sugeridas: Inicio, Categorías/Buscar, Favoritos, Carrito, Cuenta. Flujos: listado y filtros, ficha con atributos/variantes, comparador, tienda pública, carrito multivendedor, cotización/checkout (según regla AgeStyles), pedidos y seguimiento, notificaciones, perfil y preferencias.

Base: ejemplo oficial `medusajs/examples/react-native-expo` (lógica de Medusa v2 y navegación) + selección puntual de UI MIT de `JamesUgbanu/Ecommerce-mobile-template`. Adaptar al cliente Mercur y al diseño Modern Luxury. Evitar copiar dependencias `preview` y mezclar versiones diferentes de React Native sin un lockfile comprobado.

### App B — `business-app`

Tabs en modo negocio: Resumen, Productos, Pedidos, Inventario, Más. Componentes: selector de organización/tienda, miembros y permisos, publicación de productos, variantes, fotos, seguimiento por línea, notificaciones, reportes. Inspiración adicional para ventas físicas: `Agilo/medusa-pos-starter` (MIT, Medusa v2, Expo 54); no usar su Admin API directamente con token global en manos de vendedores; conectar a endpoints vendor-scoped.

**Modo comprador en la propia app B**: un botón `Comprar` lleva a un árbol de rutas de compra que importa `@agestyles/features/buyer-*` y `@agestyles/ui-native`; la sesión de persona permanece, pero el contexto de autorización del comprador se resuelve de manera independiente del contexto de vendedor. Botón `Mi negocio` regresa a la tienda gestionada. El cambio de modo no debe otorgar privilegios ni reutilizar un token de vendedor en una Store API pública por accidente. Debe funcionar también cuando una persona es cliente y gestiona 2 tiendas.

**Restricción de diseño:** existen **solo dos aplicaciones móviles**; administración global web. Ambos frontends Expo pueden producir su propia web/PWA, pero el marketplace indexable permanece en Next.js por SEO.

## 4. Estructura propuesta del repositorio

```text
agestyles-platform/
├── apps/
│   ├── commerce-api/              # Medusa v2 + Mercur + extensiones AgeStyles
│   ├── storefront-web/            # Next.js, catálogo SEO
│   ├── buyer-app/                 # Expo/React Native: Android/iOS/web
│   ├── business-app/              # Expo/React Native: gestión + modo comprador
│   ├── vendor-web/                # Extensiones al panel Mercur
│   ├── admin-web/                 # Extensiones al panel Mercur admin
│   └── ai-worker/                 # Fase posterior
├── packages/
│   ├── api-client/                # SDK generado / adaptadores Store+Vendor+Admin
│   ├── icons/                     # Biblioteca única Lucide, resuelta para web y React Native
│   ├── domain/                    # DTOs, reglas y tipos neutrales a la plataforma
│   ├── auth/                      # identidad, sesión, actor y permisos
│   ├── config/                    # flags/entorno, sin secretos en cliente
│   ├── design-tokens/             # Modern Luxury, tokens multiplataforma
│   ├── ui-native/                 # controles accesibles Expo
│   ├── ui-web/                    # controles React para Next/Vite
│   ├── features-buyer/            # catálogo, fichas, carrito, cuenta, pedidos
│   ├── features-business/         # tiendas, inventario, venta, pedidos
│   ├── features-ai-studio/        # API y componentes futuros
│   ├── validation/                # esquemas Zod compartidos
│   ├── commerce-rules/            # precio/currency, estados, mappers puros
│   └── testing/                   # factories, mocks, contratos
├── tools/
│   ├── migration/                 # ETL Supabase → Medusa/Mercur
│   ├── fixtures/                  # escenario A1,A2,B1,B2 y comprador
│   └── scripts/
├── infra/
│   ├── compose/                   # Postgres, Redis, API, workers, web, storage
│   ├── reverse-proxy/
│   ├── backups/
│   └── monitoring/
├── docs/
│   ├── architecture/
│   ├── adr/                        # decisiones técnicas versionadas
│   ├── migration/
│   ├── product/
│   └── runbooks/
├── nx.json
├── pnpm-workspace.yaml
└── package.json
```

**Límite de reutilización:** `apps/*` no importa de otras `apps/*`, solo de `packages/*`; `features-buyer` y `ui-native` viven fuera de ambas apps. Los componentes HTML/DOM de Next.js no se asumen compatibles con React Native; compartir lógica/DTO/schemas y construir o adaptar interfaces nativas cuando corresponda.

**Integración de Mercur:** generar un proyecto Mercur oficial para inspeccionar la versión vigente y después integrar *su aplicación propia* en `commerce-api` usando Mercur como dependencia y extensiones, sin copiar todo el monorepo upstream de Mercur. Si la combinación Nx/paquetes genera conflictos, el plan B aceptable es mantener `commerce-api` en un repositorio independiente y monorepo Nx para clientes, conectados con SDK versionado. Lo importante es no forzar una arquitectura inviable solo por exigir un único lockfile.

**Versiones iniciales:** probar Expo SDK 54 o 55 (compatibles con `@nx/expo` según documentación consultada), porque los starters oficiales de Medusa y POS revisados se basan en 54. Nx `@nx/next` soporta Next 15 y 16. No elevar los starters a Expo 56/58 sin confirmar que Nx y las dependencias nativas lo soportan. Fijar Node LTS compatible, pnpm y lockfile; Mercur usa Bun recomendado en su upstream, por lo que validar el arranque antes de normalizar gestores de paquetes.

## 5. Servicios y límites de responsabilidad

| Servicio | Responsabilidad | Fuente de verdad |
|---|---|---|
| Medusa/Mercur API | Productos, vendedores, ofertas, carrito, órdenes, stock, comisiones | PostgreSQL comercial propio |
| Módulos AgeStyles sobre Mercur | Organización, catálogo PIM especial, quote-first, moderación, datos locales | Tablas/extensiones propias, enlazadas a dominio Mercur |
| Proveedor de identidad | Inicio de sesión persona, vinculaciones buyer/vendor/admin, sesiones | Servicio de identidad elegido (único) |
| Redis/workers | Cargas asíncronas, eventos, caché, reintentos | No es verdad durable comercial |
| Object Storage | Fotos originales, derivadas, imágenes AI, comprobantes privados | Objetos + metadatos en BD |
| Next.js storefront | SEO, SSR, contenido público y front web | Cliente API, no SQL directo |
| Expo apps | Experiencia móvil y caché de lectura | Cliente API, nunca reglas comerciales críticas |
| AI Studio | Transformaciones con proveedor intercambiable | Metadatos de trabajos en BD + archivos en Storage |

**Seguridad:** separar Store API, Vendor API y Admin API; secretos siempre en servidor; cookies/sesiones móviles seguras; rate limiting; autorizaciones por actor y recurso; logs sin datos personales sensibles; pruebas de acceso cruzado. Evitar montar APIs de administración con permisos globales en una app móvil de vendedor.

## 6. Identidad y cambio comprador ↔ negocio

Objetivo funcional: **una persona, un login, varios roles, múltiples tiendas autorizadas**. Medusa/Mercur tiene actores `customer`, `seller` y `user/admin`; no asumir que un JWT de vendedor sustituye a uno de cliente. Implementar una estrategia de identidad unificada:

1. **Prueba de concepto:** comprobar si el proveedor de autenticación Medusa/Mercur permite vincular login de una persona con customer y seller actor preservando seguridad, y cómo se actualizan/refrescan sesiones de cada actor.
2. **Opción A preferida si se valida:** proveedor Medusa/Mercur único, con entidad `person_identity`/vinculaciones de actores y app B con modo comprador.
3. **Opción B si hay obstáculos:** IdP OIDC self-hosted (p. ej. Authentik/Keycloak) y proveedor de autenticación Medusa personalizado; no crear un segundo sistema de contraseñas artesanal.
4. **Migración desde Supabase Auth:** exportar identidades/relaciones con consentimiento y protección de PII. No asumir que hashes de contraseña de GoTrue funcionarán en el nuevo proveedor. Si no existe migración de hashes validada, enviar invitación/reset de contraseña en el corte; mantener IDs legacy en mapping interno.

Los permisos de comprador y vendedor se comprueban en servidor después de cada cambio de contexto. El acceso a una tienda se verifica por membresía/rol; se revoca al instante en operaciones sensibles aunque el cliente conserve un selector antiguo.

## 7. Migración Supabase → PostgreSQL propio (NO restaurar el esquema antiguo sobre Medusa)

### Estrategia por capas

**Capa 1: conservación y respaldo**
- Snapshot consistente de Supabase PostgreSQL, metadatos y objetos de Storage, exportación separada de Auth y respaldo de configuraciones sin exponer secretos.
- Comprobar restauración en una BD aislada. El backup SQL de `storage.objects` no contiene los bytes físicos de los archivos: exportar también objetos.
- Guardar dump, manifest SHA256, logs de recuentos y esquema legacy en repositorio/almacenamiento privado; no subir PII a GitHub.

**Capa 2: nuevo esquema autónomo**
- Desplegar PostgreSQL limpio; crear BD de Mercur mediante migraciones oficiales y módulos AgeStyles separados.
- No importar funciones SQL `SECURITY DEFINER`, políticas RLS, vistas o tablas `auth.*` directamente al esquema de Medusa.
- Introducir tabla interna `legacy_id_mapping(entity, old_id, new_id, imported_at, checksum)` con claves únicas y logs de reconciliación.

**Capa 3: importación ETL ordenada**
1. Diccionarios: categorías, subcategorías, marcas, unidades, familias, atributos y opciones.
2. Organizaciones/tiendas: datos reales si los hay; en este corte hay 0. Crear escenario test separado, nunca mezclar con producción.
3. Productos maestros, variantes y ofertas por seller; conservar identificadores legacy y relaciones.
4. Inventario: saldos, movimientos históricos y reservas; **no volver a contabilizar movimientos** durante importación; fijar stock final por conciliación de snapshot.
5. Medios: objetos, metadatos, hash, orden, permisos y URLs; evitar que cambien las rutas públicas sin redirecciones.
6. Clientes/perfiles e identidades; política de acceso y consentimiento.
7. Pedidos e ítems históricos, pago/estado/comprobante, tracking y devoluciones. Históricos pueden quedar en consulta legacy si Medusa no permite reconstruirlos limpiamente sin disparar eventos ni contabilidad: elegir importación controlada o archivo de solo lectura, nunca simular ventas nuevas.
8. Favoritos, comparador, borradores del carrito, preferencias si siguen teniendo valor.

**Capa 4: validación y cutover**
- Ensayo de importación completo sobre staging. Scripts idempotentes, dry-run y métricas de diferencias.
- Comprobar recuentos, totales monetarios por moneda, variantes, imágenes, stock por tienda y relaciones entre pedidos/ítems.
- Mantener AgeStyles actual como fuente única mientras se valida; congelación breve de escrituras para el corte final o CDC/replicación controlada si fuese necesaria.
- Probar login, cotización, pedido mixto y revocaciones sobre datos importados.
- Cambiar tráfico por proxy/DNS solo tras respaldo y decisión go/no-go; preservar rollback de aplicación y de BD y no permitir escrituras divergentes durante rollback.
- Dejar el entorno anterior en modo lectura/archivo hasta pasar la ventana de verificación; no borrar Supabase automáticamente.

## 8. Comportamientos de AgeStyles que NO debemos perder

| Comportamiento actual / deseado | Resolución objetivo |
|---|---|
| Catálogo general multi-categoría | Medusa Product + categorías/facetas; PIM extendido donde falte |
| Familias/atributos/unidades y nomencladores | Comparar Mercur Product Attribute con modelo actual y construir migración/módulo específico solo para brechas |
| Varios vendedores de un mismo producto | Producto maestro + ofertas seller-scoped |
| Variantes comerciales, SKU, precios y moneda | Mercur offers/Medusa pricing con política de conversión controlada |
| Publicación con revisión | Mercur product requests/workflows, verificando cada estado AgeStyles |
| Inventarios y movimientos | Mercur/Medusa Inventory, historial compatible y permisos por stock-location |
| Comprador ve todas las tiendas | Store API multivendedor + storefront web + buyer-app |
| Pedido de A1 + B1 | OrderGroup/split-order + seguimiento por línea y privacidad |
| Cotización primero, aceptación idempotente | Módulo/workflow AgeStyles si no existe equivalencia nativa; no sacrificar el contrato anterior |
| Pagos manuales y monedas múltiples | Adaptadores reales y estrategia de cumplimiento; evitar activar cobros inexistentes |
| WhatsApp, notificaciones, reportes | Suscriptores, outbox/reintentos, colas e integración configurable |
| AI Studio de descripciones/fotos | Fase posterior; originales privados, versiones, costes, límites y aprobación humana |
| Diseño Modern Luxury | Design tokens compartidos, contraste, modo claro/oscuro y 44px objetivo táctil |

## 9. Infraestructura y despliegue en VPS

Separar dev, staging y producción mediante redes, bases, volúmenes y secretos. Nunca reutilizar una base de datos de producción para tests. Topología propuesta:

```text
Internet HTTPS
   └── proxy actual (Nginx/Caddy/Traefik según auditoría)
       ├── storefront-web (Next.js)
       ├── commerce-api HTTP (Medusa + Mercur)
       ├── vendor-web (React)
       ├── admin-web (React)
       └── [PWA Expo buyer y business según distribución]

Red privada
   ├── commerce-worker (tareas de Medusa/Mercur)
   ├── PostgreSQL (no publicado a internet)
   ├── Redis (no publicado a internet)
   └── Object Storage / bucket externo compatible S3
```

La app Expo se compila/distribuye con pipelines móviles; **la compilación iOS exige macOS/Xcode**, no intentar hacerla en Linux VPS. El VPS sirve API, web, assets, notificaciones y tareas; el Mac mini puede encargarse de builds de iOS y Android.

Exigir: inventario de puertos y dominios, recursos medidos, Docker Compose versionado, certificados TLS, secretos fuera de Git, health checks, política de imágenes, logs estructurados, backups cifrados a destino externo con ensayo de restore, migraciones antes de releases, rollback probado, monitorización de disco/memoria/errores, despliegue identificado por SHA, no levantar builds pesados en VPS sin margen.

## 10. Plan por fases, tareas y criterios de salida

### F0 — Auditoría y protección de producción [P0]
**Tareas:** capturar HEAD real `develop`, docs del plan previo, migrations applied, esquema/export, backups, inventario VPS/recursos, DNS, certificados y servicio actual. Registrar ADR-001 y decisión de aislamiento de staging.
**Salida:** respaldo restaurable, mapa de datos verificado, evidencias de capacidad; cero cambios al flujo actual.

### F1 — Spike Mercur vs contratos AgeStyles [P0]
**Tareas:** generar marketplace Mercur oficial con versión fijada, PostgreSQL/Redis de staging, probar seller switch, 4 tiendas/2 organizaciones, roles, atributos, ofertas, split order, publicación, stock; estudiar puntos de extensión. Implementar una única brecha vertical (quote-first si falta) como prueba de viabilidad.
**Salida:** tabla `existe / extensión / no viable` por requisito; autenticación de buyer/seller comprobada; decisión formal seguir/no seguir.

### F2 — Monorepo Nx reproducible [P0]
**Tareas:** configurar pnpm workspaces y Nx; apps iniciales (`commerce-api`, `storefront-web`, `buyer-app`, `business-app`); paquetes compartidos; lint/format/test/typecheck/CI; generadores, ownership, versión y documentos. Incorporar Mercur como dependencia o desacoplar upstream si hay conflicto demostrado.
**Salida:** `nx graph`, instalaciones reproducibles con lockfile, app Expo Android/Web arranca, Next construye, API responde healthcheck.

### F3 — Catálogo maestro y marketplace web [P0]
**Tareas:** taxonomía, marcas, atributos, variantes, ofertas, filtros, búsqueda, tienda pública, UI Modern Luxury, permisos y pipeline de imágenes. Reusar ideas/tests AgeStyles y referencias de storefront Mercur; preservar URLs SEO críticas mediante redirecciones.
**Salida:** dos vendedores muestran ofertas distintas del mismo artículo y catálogos propios sin fugas, productos comprables en web staging.

### F4 — App comprador [P0]
**Tareas:** adaptar ejemplo oficial Expo Medusa v2, cliente Mercur, navegación, categorías, producto/variantes, carrito mixto, cotización/checkout, cuenta, pedidos, notificaciones básicas. Separar `features-buyer` y `ui-native` desde el principio.
**Salida:** recorrido completo en Android y web Expo con datos reales de staging; iOS simulador/build local cuando la plataforma esté lista.

### F5 — App negocio y modo comprador compartido [P0]
**Tareas:** permisos seller/organización, selector de tienda, productos/variantes/stock/pedidos/seguimiento, fotografías; adaptar ideas del panel Mercur y POS starter. Incluir árbol de rutas de comprador mediante bibliotecas compartidas, sin duplicarlas. Resolver vinculación de identidad buyer/seller.
**Salida:** owner de A1/A2 gestiona sus tiendas, cambia a `Comprar`, hace pedido y vuelve a `Mi negocio` sin segundo login; un viewer no edita stock; otro vendedor no lee pedidos ajenos.

### F6 — ETL desde Supabase y reconciliación [P0]
**Tareas:** export seguro, mapeos, ETL idempotente, import staging, medios, reconciliación de dinero/stock, pruebas de históricos, decisión de migración Auth; definir procedimiento de freeze/cutover y rollback.
**Salida:** informe con recuentos y hashes, 0 pérdidas no aceptadas, restitución verificada y decisión documentada sobre históricos.

### F7 — QA, seguridad y piloto [P0]
**Tareas:** suites de contratos API, e2e web/Android, aislamiento cruzado, carga bajo tráfico esperado, seguridad subida de archivos, bugs de navegación/tema, flujos de pago y reversión, restore/backups, observabilidad, dispositivo real. Piloto con 2 propietarios × 2 tiendas, 1 comprador común.
**Salida:** pruebas críticas en verde, incidencias P0 = 0, rollback demostrable, UAT firmado y go/no-go.

### F8 — Producción y desmantelamiento gradual [P0]
**Tareas:** captura final de cambios, freeze, delta, backups, conmutación, monitoreo, solución de incidencias, lectura legacy, retirada programada y justificada de servicios Supabase solo cuando nadie dependa de ellos.
**Salida:** un único escritor del comercio y nueva plataforma operativa, con datos reconciliados.

### F9 — Evolución posterior [P1/P2]
AI Studio de texto/imágenes, cámara y eliminación de fondos, POS offline donde sea viable, descuentos avanzados, reportes, search dedicado, aplicaciones para nuevos perfiles y optimización de rendimiento.

## 11. Pruebas automatizadas obligatorias

- **Roles / seguridad:** tabla actor × acción × tienda; API/BD/medios; revocación; cambio de seller arbitrario; pruebas BOLA/IDOR.
- **Catálogo/PIM:** categorías distintas (tecnología, ferretería, moda, hogar), variantes y obligatoriedad de atributos, conversión de moneda, dos ofertas para producto maestro.
- **Carrito/pedidos:** dos vendedores, un carrito, un pedido de cara al comprador, órdenes aisladas por seller, fulfillment por línea, devoluciones y rechazo/timeout duplicado (idempotencia).
- **Auth/sesión:** login de comprador, login de gestor, acceso dual, cerrar sesiones, refresh, email cambiado, cambio de negocio, eliminación de membresía.
- **Migración:** producto por producto, SKU, imágenes, estados, historial, sumas monetarias, stock, faltantes, huérfanos, reintentos, migración repetible.
- **Entrega:** build Android+iOS, PWA, SEO Next.js, accesibilidad, 320–390px, web 1440px, claro/oscuro, offline degradado.
- **Ops:** backup+restore probado en equipo distinto, rollback en staging, healthchecks, monitorización, carga y alertas.

## 12. Backlog inicial preparado para tickets

| ID | Prioridad | Tarea | Evidencia esperada |
|---|---|---|---|
| ARC-01 | P0 | Auditar recursos actuales VPS y aislamiento | Informe medido y presupuesto de recursos |
| DATA-01 | P0 | Backup completo Supabase + Storage + Auth | Restauración en BD aislada |
| ARC-02 | P0 | Generar Mercur local/staging con versiones fijas | Healthcheck + roles funcionando |
| MKT-01 | P0 | Probar organización → 2 sellers y permisos | A1/A2/B1/B2 aisladas |
| MKT-02 | P0 | Probar catálogo global/ofertas por seller | 2 precios/stock para 1 producto |
| MKT-03 | P0 | Validar cart/order-group 2 vendors | Compra mixta con privacidad |
| ARC-03 | P0 | ADR auth unificada y modo comprador | Diseño y spike con tokens actor-scoped |
| NX-01 | P0 | Preparar workspace Nx, 2 apps Expo y Next | Builds verdes + grafo |
| NX-02 | P0 | Contratos/SDK/validation/ui-native/features-buyer | Paquetes versionados y tests |
| WEB-01 | P0 | Reusar storefront y diseño AgeStyles | Recorrido público SEO |
| MOB-01 | P0 | Integrar starter oficial Expo Medusa con Mercur | Catálogo/carrito/pedido Android |
| MOB-02 | P0 | Integrar negocio y `Comprar` sin duplicar UI | Cambio en un login con roles |
| DATA-02 | P0 | Mapear migración entidad a entidad | Mapping y estrategia de históricos |
| DATA-03 | P0 | ETL completo y conciliación en staging | Informe 100% cuentas esperadas |
| QA-01 | P0 | E2E 2 propietarios × 2 tiendas + comprador | Evidencia reproducible |
| OPS-01 | P0 | Release, backup/restauración y rollback | SHA desplegado, runbook y logs |
| AI-01 | P1 | AI Studio de texto + imagen | Aprobación humana y cuota |

## 13. Primeras operaciones seguras (NO ejecutar contra producción sin revisión)

```bash
# En VPS, diagnóstico solo lectura
uname -a
node --version
bun --version || true
pnpm --version || true
docker --version || true
docker compose version || true
free -h
df -h
lsblk
ss -lntp
systemctl --type=service --state=running

# En equipo/entorno aislado, prueba de Mercur (comando oficial actual;
# fijar versión y revisar el proyecto generado antes de staging)
bun create mercur-app@latest agestyles-spike

# Nx: utilizar generadores oficiales y una matriz de versiones comprobada.
# No ejecutar 'latest' ciegamente en producción.
```

No instalar ni modificar servicios de producción hasta respaldar, comprobar espacio, planificar puertos y revisar el modelo de seguridad.

## 14. Criterios de aceptación del piloto AgeStyles 2.0

1. Hay un marketplace público con búsqueda/filtros, varias tiendas, fichas y carrito común.
2. Dos propietarios independientes administran dos tiendas cada uno sin filtrar datos cruzados.
3. Existen editor de producto, variantes, stock, fotografías y aprobación/rechazo.
4. Un comprador paga/acepta cotización de A1+B1 y sigue por línea cada envío sin ver internos de vendedores.
5. `buyer-app` instala y opera en Android y iOS; versión web/PWA validada según distribución.
6. `business-app` administra tiendas y alterna a modo comprador **reutilizando exactamente el mismo paquete de features**.
7. Contratos y pruebas de las operaciones críticas reproducibles; 0 incidencias críticas de seguridad.
8. Datos históricos de Supabase reconciliados o publicados mediante consulta de archivo con decisión explícita; ninguna pérdida silenciosa.
9. PostgreSQL propio respaldado y restaurado, Redis/objetos seguros, release y rollback probados.
10. El sitio anterior permanece recuperable y no hay dos escritores activos del mismo dominio comercial.

## 15. Fuentes y proyectos que sirven de punto de partida

- Medusa marketplace (diferencia Medusa core y Mercur): https://medusajs.com/kb/marketplaces/multi-vendor-marketplace
- Arquitectura Mercur: https://github.com/mercurjs/mercur/blob/main/docs/ARCHITECTURE.md
- Mercur storefront: https://github.com/mercurjs/mercur/tree/main/apps/storefront
- Mercur dashboard: https://github.com/mercurjs/mercur/tree/main/apps/vendor
- Medusa Expo oficial: https://github.com/medusajs/examples/tree/main/react-native-expo
- Agilo Medusa POS: https://github.com/Agilo/medusa-pos-starter
- Plantilla visual MIT Expo: https://github.com/JamesUgbanu/Ecommerce-mobile-template
- Nx Expo: https://nx.dev/docs/technologies/react/expo/introduction
- Nx Next.js: https://nx.dev/docs/technologies/react/next/introduction
- Expo monorepos: https://docs.expo.dev/guides/monorepos/
- Deploy Medusa: https://docs.medusajs.com/learn/deployment/general
- Supabase migraciones: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- Supabase Auth entre proyectos (no asumir interoperabilidad con Medusa): https://supabase.com/kb/troubleshooting/migrating-auth-users-between-projects

---

**Corte de ejecución — 17 de noviembre de 2026:** el monorepo Nx/pnpm está instalado y contiene `commerce-api`, buyer/business Expo, storefront Next y extensiones AgeStyles para permisos, PIM, pagos manuales y cotizaciones. El laboratorio aislado PostgreSQL/Redis y las betas compradora, catálogo y negocio están desplegados. Se han comprobado por API el carrito de dos vendedores, sesiones de buyer/member separadas, permisos por tienda y varias reglas de publicación. Esto no constituye migración ni corte de producción.

El estado verificable por fase y los diez criterios del piloto se mantiene en [STATUS_PLAN_MAESTRO.md](./STATUS_PLAN_MAESTRO.md) y [PLAN_COMPLETION_AUDIT.md](./PLAN_COMPLETION_AUDIT.md). F0/F6 siguen condicionadas a un destino cifrado suficiente y una restauración aislada; F4/F5/F7 requieren pruebas reales en Android y macOS/iOS; F8 requiere los gates completos y un go/no-go explícito. La fuente Supabase continúa intacta y AgeStyles aún no tiene un ETL/cutover aprobado.

Actualización del 17 de noviembre de 2026, 10:03 UTC: el código del monorepo está sincronizado con `origin/main` en `1cc09b0`; CI pasó para ese commit. Esto no significa que el workflow de publicación de imágenes se haya ejecutado ni que la versión más reciente esté desplegada en las webs. La carpeta `references/` permanece excluida del repositorio.


**Revalidación — 17 de noviembre de 2026, 10:19 UTC:** `main` está sincronizada hasta `1bb366a`, cuyo CI finalizó success. El resolver de permisos seller tiene tests sintéticos por rol, pero F1/F5/F7 conservan pendientes de BOLA runtime, UI y UAT. El host tiene 3.2 GiB libres y no enumera Android; no iniciar builds/descargas. El plan sigue en ejecución y no se autoriza cutover.


**Revalidación — 17 de noviembre de 2026, 10:37 UTC:** el commit `ec0bd17` corrigió el puerto del runbook/healthcheck a `19081` y añadió test de consistencia. CI terminó success ([run 44066099747](https://github.com/ErnestoArtime/monorepo-agestyles/actions/runs/44066099747)). La imagen aún no se publica ni despliega; F4 no cierra hasta que tracking responda desde el runtime y pase el ownership test con fixture limpio.

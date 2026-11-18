# Storefront web en el VPS

La tienda indexable de AgeStyles se publica en [catalogo.eav-labs.com](https://catalogo.eav-labs.com). Es una aplicación Next.js separada de la beta Expo de compradores en [tienda.eav-labs.com](https://tienda.eav-labs.com) y de la tienda anterior en [agestyles.eav-labs.com](https://agestyles.eav-labs.com).

El contenedor Next escucha solo en 127.0.0.1:18084. El túnel Cloudflare compartido reenvía el subdominio al origen local. PostgreSQL y Redis no se publican; Next consulta el Store API del laboratorio mediante @agestyles/api-client.

## Configuración privada

En la raíz del monorepo del VPS, configura .env.storefront-web con permisos 600:

    MEDUSA_BACKEND_URL=https://descargas.eav-labs.com/agestyles-lab
    MEDUSA_PUBLISHABLE_API_KEY=CLAVE_PUBLICABLE_DEL_LABORATORIO
    BUYER_APP_URL=https://tienda.eav-labs.com
    SITE_URL=https://catalogo.eav-labs.com

`MEDUSA_BACKEND_URL` debe ser la URL **pública** del gateway de compradores (`https://agestyles-api.eav-labs.com`), porque desde AG-30 el navegador crea y actualiza el carrito contra ella. La clave publicable es pública por diseño (también viaja en las apps móviles) y llega al navegador por las propiedades que el servidor pasa al carrito; el gateway debe permitir el origen `https://catalogo.eav-labs.com`. No se usa una clave Vendor/Admin ni acceso directo a SQL.

## Compilar, publicar y verificar

Desde la raíz del monorepo:

    corepack pnpm install --frozen-lockfile
    corepack pnpm --filter @agestyles/storefront-web build
    docker compose -f infra/compose/storefront-web.yaml up -d --build storefront-web
    curl -fsS http://127.0.0.1:18084/healthz

La imagen de producción copia la salida standalone ya construida. El API sigue siendo el entorno aislado de prueba: el catálogo y los precios no son una tienda de producción. El checkout continúa en la app compradora de beta hasta completar sus puertas de migración y QA.

## Comportamiento implementado

- Catálogo HTML renderizado en servidor, título, descripción, Open Graph y canonical.
- robots.txt permite indexar la beta y anuncia el sitemap.
- sitemap.xml consulta el Store API al solicitarse e incluye la portada y las fichas publicadas.
- Búsqueda del Store API, filtros de categoría y orden por nombre/precio.
- Fichas por handle que comparan vendedores, variantes y menor precio de las ofertas disponibles en la región.
- Cabecera y pie únicos para todas las páginas (`layout.tsx`): «Catálogos» con las categorías, Novedades, Tiendas, búsqueda y carrito.
- Tarjetas sin opciones de comparar: imagen, categoría, nombre, precio y «Agregar». Un clic abre la **vista rápida** (fotos, tienda, variante, cantidad, «Agregar al carrito» y «Ver ficha completa»); los datos llegan de `GET /api/quick-view/<handle>`.
- La ficha vende igual que la vista rápida y añade descripción, características y las tiendas con sus precios. Comparar tiendas y comparar producto viven ahí.
- El carrito es un carrito de Medusa guardado en el navegador (`agestyles.catalog.cart_id`). «Ir a pagar» abre `BUYER_APP_URL/?cart=<id>`: Tienda adopta ese carrito y abre el Carrito. El envío, el pago y la cuenta siguen en Tienda; no hay checkout en el Catálogo.

La beta se distingue como prueba en la interfaz y en sus precios. Antes de anunciar ventas, se debe cambiar a una API de staging/producción y actualizar el destino de compra.

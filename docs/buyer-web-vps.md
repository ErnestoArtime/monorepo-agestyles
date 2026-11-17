# Web compradora en el VPS

La web pública de clientes es la misma app Expo de `apps/buyer-app`, exportada como sitio estático. Conserva catálogo, carrito, cuenta, checkout e historial. La beta pública muestra un aviso de que los productos y pedidos son de prueba. Por ahora el enlace de Android dirige al APK de laboratorio publicado en descargas. Los iconos vienen de `@agestyles/icons` y se exportan como SVG; no dependen de fuentes externas.

La beta está publicada en [https://tienda.eav-labs.com](https://tienda.eav-labs.com). El servicio web, el API y el gateway se ejecutan con reinicio automático en el VPS; sus puertos de origen solo escuchan en loopback.

## Preparación del VPS

El contenedor Nginx publica la exportación en `127.0.0.1:18083`. El gateway buyer escucha en `127.0.0.1:19182` y reenvía al API vigente del laboratorio en `127.0.0.1:19081`; el proceso antiguo en `19080` no es destino de las betas actuales. La lista del gateway solo admite Store API, customer auth, carrito, pagos/grupos de pedido y cotizaciones; CORS acepta únicamente `https://tienda.eav-labs.com`. El túnel compartido llega a estos orígenes locales sin abrir sus puertos a Internet. Nginx resuelve rutas internas de Expo con `index.html` y sirve los recursos con caché.

En la raíz del repositorio del VPS, crea el archivo privado `.env.buyer-web`:

```dotenv
BUYER_WEB_MEDUSA_URL=https://descargas.eav-labs.com/agestyles-lab
BUYER_WEB_MEDUSA_PUBLISHABLE_API_KEY=CLAVE_PUBLICABLE_DEL_LABORATORIO
BUYER_WEB_ANDROID_APK_URL=https://descargas.eav-labs.com/releases/AgeStyles-Prueba-1.0.0-arm64-v8a.apk
```

La URL de APK apunta a la versión de prueba existente. Antes de distribuir una versión comercial, cambia esta variable por la APK final firmada. Las variables de la web se incorporan al bundle durante la compilación; cambiar el archivo después requiere reconstruir el contenedor.

```sh
chmod 600 .env.buyer-web
docker compose --env-file .env.buyer-web -f infra/compose/buyer-web.yaml up -d --build
curl -fsS http://127.0.0.1:18083/healthz
```

Para actualizar la beta desde el monorepo, genera primero el sitio estático con la configuración de `.env.buyer-web` y despliega la imagen Nginx ya exportada:

```sh
corepack pnpm lab:web:build:public
docker compose -f infra/compose/buyer-web.yaml up -d --build buyer-web
curl -fsS http://127.0.0.1:18083/healthz
```

La imagen Nginx contiene solo la exportación terminada; las dependencias de Expo no se instalan ni compilan dentro de Docker. La página servida localmente debe responder en `http://127.0.0.1:18083/`. La API y el gateway usan los datos del laboratorio de PostgreSQL/Redis, así que esta web es una beta pública de prueba.

## Antes de abrirla a clientes

El gateway permite y reenvía las cabeceras Store API `x-publishable-api-key`, `authorization`, `x-medusa-locale` e `idempotency-key`. La lista pública incluye regiones, productos, categorías, vendedores, ofertas, carrito, cotizaciones, grupos de pedidos, y seguimiento autenticado por ID de pedido. La respuesta al preflight CORS admite estas cabeceras para el origen `https://tienda.eav-labs.com`. No expone Vendor API ni Admin API.

El laboratorio actual utiliza datos de prueba y no debe presentarse como tienda de producción. Antes de anunciar ventas, hay que migrar a una API de producción y sustituir el APK de laboratorio. El túnel y DNS para la beta pública se documentan por separado del entorno comercial.

El dominio usa un CNAME proxied hacia el túnel Cloudflare compartido y una ruta específica al origen local `127.0.0.1:18083`. Se guardó una copia privada de la configuración anterior antes de añadir la ruta. El APK de laboratorio existente se conserva sin cambios.

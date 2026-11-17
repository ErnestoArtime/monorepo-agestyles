# Portal web para vendedores en el VPS

La aplicación Expo `apps/business-app` también se exporta como web estática. La beta de vendedores se publica separada de la web compradora en `https://negocio.eav-labs.com`; usa autenticación de miembros y permisos verificados por Mercur para cada tienda.

## API limitada para el portal

La web llama a `https://descargas.eav-labs.com/agestyles-seller`. El gateway de `tools/scripts/seller-lab-gateway.mjs` admite una lista cerrada de operaciones: autenticación de miembros, selección de tiendas, lectura/envío de cambios de producto a revisión, pedidos, inventario, ajustes de stock y gestión de miembros; además, el modo Comprar usa autenticación customer, regiones, productos/ofertas, carrito y cotizaciones. No reenvía rutas de Admin API ni endpoints que no estén en su lista. Limita peticiones por IP y los intentos de inicio de sesión member/customer. El navegador solo recibe CORS desde `https://negocio.eav-labs.com`; clientes nativos sin cabecera `Origin` siguen usando la autenticación y los permisos del servidor.

La clave publicable de Medusa se incorpora al bundle web y no es un secreto. No se debe incluir una Admin API key. Los tokens de miembro se guardan mediante el almacenamiento del SDK en el navegador; publicar esta beta requiere mantener HTTPS, limitar los permisos en el servidor y usar cuentas de prueba.

## Preparar y servir

El archivo privado `apps/business-app/.env.local` debe contener la clave publicable del laboratorio. El script de exportación sustituye la URL de API por la ruta pública del gateway, sin modificar el archivo local:

```sh
corepack pnpm seller:web:build
docker compose -f infra/compose/seller-web.yaml up -d --build
curl -fsS http://127.0.0.1:18085/healthz
curl -fsS http://127.0.0.1:19183/healthz
```

Nginx sirve los archivos estáticos en `127.0.0.1:18085`. El gateway escucha en `127.0.0.1:19183` y reenvía solamente rutas permitidas al API actual del laboratorio en `127.0.0.1:19081`. El proceso previo que escucha en `19080` no se utiliza.

## Túnel y DNS

El túnel compartido conserva todas las rutas actuales y añade:

- `negocio.eav-labs.com` → `http://127.0.0.1:18085`.
- `descargas.eav-labs.com/agestyles-seller/` → `http://127.0.0.1:19183`.

El DNS de `negocio.eav-labs.com` debe ser un CNAME proxied a `<tunnel-id>.cfargotunnel.com`. Antes de modificar Cloudflare, guarda un snapshot privado de la configuración remota completa y de los registros DNS; no alteres rutas ajenas ni el catch-all.

## Verificación pública

Comprueba HTTPS en la portada, el preflight CORS para inicio de sesión y `x-seller-id`, el rechazo de un origen ajeno y la respuesta 401 de rutas de vendedor sin sesión. Un path de Admin API debe responder 404 desde el gateway. Completa además el inicio de sesión con un usuario sintético del laboratorio, confirma el selector de tiendas y prueba dueño, gestor de inventario y solo lectura. La publicación es una beta conectada al laboratorio; no habilita ventas reales ni representa un corte a producción.

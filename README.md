# AgeStyles 2.0

Monorepo Nx y TypeScript. `apps/commerce-api` contiene la prueba de Mercur y `apps/buyer-app` adapta el ejemplo Expo al marketplace. `packages/api-client` reúne las llamadas de catálogo, carrito y checkout para reutilizarlas en otras aplicaciones.

El cliente también contiene registro e inicio de sesión, asociación del carrito de invitado e historial de compras agrupadas por vendedor. Las compras hechas sin iniciar sesión no se vinculan automáticamente a una cuenta.

## Preparar el entorno local

Usa la versión de Node indicada en `.node-version` y Corepack para ejecutar la versión de pnpm fijada en `package.json`.

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm typecheck
```

Los comandos del laboratorio están centralizados en la raíz. `corepack pnpm lab:up` crea un entorno privado si hace falta y arranca PostgreSQL y Redis. Después ejecuta `corepack pnpm lab:migrate`, `corepack pnpm lab:seed` y `corepack pnpm lab:buyer`. Arranca la API con `corepack pnpm lab:api` y Expo con `corepack pnpm lab:app`. `corepack pnpm lab:down` detiene los contenedores. Los procesos de API y Expo se detienen con Ctrl+C en sus terminales.

`lab:web:build` genera la app web y `lab:web:serve` la publica solo en `127.0.0.1:18081`. El laboratorio completo, la compra de prueba y los permisos por tienda están descritos en [docs/mercur-lab.md](docs/mercur-lab.md).

La app compradora también se publica como sitio estático en [tienda.eav-labs.com](https://tienda.eav-labs.com). Consulta [web compradora en el VPS](docs/buyer-web-vps.md) para el contenedor, el API/gateway del laboratorio y el proceso de actualización.

## Referencias móviles

Tras clonar el monorepo, recupera las revisiones registradas en Git:

```sh
git submodule update --init
git -C references/mobile/medusa-examples sparse-checkout set react-native-expo
```

| Referencia | Expo | Uso previsto |
| --- | --- | --- |
| [Medusa React Native](https://github.com/medusajs/examples/tree/main/react-native-expo) | 54 | Catálogo, carrito y checkout de `buyer-app`. Evaluar una versión estable del SDK en lugar de la dependencia `preview` y comprobar las operaciones multivendedor con Mercur. |
| [Agilo Medusa POS](https://github.com/Agilo/medusa-pos-starter) | 54 | Flujos de escaneo y ventas para `business-app`. Adaptar las llamadas administrativas a la API de vendedor de Mercur y validar permisos por tienda. |
| [Ecommerce Mobile Template](https://github.com/JamesUgbanu/Ecommerce-mobile-template) | 56 | Referencia visual para catálogo, búsqueda y fichas. Seleccionar componentes después de fijar el SDK de Expo para las apps propias. |

Cada referencia conserva su revisión de origen y su manifiesto de dependencias. Se instala por separado si hace falta ejecutarla.

## Laboratorio Mercur

Consulta [cómo arrancar el laboratorio y repetir las comprobaciones](docs/mercur-lab.md).

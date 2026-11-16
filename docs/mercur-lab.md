# Laboratorio de Mercur

Mercur 2.4.1 y Medusa 2.22.3 usan un PostgreSQL 17 y un Redis 7 exclusivos del laboratorio. La API, la web y los puertos de Docker se enlazan a la interfaz local. La tienda de prueba usa datos ficticios y el método de pago manual de Medusa.

## Arranque

Desde la raíz, con Node 24, Corepack y Docker Compose:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm lab:up
corepack pnpm lab:migrate
corepack pnpm lab:seed
corepack pnpm lab:buyer
corepack pnpm lab:api
```

La API responde en `http://127.0.0.1:19080/health`. En otra terminal, arranca Expo con `corepack pnpm lab:app`. Para la versión web, usa `corepack pnpm lab:web:build` y `corepack pnpm lab:web:serve` en terminales separadas; queda disponible en `http://127.0.0.1:18081/`.

Las comprobaciones manuales existentes siguen en `apps/buyer-app/scripts` y `apps/commerce-api/scripts`; se ejecutan solo cuando se quiera crear datos de prueba.

En el VPS puedes abrir la web desde tu equipo con reenvío SSH de los puertos 18081 y 19080. Usa `http://127.0.0.1:18081/` en el navegador. El catálogo demo tiene una región EUR. Selecciona dos productos, elige una oferta de un vendedor distinto en cada ficha, usa una dirección ficticia de España y selecciona un envío por tienda y pago manual.

## Verificación de carrito y permisos

```sh
node --env-file=apps/buyer-app/.env.local apps/buyer-app/scripts/verify-marketplace.mts
```

La comprobación usa el mismo cliente Store API que Expo. Crea un comprador de prueba e inicia sesión con cada vendedor por separado. Exige dos productos de dos vendedores en el mismo carrito, un envío por tienda y un grupo con dos pedidos. Comprueba que cada vendedor obtiene su pedido (200), que consultar o cancelar un pedido ajeno devuelve 404, que usar el identificador de la tienda ajena devuelve 403 y que usar una sesión de comprador en la API de vendedor devuelve 401.

Se completó el recorrido en Chromium con un producto de Sole Society y otro de Kickz Corner. La pantalla de confirmación mostró un grupo con dos pedidos.

## Permisos dentro de una tienda

Mercur 2.4.1 delega la autorización por rol a un módulo de permisos. El laboratorio registra un módulo que consulta la membresía vigente para cada solicitud. Usa el rol de soporte de Mercur para representar al perfil de solo lectura, ya que las invitaciones aceptan una lista fija de roles.

```sh
node --env-file=apps/buyer-app/.env.local apps/commerce-api/scripts/verify-seller-roles.mjs
```

Resultados comprobados con tres cuentas de Sole Society:

| Operación | Dueño | Gestor de inventario | Solo lectura |
| --- | --- | --- | --- |
| Consultar inventario | Sí | Sí | Sí |
| Cambiar existencias | Sí | Sí | 403 |
| Eliminar un artículo de inventario | Sí | 403 | 403 |
| Listar pedidos y ofertas | Sí | 403 | Sí |
| Listar miembros | Sí | 403 | 403 |
| Administrar accesos del equipo | Sí | 403 | 403 |

La prueba verificó el saldo tras cada intento y rechazó el identificador de una tienda ajena. Los cambios de rol y la revocación surtieron efecto con la sesión ya abierta. Las cuentas de personal y el artículo de la prueba son desechables. El script retira sus accesos a la tienda y elimina el artículo.

Verificado de nuevo el 16/11/2026: el gestor pudo actualizar existencias, pero no listar pedidos/ofertas/miembros, borrar artículos ni cambiar roles; el perfil de solo lectura no pudo actualizar ni borrar. Tras cambiarlo a solo lectura y después revocar la membresía, las restricciones se aplicaron usando la sesión ya abierta.

## Cuenta de comprador e historial

La app ahora permite crear una cuenta, iniciar y cerrar sesión, asociar el carrito de invitado al comprador autenticado y consultar compras agrupadas con sus pedidos por tienda. Las compras de invitado existentes no se vinculan automáticamente a una cuenta; las compras futuras deben realizarse con la sesión iniciada para aparecer en el historial.

El gateway del APK admite únicamente el registro/inicio de sesión de compradores, la consulta del cliente autenticado, la asociación de un carrito y la lectura de grupos de compra. Limita a diez por minuto los intentos de acceso por dirección IP. Para que una APK nueva use estas rutas, reinicia el proceso del gateway y recompila la app. La APK ya distribuida no incorpora estas pantallas.

## Android mediante USB

Con la API en ejecución, arranca Metro en el VPS. El puerto escucha en la interfaz local:

```sh
CI=1 EXPO_NO_TELEMETRY=1 corepack pnpm --filter @agestyles/buyer-app android:lab
```

Desde una computadora con acceso por SSH al VPS, ejecuta este comando sustituyendo el destino por tu servidor habitual. Deja la conexión abierta:

```sh
ssh -N -L 18082:127.0.0.1:18082 -L 19080:127.0.0.1:19080 usuario@vps
```

Conecta el Android mediante USB, autoriza la depuración en el teléfono y usa [Android Platform Tools](https://developer.android.com/tools/releases/platform-tools) en otra terminal. `adb devices` debe indicar `device`:

```sh
adb devices
adb reverse tcp:18082 tcp:18082
adb reverse tcp:19080 tcp:19080
adb shell am start -a android.intent.action.VIEW -d exp://127.0.0.1:18082 host.exp.exponent
```

Instala antes [Expo Go para Android compatible con SDK 54](https://expo.dev/go?device=true&platform=android&sdkVersion=54). Una vez abierto, agrega Meridian Twin-Strap Sandal de Sole Society y Meridian Twin-Strap Buckle Sandal de Kickz Corner. Completa el pedido con dirección ficticia en España, un envío por tienda y pago manual. La confirmación debe indicar dos pedidos.

El VPS compiló el código para Android y sirvió el manifiesto que usa Expo Go. La ejecución del recorrido en el teléfono requiere el dispositivo conectado. La prueba en iOS queda aplazada.

## APK de prueba

La compilación de distribución para Android usa el paquete `com.eavlabs.agestyles.buyerlab`, arquitectura ARM64 y Android 7.0 o posterior. Contiene el código de la app y se conecta al laboratorio mediante `https://descargas.eav-labs.com/agestyles-lab`. No depende de Expo Go ni de Metro.

```sh
corepack pnpm --filter @agestyles/buyer-app exec expo prebuild --platform android --no-install
(
  cd apps/buyer-app/android
  EXPO_PUBLIC_MEDUSA_URL=https://descargas.eav-labs.com/agestyles-lab \
    NODE_ENV=production ./gradlew --no-daemon --max-workers=1 \
    -PreactNativeArchitectures=arm64-v8a :app:assembleRelease
)
```

Firma el APK resultante con la clave privada de AgeStyles Prueba antes de distribuirlo y verifica el certificado con `apksigner verify`. El archivo `.env.local` aporta la clave publicable de Medusa, que debe corresponder al laboratorio.

La pasarela `node tools/scripts/buyer-lab-gateway.mjs` escucha en el puerto local 19182 y acepta los métodos que el comprador necesita para catálogo, carrito y pago manual. El almacén de datos y las rutas de vendedores y administración siguen en el entorno local.

```sh
node --env-file=apps/buyer-app/.env.local apps/buyer-app/scripts/verify-apk-gateway.mts \
  https://descargas.eav-labs.com/agestyles-lab
```

## Detener el laboratorio

Cierra los procesos de la API, la pasarela, Metro y la web. Luego ejecuta:

```sh
corepack pnpm lab:down
```

## Origen de las bases

- La carga demo y la configuración TypeScript de la API provienen del [starter Mercur 2.4.1](https://github.com/mercurjs/mercur/tree/v2.4.1/templates/basic/packages/api). Su licencia está en `apps/commerce-api/LICENSE-MERCUR`.
- La UI Expo parte del [ejemplo oficial de Medusa](https://github.com/medusajs/examples/tree/aae76657952903750dfcaaaf28b6746f20ab1af5/react-native-expo), con selección de ofertas, envíos separados por vendedor y confirmación de un grupo de pedidos.

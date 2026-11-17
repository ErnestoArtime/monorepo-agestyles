# Preparación de build Android de laboratorio

**Corte:** 17 de noviembre de 2026
**Decisión:** `blocked-by-capacity` para builds nativos locales en este VPS.

## Medición liviana

| Elemento | Evidencia actual |
|---|---|
| Node | `v24.18.0` |
| Expo | buyer y business declaran SDK `~54.0.22`; el paquete instalado es `54.0.38` |
| Java | OpenJDK `21.0.13` |
| Android SDK | `ANDROID_HOME=/home/ernesto/Android/Sdk`; `du` mide 6.3 GiB. Plataformas `android-34`, `android-35`, `android-36`, `android-37.0`; Build Tools `35.0.0`, `36.0.0`, `37.0.0`. |
| ADB | `/home/ernesto/Android/Sdk/platform-tools/adb`, versión `37.0.1`. `adb devices -l` no detectó dispositivos. El usuario tiene un Android, pero no está conectado al VPS. |
| Emulator | El binario está presente (821 MiB); no hay `system-images` ni AVD instalado. No descargar una imagen con el espacio actual. |
| Gradle | No hay `gradle` global en `PATH`. El proyecto Android generado de Buyer contiene wrapper `8.14.3`; su distribución ocupa 146 MiB. La caché Gradle existente ocupa 5.9 GiB, de los cuales 4.4 GiB son `caches`. |
| Proyectos nativos | Buyer tiene una carpeta Android generada local de 689 MiB. Business no tiene carpeta `android/` y requiere prebuild. La carpeta Buyer no sustituye una generación reproducible desde la configuración versionada. |
| EAS | No hay `eas` en `PATH` ni `eas.json` en ninguna app. No hay perfil EAS configurado para estas apps. |
| Almacenamiento | `df -h /home/ernesto`: 193 GiB total, 190 GiB usados, 3.7 GiB disponibles (99%). |

El mínimo operativo fijado para esta tarea es **8 GiB libres antes de iniciar Gradle/EAS local o descargar una imagen de emulador**. Faltan al menos 4.3 GiB solo para alcanzar ese umbral; el build también necesita margen temporal para intermediarios y artefactos. La carpeta Android generada de Buyer ya ocupa 689 MiB y no se borró. No se midió el coste incremental de los APK porque el build está expresamente bloqueado por capacidad. El umbral de 8 GiB es un piso, no una garantía de espacio suficiente para ambos builds simultáneos.

## Configuración y brechas

- Buyer: `apps/buyer-app/app.json` declara `com.eavlabs.agestyles.buyerlab`, `versionCode: 1`, nueva arquitectura y `edgeToEdgeEnabled`.
- Business: `apps/business-app/app.json` declara `com.eavlabs.agestyles.businesslab`, `versionCode: 1`, nueva arquitectura y `edgeToEdgeEnabled`; todavía no tiene proyecto Android generado.
- Ambas usan Expo Router y React Native `0.81.5`. No se confirmó un perfil de firma de release ni hay `eas.json`; el primer artefacto de laboratorio debe ser un APK debug sin credenciales de firma de producción.
- Los `.env.local` actuales de ambas apps apuntan a `http://127.0.0.1:19081`; esa dirección no es accesible desde el Android del usuario. Antes de compilar un APK instalable hay que poner `EXPO_PUBLIC_MEDUSA_URL=https://descargas.eav-labs.com/agestyles-lab` y conservar únicamente la clave publicable privada que ya usa cada app. Nunca incluir una clave Admin.
- No se inició Gradle, Expo prebuild, EAS, emulador ni descarga. No se modificaron archivos de las apps.

## Procedimiento cuando haya capacidad

Después de medir al menos 8 GiB libres y actualizar de forma privada `EXPO_PUBLIC_MEDUSA_URL` al gateway público de laboratorio, desde la raíz generar los proyectos nativos y construir debug, uno por vez:

```sh
corepack pnpm --filter @agestyles/buyer-app exec expo prebuild --platform android
apps/buyer-app/android/gradlew -p apps/buyer-app/android :app:assembleDebug
corepack pnpm --filter @agestyles/business-app exec expo prebuild --platform android
apps/business-app/android/gradlew -p apps/business-app/android :app:assembleDebug
```

Recoger cada `android/app/build/outputs/apk/debug/app-debug.apk`. Los builds deben correr **uno por vez**. Si se conecta el Android por ADB, instalar con `adb install -r <ruta-apk>`; de lo contrario, transferir solo el APK de prueba por un canal privado. No distribuirlo como producción.

Para usar el teléfono del usuario, iniciar ADB y comprobar `adb devices -l` una vez que el dispositivo esté conectado con depuración USB habilitada. iOS no puede construirse en este Linux; requiere macOS y Xcode.

## Comandos medidos

```sh
node --version
java -version
adb version
adb devices -l
df -h /home/ernesto
du -sh /home/ernesto/Android/Sdk /home/ernesto/.gradle /home/ernesto/.android /home/ernesto/Android/Sdk/emulator /home/ernesto/.gradle/caches /home/ernesto/.gradle/wrapper/dists
```

No se lanzaron los comandos de build de la sección anterior durante esta medición.

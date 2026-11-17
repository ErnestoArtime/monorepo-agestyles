# Ciclo local de desarrollo

Usa gates rápidos durante los cambios pequeños y reserva el gate completo para integrar áreas que dependen unas de otras. Estos comandos trabajan con el código local; no publican ni despliegan.

## Comandos de uso frecuente

```sh
# Ejecuta las pruebas sintéticas de todos los proyectos Nx; no compila aplicaciones.
corepack pnpm test

# Comprueba tipos de apps y paquetes, excluyendo Commerce API.
corepack pnpm typecheck:quick

# Comprueba solo el paquete o app que se está editando.
corepack pnpm --filter @agestyles/business-app typecheck
corepack pnpm --filter @agestyles/buyer-app typecheck
corepack pnpm --filter @agestyles/features-buyer test
```

## Gate de integración de Commerce API

```sh
corepack pnpm --filter @agestyles/commerce-api typecheck
```

Este gate compila antes `@agestyles/quotations`, `@agestyles/catalog-pim` y `@agestyles/manual-payments`, porque Medusa carga los módulos workspace compilados en CommonJS. En la medición del 17 de noviembre de 2026 el target tardó 2:47. Ejecutarlo al integrar cambios de API o de esos módulos; no es un build de frontend ni publica una imagen.

El gate completo es:

```sh
corepack pnpm typecheck
```

Ejecuta todos los targets de Nx, incluido Commerce API. Úsalo antes de un checkpoint de integración; para una pantalla aislada, ejecuta primero su typecheck filtrado.

## Compilaciones y publicación

Los comandos anteriores no generan APKs, exports web ni imágenes Docker. Para Android/iOS, builds web de distribución, publicación manual de imágenes o despliegue, sigue los runbooks específicos y confirma antes el espacio disponible. `references/` permanece fuera del repositorio.

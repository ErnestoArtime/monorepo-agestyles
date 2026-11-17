# AgeStyles Negocio

App Expo para que los miembros operen las tiendas a las que pertenecen. Usa el API de vendedores del laboratorio Medusa/Mercur y una sesión de actor `member` con almacenamiento separado del actor comprador.

## Ejecutar en el laboratorio

1. Levantar y preparar el laboratorio con `corepack pnpm lab:up`, `corepack pnpm lab:migrate` y `corepack pnpm lab:seed`.
2. Iniciar el API del laboratorio con `corepack pnpm lab:api`.
3. Generar la configuración privada del app con `corepack pnpm lab:business`.
4. Iniciar Expo con `corepack pnpm lab:business-app`.

La configuración local está en `.env.local` y no se sube a Git. El valor por defecto apunta a `127.0.0.1:19080`; un dispositivo Android físico requiere un origen accesible desde el dispositivo y permitido en CORS. No se debe insertar una clave de Admin API en esta app.

## Funciones disponibles

- Inicio de sesión de miembro y selector de las tiendas permitidas.
- Resumen, consulta de catálogo, pedidos y existencias.
- Ajuste de cantidades solo cuando el permiso efectivo indica edición de inventario.
- Cambio de tienda que vuelve a solicitar las capacidades y datos al servidor.
- Iconos compartidos mediante `@agestyles/icons`.

El servidor sigue siendo la autoridad: una acción directa o un estado de interfaz alterado no concede acceso a otra tienda ni eleva el rol. El modo comprador integrado requiere extraer los flujos a `packages/features-buyer`; no se simula con una pantalla externa.

## Validación

- `corepack pnpm --filter @agestyles/business-app typecheck`
- `corepack pnpm --filter @agestyles/business-app exec expo export --platform web --output-dir /tmp/agestyles-business-web`
- `node --env-file=apps/buyer-app/.env.local apps/commerce-api/scripts/verify-seller-roles.mjs` valida 30 respuestas de permisos y los endpoints/campos usados por estas pantallas.

Los identificadores nativos son `com.eavlabs.agestyles.businesslab` y `agestyles-business-lab`. La exportación web no equivale a una build Android/iOS ni a una prueba en dispositivo.

# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Compradores que descubren y comparan productos de varias tiendas. Propietarios y equipos de tienda que administran catálogo, pedidos e inventario con permisos diferentes.

## Product Purpose

AgeStyles reúne descubrimiento y compra multivendedor con herramientas de operación para tiendas. El éxito requiere conservar los flujos y datos comerciales existentes mientras se valida la nueva plataforma en un laboratorio aislado.

## Positioning

Una plataforma de moda multitienda donde el catálogo permite comparar ofertas de distintos vendedores y el negocio opera cada tienda bajo permisos comprobados por el servidor.

## Operating Context

Experiencias web públicas para catálogo y compra, aplicaciones Expo para compradores y equipos de negocio, paneles web para operación avanzada, y un backend Medusa con Mercur para vendedores y pedidos.

## Capabilities and Constraints

- Organización, tienda pública y ubicación de inventario son conceptos distintos.
- Un propietario puede gestionar varias tiendas; la autorización de cada tienda se verifica en el servidor.
- Las sesiones de comprador y vendedor son actores separados, aunque pertenezcan a la misma persona.
- Mantener AgeStyles actual y Supabase intactos durante la PoC. No realizar ETL ni corte de producción sin backup restaurado, reconciliación, rollback y decisión go/no-go.
- Los pagos, cotizaciones, IA, identidad unificada y compra integrada dentro de la app de negocio requieren validación antes de considerarse disponibles.
- Android e iOS comparten capacidades y lenguaje visual, respetando navegación y accesibilidad de cada plataforma.

## Brand Commitments

AgeStyles; Modern Luxury claro, fondos blancos o marfil, grafito, azul noche y acentos cálidos discretos. Mantener el símbolo AgeStyles y utilizar `@agestyles/icons` como biblioteca común web y nativa.

## Evidence on Hand

El repositorio contiene el plan maestro de AgeStyles 2.0, una app compradora Expo, un storefront Next y un laboratorio Medusa/Mercur con PostgreSQL y Redis aislados. Las referencias móviles están conservadas en `references/` y sirven para consulta, no para integrarse como aplicaciones del monorepo.

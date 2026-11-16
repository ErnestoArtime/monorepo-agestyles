# ADR-001: Laboratorio Mercur aislado y coexistencia con AgeStyles actual

- **Estado:** Aceptada para la prueba de concepto; no autoriza cutover.
- **Fecha:** 16 de noviembre de 2026.
- **Decisores:** AgeStyles 2.0.

## Contexto

AgeStyles actual opera con Supabase y conserva productos, pedidos, perfiles, medios e historial de inventario. El plan requiere validar Mercur sin alterar la plataforma operativa. El VPS también ejecuta otros servicios y, en el corte actual, tiene 6.1 GiB libres (97% de disco utilizado) y swap agotado.

El nuevo laboratorio ejecuta Mercur 2.4.1 con Medusa 2.22.3, su propio PostgreSQL 17 y Redis 7. La beta de compradores está publicada en `tienda.eav-labs.com` y utiliza datos de prueba del laboratorio.

## Decisión

1. Mantener AgeStyles/Supabase como única fuente operativa del negocio hasta aprobar un go/no-go explícito de migración.
2. Mantener el laboratorio en su base PostgreSQL y Redis separados, con puertos internos en loopback y credenciales fuera del repositorio.
3. Tratar `tienda.eav-labs.com` como beta pública de laboratorio: pedidos y pagos son de prueba; no habilitar venta real en esta ruta.
4. No ejecutar ETL, migraciones de esquema fuente, DNS del dominio comercial ni eliminación de recursos mientras F0/F6 no tengan backup restaurado, reconciliación y rollback demostrado.
5. No ampliar las compilaciones o almacenamiento en el VPS con el disco al 97% y swap consumido. Recuperar margen tras identificar datos y servicios de forma segura o mover builds/backups a un destino externo cifrado.

## Consecuencias

- Se puede iterar en comprador, API y permisos de vendedor sin escribir en la base operativa.
- La beta pública y el marketplace real son entornos distintos y deben seguir identificándose claramente.
- F1/F2 pueden avanzar en código y pruebas ligeras; los builds pesados, backup y ETL quedan sujetos a la puerta de capacidad/restauración.
- El dominio y los datos reales permanecen recuperables porque no se cambia el escritor actual.

## Evidencia que permite reconsiderar

- Informe de backup de PostgreSQL, objetos de Storage y metadatos/Auth, con checksums y restauración aislada exitosa.
- Auditoría VPS actualizada con margen de disco/memoria y plan de backups externos.
- F1 validada en dos organizaciones y cuatro tiendas, incluidos accesos cruzados e identidad dual.
- Ensayo F6 idempotente, reconciliado y con rollback verificado en staging.

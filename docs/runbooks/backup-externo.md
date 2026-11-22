# Runbook — Copia externa de producción (AG-02)

Plan concreto de la copia cifrada diaria de PostgreSQL de producción fuera
del VPS, con restore probado. **No implementado**: este documento es el
plan; nada de aquí se ejecuta en el VPS sin autorización explícita del
usuario en esa sesión (AG-02 está aplazada por decisión del usuario del
17 nov 2026).

## Riesgo aceptado hoy

Hoy no hay ninguna copia de producción fuera del VPS ni restore probado.
Si el VPS se pierde (disco, proveedor, borrado), se pierde la base
`agestyles_commerce` (pedidos, clientes, pagos, inventario, ofertas) y los
medios locales. El catálogo histórico seguiría en el proyecto Supabase
legacy (bucket `product-images` y sus URLs), pero no los datos nuevos de
la plataforma 2.0. Ese es el riesgo que AG-02 cierra.

## Qué se copia

1. **PostgreSQL de producción**: base `agestyles_commerce`, usuario
   `agestyles_production`, en `127.0.0.1:15473` (servicio `postgres` de
   `infra/compose/commerce-production-data.yaml`, volumen `postgres-data`).
2. **Medios locales** (solo si el perfil `local-media` está activo):
   el volumen de MinIO (`agestyles-product-media`) o, en su defecto,
   `AGESTYLES_MEDIA_DIR`. Los medios que siguen en Supabase Storage no se
   copian aquí: dependen del proyecto legacy, que se conserva.
3. **No se copia**: Redis (caché y colas, reconstruible), ni los archivos
   privados `api.env`/`compose.env` (esos se custodian aparte, ver abajo).

## Dónde se guarda

- Destino: **fuera del VPS, cifrado**. Pendiente de decisión del usuario:
  un segundo servidor, un bucket de objetos con cifrado en reposo, o un
  disco externo con copia periódica. Lo que no vale: otro volumen del
  mismo VPS.
- Retención propuesta: 7 copias diarias + 4 semanales (la semanal se
  conserva 1 mes). Cada archivo se nombra
  `agestyles-commerce-YYYY-MM-DD.dump.gpg` (y `agestyles-media-YYYY-MM-DD.tar.gpg`).
- La frase de cifrado vive **solo** en el archivo privado del VPS
  (p. ej. `/ruta/privada/backup.pass`, permisos `600`, nunca en el repo
  ni en `api.env`): es lo que hace que la copia sea inútil si el destino
  se filtra.

## Comando / script (en el VPS)

No hay script en el repo todavía; el plan es un cron diario en el VPS que
ejecute, con las credenciales leídas del `compose.env` privado:

```sh
# 1. Volcado lógico de Postgres (formato custom, consistente) desde un
# contenedor desechable contra el loopback; la contraseña se lee del
# compose.env privado, nunca se escribe en el script.
docker run --rm --network host \
  -e PGPASSWORD="${AGESTYLES_PRODUCTION_POSTGRES_PASSWORD}" \
  postgres:17-alpine pg_dump -h 127.0.0.1 -p 15473 \
  -U agestyles_production -d agestyles_commerce -Fc \
  > /tmp/agestyles-commerce-YYYY-MM-DD.dump

# 2. Cifrado simétrico con la frase del archivo privado (GPG).
gpg --batch --yes --passphrase-file /ruta/privada/backup.pass \
  --symmetric --cipher-algo AES256 \
  -o /tmp/agestyles-commerce-YYYY-MM-DD.dump.gpg \
  /tmp/agestyles-commerce-YYYY-MM-DD.dump
shred -u /tmp/agestyles-commerce-YYYY-MM-DD.dump   # o rm -P

# 3. Medios locales (solo si local-media está activo): los volúmenes del
# proyecto son agestyles-commerce-production_media-data (MinIO, /data) y
# agestyles-commerce-production_product-media (fotos en /var/lib/agestyles/media).
docker run --rm -v agestyles-commerce-production_media-data:/data:ro \
  -v /tmp:/out alpine tar czf /out/agestyles-media-YYYY-MM-DD.tar.gz -C /data .
docker run --rm -v agestyles-commerce-production_product-media:/media:ro \
  -v /tmp:/out alpine tar czf /out/agestyles-product-media-YYYY-MM-DD.tar.gz -C /media .
# …y cifrar ambos igual que el volcado.

# 4. Subida fuera del VPS (ejemplo rsync; el destino lo decide el usuario).
rsync -av /tmp/agestyles-commerce-YYYY-MM-DD.dump.gpg usuario@destino:/copias/agestyles/
rsync -av /tmp/agestyles-media-YYYY-MM-DD.tar.gpg usuario@destino:/copias/agestyles/
rsync -av /tmp/agestyles-product-media-YYYY-MM-DD.tar.gpg usuario@destino:/copias/agestyles/
rm -f /tmp/agestyles-commerce-YYYY-MM-DD.dump.gpg /tmp/agestyles-media-YYYY-MM-DD.tar.gpg /tmp/agestyles-product-media-YYYY-MM-DD.tar.gpg
```

Notas:

- `pg_dump -Fc` es consistente sin parar la API (una sola transacción de
  lectura); no hace falta ventana de mantenimiento.
- La subida debe verificar integridad (rsync con `--checksum` o comparar
  el hash SHA-256 del archivo antes y después).
- El cron debe avisar si falla (correo o log vigilado): un backup que
  falla en silencio es peor que no tenerlo, porque da falsa seguridad.

## Cómo se prueba el restore

Una vez al mes, en una máquina/base **aislada** (nunca sobre producción):

```sh
# 1. Descifrar la copia del día anterior en una carpeta temporal.
gpg --batch --yes --passphrase-file /ruta/privada/backup.pass \
  -o /tmp/restore.dump -d /copias/agestyles/agestyles-commerce-YYYY-MM-DD.dump.gpg

# 2. Levantar un Postgres desechable (misma versión mayor: postgres:17).
docker run -d --name agestyles-restore-test -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=agestyles_restore postgres:17-alpine

# 3. Restaurar y comprobar.
docker exec -i agestyles-restore-test pg_restore -U postgres \
  -d agestyles_restore --clean --if-exists < /tmp/restore.dump
docker exec agestyles-restore-test psql -U postgres -d agestyles_restore -c \
  "SELECT (SELECT count(*) FROM \"order\") AS orders,
          (SELECT count(*) FROM customer) AS customers,
          (SELECT count(*) FROM product) AS products;"

# 4. Destruir el contenedor y el volcado descifrado.
docker rm -f agestyles-restore-test
shred -u /tmp/restore.dump
```

La prueba pasa si `pg_restore` termina sin errores y los conteos cuadran
con producción (órdenes de magnitud, no cifra exacta: la copia es del día
anterior). Si falla, AG-02 sigue abierta aunque el cron diario funcione.
Anota cada prueba (fecha, archivo restaurado, resultado) en el handoff.

## Pendientes para activar AG-02

1. **Decisión del usuario**: destino fuera del VPS y retención final.
2. Crear el cron en el VPS + la frase de cifrado en archivo privado.
3. Primera prueba de restore en base aislada y su anotación.
4. Decidir si los medios de Supabase legacy necesitan copia propia
   (hoy se conservan con el proyecto legacy intacto).

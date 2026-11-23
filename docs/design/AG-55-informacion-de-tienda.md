# AG-55 · Información de la tienda

Estado: implementado en código, sin desplegar (23 nov 2026). Referencia: la ficha «Info» de
elyerromenu.com (recogida/domicilio, horarios con «abierto», contactos, dirección, redes).

## Qué ve el comprador
- **Tienda** (página de una tienda, debajo de su portada): resumen con «Abierto · cierra hoy a las
  20:00», «Recogida» y «Envío a domicilio»; en pantalla ancha, el detalle siempre visible; en móvil, «Ver
  información» lo despliega. Detalle: atención (con nota de envío), horario agrupado, dirección con
  referencia y «Cómo llegar» (mapa), teléfonos (llamar), WhatsApp, correo y redes.
- **Catálogo** (`/tiendas/[handle]`): la misma ficha como tarjeta bajo la cabecera. «Abierto ahora» se
  calcula en el navegador porque la página está en caché (5 min).
- Solo se muestra para tiendas **abiertas** y con algo publicado; una tienda pendiente, suspendida o vacía
  no muestra nada.

## Quién la edita
- **La propia tienda:** Negocio → Información de la tienda (menú lateral y «Más»). Todo el equipo la ve;
  la edita el propietario o la administración (el servidor lo exige).
- **El superadmin:** Negocio → Administración → Tiendas → abrir una tienda → «Editar información pública».
  Mismo editor y misma validación.

## Datos
`seller.metadata.agestyles_info` (sin migración), validado por `@agestyles/domain/store-info`:
recogida/envío + nota, hasta 3 teléfonos, WhatsApp, correo, dirección (calle, municipio, provincia,
referencia), ubicación (lat/lng, opcional), horario semanal (un tramo por día; si el cierre no es posterior a
la apertura, cierra al día siguiente), zona horaria (por defecto `America/Havana`) y redes (Instagram,
Facebook, TikTok, Telegram, YouTube, sitio web). Los enlaces de redes se normalizan a https y se comprueba
que sean del dominio de cada red; se rechazan `javascript:` y credenciales en la URL.

El **WhatsApp** es el mismo número que `metadata.whatsapp_phone`, que ya alimenta los avisos de pedidos por
WhatsApp: al guardar se sincronizan y, si la tienda ya tenía uno, rellena el editor.

## API
- `GET/POST /vendor/agestyles/store-info` (equipo; escribir = propietario o administración).
- `GET/POST /admin/agestyles/stores/:id/info` (superadmin).
- `GET /store/agestyles/store-info?seller_id=…|handle=…` (público, caché 60 s; `info: null` si no hay nada).
Los tres gateways tienen su regla (`seller-lab`, `admin`, `buyer-lab`).

## Pendiente / no incluido
- Reseñas (la referencia las muestra): no hay modelo de reseñas de tienda.
- Etiquetas tipo «#Dulcería» y varios tramos horarios por día.
- Tarjetas de la lista de tiendas con «abierto ahora» (exigiría una petición por tienda).
- Probar en navegador real con una tienda de producción y desplegar la API.

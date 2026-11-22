# AG-54 · Tasa CUP automática desde elTOQUE

Estado: implementado en código, sin desplegar (22 nov 2026).

## Objetivo
Que la tasa informativa CUP/USD de las apps (Tienda, Catálogo, carrito y mensaje de WhatsApp) se
actualice sola, sin esperar el token oficial de elTOQUE (AG-01) y sin montar un navegador.

## Cómo funciona
`apps/commerce-api/src/jobs/sync-eltoque-rate.ts` corre cada 30 minutos y prueba, en orden:

1. **API oficial** (`https://tasas.eltoque.com/v1/trmi`) si existe `ELTOQUE_API_TOKEN`.
2. **Página pública** `https://eltoque.com/tasas-de-cambio-cuba`: una petición con cabecera de móvil;
   lee el `Dataset` JSON-LD (valor `USD/CUP` y `dateModified`) y, si falta, el bloque visible
   «Mercado informal». Se desactiva con `ELTOQUE_WEB_SYNC=false`.
3. **Último valor bueno**: si nada se pudo leer, no se toca. El administrador sigue pudiendo fijarla a
   mano (`POST /admin/agestyles/exchange-rate`).

Antes de publicar, `evaluateRate` (`src/lib/eltoque-rates.ts`) rechaza: valores fuera de rango, datos con
más de 48 h según la propia fecha de elTOQUE, y saltos de más del 25 % respecto del último valor
**automático** de los últimos 3 días (un error tecleado a mano nunca bloquea la corrección automática).

El valor se guarda en la metadata de la tienda (`agestyles_cup_per_usd`) con `source`
(`elTOQUE (API)` / `elTOQUE (web)` / `manual`) y `source_updated_at`.

## Fuente y licencia
Los datos de la página son **CC BY 4.0** (declarado en su `Dataset`): se pueden reutilizar citando a
elTOQUE. Las apps muestran «Tasa informativa · Fuente: elTOQUE · fecha» (`rateSourceLine` en
`@agestyles/domain/exchange-rate`) en la ficha y el carrito de la Tienda, en el panel de compra del
Catálogo y en el pie de la Tienda para las tarjetas. `robots.txt` permite `/` y prohíbe `/api/` y
`/draft/`. No se han revisado los términos de uso completos de elTOQUE.

## Comportamiento de Cloudflare observado (22 nov 2026, desde el VPS)
| Cliente | Respuesta |
|---|---|
| `curl`/Node con cabecera de escritorio | 403 |
| Cabecera que se identifica como bot propio | 403 |
| Cabecera de móvil Android (curl o Node) | 200 con la página completa |
| Playwright como escritorio | 403 («Un momento…») |
| Playwright emulando Pixel 7 | 200 |

Por eso **no hay navegador**: hoy no aporta nada sobre HTTP. Este módulo **no intenta saltarse** el
desafío: si lo recibe (`looksBlocked`) lo registra y conserva el último valor. Si elTOQUE cierra el
acceso, el camino es el token oficial (AG-01) o la tasa manual, no una carrera de evasión.

## Riesgos conocidos
- Depende de que Cloudflare siga dejando pasar la cabecera de móvil; puede cambiar sin aviso.
- El primer valor automático aparece como máximo 30 min después de desplegar la API.
- Un navegador (Playwright) como capa extra sería un contenedor aparte, no parte de la imagen de la API.

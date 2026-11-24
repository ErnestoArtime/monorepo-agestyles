# Aplicar el paso de Lighthouse a mano en GitHub (AG-59, Fase 2)

Solo si el push de la rama devuelve 403 en `.github/workflows/ci.yml`, como pasó
con el PR #3: GitHub no deja subir archivos de workflow por la API ni por el
snapshot. En ese caso el paso no entra en el PR y hay que pegarlo a mano.

Verificado 2026-11-24 contra `main` en GitHub
(raw.githubusercontent.com/ErnestoArtime/monorepo-agestyles/main/.github/workflows/ci.yml):
el archivo en `main` NO tiene el paso de Lighthouse ni el script
`tools/scripts/check-lighthouse-budgets.mjs` (ese script SÍ entra en el PR, porque
no es un workflow). No se tocó el repo: esto es solo para pegarlo en el editor
web de GitHub.

## Cómo aplicarlo

1. En GitHub: `ErnestoArtime/monorepo-agestyles` → `.github/workflows/ci.yml` →
   lápiz (Edit).
2. Hacer los 2 cambios de abajo.
3. Commit directamente en `main` con mensaje, por ejemplo:
   `ci: auditar la vitrina con Lighthouse en cada PR (AG-59)`.
4. Ver que el workflow `Monorepo checks` corre y que el artefacto
   `lighthouse-storefront` aparece en la ejecución.

## Cambio 1 — mover la compilación de la vitrina

El paso `Build the SEO storefront` está al final del job, después de parar la
API desechable. Lighthouse necesita la API corriendo para medir las páginas
con datos reales, así que el paso se mueve antes de `Report Commerce API
errors as annotations when a check fails`. Borrarlo de su sitio actual (último
paso del job) y pegarlo ahí:

```yaml
      - name: Build the SEO storefront
        run: pnpm nx build @agestyles/storefront-web
```

## Cambio 2 — auditar con Lighthouse y subir los informes

Justo después del paso movido en el cambio 1, y antes de `Report Commerce API
errors as annotations when a check fails`:

```yaml
      - name: Audit the SEO storefront with Lighthouse (AG-59, Fase 2)
        env:
          MEDUSA_BACKEND_URL: http://127.0.0.1:19081
          MEDUSA_PUBLISHABLE_API_KEY: ${{ env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY }}
          SITE_URL: http://127.0.0.1:3000
          BUYER_APP_URL: https://ci.invalid
        run: |
          set -euo pipefail
          # The disposable API is still running here with the seeded lab data,
          # so Lighthouse measures the real catalog pages, not empty ones.
          # This step must stay before "Stop disposable Commerce API smoke test".
          pnpm --filter @agestyles/storefront-web exec next start --hostname 127.0.0.1 --port 3000 >/tmp/agestyles-storefront-ci.log 2>&1 &
          server_pid=$!
          trap 'kill "${server_pid}" 2>/dev/null || true' EXIT
          ready="000"
          for attempt in $(seq 1 60); do
            ready="$(curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:3000/ || true)"
            if [[ "${ready}" == "200" ]]; then break; fi
            sleep 2
          done
          if [[ "${ready}" != "200" ]]; then
            echo "Storefront did not become ready; got ${ready}." >&2
            cat /tmp/agestyles-storefront-ci.log
            exit 1
          fi
          mkdir -p /tmp/agestyles-lighthouse
          for page in "" "tiendas" "novedades"; do
            slug="${page:-inicio}"
            npx -y lighthouse@12 "http://127.0.0.1:3000/${page}" \
              --output=json --output=html \
              --output-path="/tmp/agestyles-lighthouse/${slug}" \
              --chrome-flags='--headless --no-sandbox --disable-dev-shm-usage' \
              --preset=desktop
          done
          node tools/scripts/check-lighthouse-budgets.mjs /tmp/agestyles-lighthouse

      - name: Upload Lighthouse reports
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: lighthouse-storefront
          path: /tmp/agestyles-lighthouse/
```

## Si el paso falla la primera vez

Los presupuestos (`tools/scripts/check-lighthouse-budgets.mjs`) son de partida:
rendimiento ≥ 0,8; accesibilidad, buenas prácticas y SEO ≥ 0,9; LCP ≤ 3000 ms;
CLS ≤ 0,1; INP ≤ 300 ms. Si el primer run real queda por debajo, no se baja el
listón a ciegas: se mira el informe HTML del artefacto, se arregla lo que
señale y, solo si el presupuesto era irreal para esta vitrina, se retoca en el
script con el motivo escrito en `docs/design/AG-59-legales-analytics-vistas-clics.md`.

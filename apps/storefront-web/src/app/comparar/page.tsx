import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@agestyles/icons";
import { getCatalogComparison } from "@/lib/catalog";
import { ProductComparisonBar } from "@/components/product-comparison";
import type { CatalogComparisonResponse } from "@agestyles/api-client/catalog-comparison";

export const metadata: Metadata = {
  title: "Comparar productos",
  description: "Compara las características de productos disponibles en AgeStyles.",
  alternates: { canonical: "/comparar" },
};

type PageProps = { searchParams: Promise<{ ids?: string | string[] }> };

const incompatibility: Record<string, string> = {
  family_missing: "Algún producto no tiene una familia de características asignada.",
  different_family_versions: "Los productos usan fichas técnicas distintas.",
};

export default async function ComparePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawIds = Array.isArray(params.ids) ? params.ids.join(",") : params.ids || "";
  const ids = [
    ...new Set(
      rawIds
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
  let result: CatalogComparisonResponse | undefined;
  let error = "";

  if (ids.length >= 2 && ids.length <= 4) {
    try {
      result = await getCatalogComparison(ids);
    } catch {
      error = "No se pudo cargar la comparación. Comprueba que los productos sigan publicados.";
    }
  }

  return (
    <main className="comparison-page">
      <section className="wrap comparison-content">
        <div className="comparison-heading">
          <p className="eyebrow">AGESTYLES · COMPARACIÓN</p>
          <h1>Compara características</h1>
          <p>Revisa lado a lado los datos disponibles en las fichas de producto.</p>
        </div>
        {error ? (
          <p className="comparison-error" role="alert">
            {error}
          </p>
        ) : null}
        {result ? (
          <>
            {result.comparison.compatibility.compatible ? null : (
              <p className="comparison-notice-block" role="status">
                {incompatibility[result.comparison.compatibility.reason] ||
                  "No se puede comparar la ficha técnica de estos productos."}
              </p>
            )}
            {!result.comparison.attributes.available &&
            result.comparison.compatibility.compatible ? (
              <p className="comparison-empty" role="status">
                Aún no hay características comparables para esta selección.
              </p>
            ) : (
              <div
                className="comparison-table-wrap"
                role="region"
                aria-label="Tabla de comparación"
                tabIndex={0}
              >
                <table className="comparison-table">
                  <thead>
                    <tr>
                      <th scope="col">Característica</th>
                      {result.products.map((product) => (
                        <th scope="col" key={product.id}>
                          {product.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.comparison.attributes.rows.map((row) => (
                      <tr key={row.key}>
                        <th scope="row">{row.key.replace(/[_-]+/g, " ")}</th>
                        {result.products.map((product) => {
                          const value = row.values.find(
                            (entry) => entry.productId === product.id,
                          )?.value;
                          return (
                            <td key={product.id}>
                              {value || <span aria-label="Sin dato">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <ProductComparisonBar />
          </>
        ) : ids.length === 1 ? (
          <p className="comparison-empty">
            Hay 1 producto seleccionado. Vuelve al catálogo, añade al menos otro producto y abre la
            comparación.
          </p>
        ) : ids.length > 4 ? (
          <p className="comparison-error" role="alert">
            Elige entre 2 y 4 productos.
          </p>
        ) : (
          <p className="comparison-empty">Selecciona productos desde el catálogo para empezar.</p>
        )}
        <Link className="button button-dark comparison-back" href="/#catalogo">
          <Icon name="arrowLeft" size={14} /> Explorar productos
        </Link>
      </section>
    </main>
  );
}

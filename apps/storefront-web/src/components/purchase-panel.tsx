"use client";

import { Icon } from "@agestyles/icons";
import { formatCupEquivalent } from "@agestyles/api-client/exchange-rate";
import { useMemo, useState } from "react";
import { formatPrice } from "@/lib/catalog-format";
import {
  MAX_QUANTITY,
  clampQuantity,
  defaultSelection,
  groupBySeller,
  offerFor,
  selectSeller,
  type QuickViewData,
  type Selection,
} from "@/lib/quick-view-model";
import { useCart } from "./cart-provider";

/**
 * Choose the store, the variant and the quantity, then add to the cart. The same panel serves the
 * quick view and the product page, so both sell exactly the same way. Mount it with
 * `key={product id}` so the choice starts over for each product.
 */
export function PurchasePanel({
  data,
  buyerAppUrl,
  onAdded,
}: {
  data: QuickViewData;
  buyerAppUrl: string;
  onAdded?: () => void;
}) {
  const cart = useCart();
  const sellers = useMemo(() => groupBySeller(data.offers), [data.offers]);
  const [selection, setSelection] = useState<Selection | null>(() => defaultSelection(sellers));
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const offer = offerFor(sellers, selection);
  const seller = sellers.find((item) => item.id === selection?.sellerId);
  const cup = offer ? formatCupEquivalent(offer.amount, offer.currency, data.cupRate) : null;

  if (!sellers.length) {
    return (
      <p className="purchase-empty">
        Este producto todavía no tiene ofertas publicadas. Vuelve pronto.
      </p>
    );
  }

  function change(next: Selection | null) {
    setSelection(next);
    setAdded(false);
    cart.clearError();
  }

  async function add() {
    if (!offer) return;
    const ok = await cart.addOffer(offer.id, quantity);
    setAdded(ok);
    if (ok) onAdded?.();
  }

  return (
    <div className="purchase">
      <div className="purchase-price" aria-live="polite">
        {offer ? (
          <>
            <strong>{formatPrice(offer.amount, offer.currency)}</strong>
            {cup ? <span>{cup} · referencia, se cobra en USD</span> : null}
          </>
        ) : null}
      </div>

      {sellers.length > 1 ? (
        <label className="field">
          <span>Tienda</span>
          <select
            value={selection?.sellerId ?? ""}
            onChange={(event) => change(selectSeller(sellers, selection, event.target.value))}
          >
            {sellers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · desde {formatPrice(item.fromAmount, data.currency)}
                {item.inStock ? "" : " (agotado)"}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="purchase-seller">
          Vendido por <strong>{seller?.name}</strong>
        </p>
      )}

      {seller && seller.variants.length > 1 ? (
        <fieldset className="field">
          <legend>Variante</legend>
          <div className="pill-row" role="radiogroup" aria-label="Variante">
            {seller.variants.map((variant) => {
              const active = variant.variantId === selection?.variantId;
              return (
                <button
                  key={variant.variantId}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={[
                    "pill",
                    active ? "is-active" : "",
                    variant.offer.inStock ? "" : "is-soldout",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => change({ sellerId: seller.id, variantId: variant.variantId })}
                >
                  {variant.title}
                  {variant.offer.inStock ? "" : " · agotado"}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div className="purchase-row">
        <div className="stepper" role="group" aria-label="Cantidad">
          <button
            type="button"
            disabled={quantity <= 1}
            onClick={() => setQuantity((value) => clampQuantity(value - 1))}
            aria-label="Quitar una unidad"
          >
            <Icon name="minus" size={14} />
          </button>
          <span aria-live="polite">{quantity}</span>
          <button
            type="button"
            disabled={quantity >= MAX_QUANTITY}
            onClick={() => setQuantity((value) => clampQuantity(value + 1))}
            aria-label="Añadir una unidad"
          >
            <Icon name="plus" size={14} />
          </button>
        </div>
        {cart.available ? (
          <button
            type="button"
            className="btn btn-primary grow"
            disabled={!offer || !offer.inStock || cart.busy}
            onClick={() => void add()}
          >
            {!offer?.inStock ? "Agotado" : cart.busy ? "Agregando…" : "Agregar al carrito"}
          </button>
        ) : (
          <a className="btn btn-primary grow" href={buyerAppUrl}>
            Comprar en la app <Icon name="arrowRight" size={14} />
          </a>
        )}
      </div>

      {offer && !offer.inStock ? (
        <p className="purchase-note">
          Esta tienda no tiene unidades ahora. Prueba con otra tienda o variante.
        </p>
      ) : null}
      {cart.error ? (
        <p className="inline-alert" role="alert">
          {cart.error}
        </p>
      ) : null}
      {added ? (
        <p className="purchase-note ok" role="status">
          <Icon name="check" size={14} /> Agregado a tu carrito.
        </p>
      ) : null}
    </div>
  );
}

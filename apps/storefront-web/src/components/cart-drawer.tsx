"use client";

import Image from "next/image";
import { Icon } from "@agestyles/icons";
import { useRef } from "react";
import { formatPrice } from "@/lib/catalog-format";
import { variantLabel } from "@/lib/quick-view-model";
import { useCart } from "./cart-provider";
import { useModal } from "./use-modal";

/** Side panel with the cart. Paying happens in Tienda: the cart travels there in the link. */
export function CartDrawer() {
  const {
    cart,
    count,
    busy,
    error,
    drawerOpen,
    checkoutUrl,
    currency,
    closeDrawer,
    setQuantity,
    removeItem,
  } = useCart();
  const panel = useRef<HTMLElement>(null);
  useModal(drawerOpen, closeDrawer, panel);
  if (!drawerOpen) return null;

  const items = cart?.items ?? [];
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.subtotal ?? item.unit_price * item.quantity),
    0,
  );

  return (
    <div
      className="overlay"
      onMouseDown={(event) => event.target === event.currentTarget && closeDrawer()}
    >
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        ref={panel}
        tabIndex={-1}
      >
        <header className="drawer-head">
          <h2 id="cart-title">
            Tu carrito <span>{count ? `(${count})` : ""}</span>
          </h2>
          <button
            type="button"
            className="icon-button"
            onClick={closeDrawer}
            aria-label="Cerrar el carrito"
          >
            <Icon name="close" size={20} />
          </button>
        </header>

        {error ? (
          <p className="inline-alert" role="alert">
            {error}
          </p>
        ) : null}

        {items.length ? (
          <ul className="cart-lines">
            {items.map((item) => {
              const title = item.product_title || item.title;
              const variant = variantLabel(item.variant_title);
              return (
                <li key={item.id} className="cart-line">
                  <div className="cart-thumb">
                    {item.thumbnail ? (
                      <Image src={item.thumbnail} alt="" fill unoptimized sizes="72px" />
                    ) : (
                      <Icon name="package" size={22} />
                    )}
                  </div>
                  <div className="cart-info">
                    <p className="cart-title">{title}</p>
                    {variant !== "Variante única" ? (
                      <p className="cart-variant">{variant}</p>
                    ) : null}
                    <div className="cart-controls">
                      <div className="stepper" role="group" aria-label={`Cantidad de ${title}`}>
                        <button
                          type="button"
                          disabled={busy || item.quantity <= 1}
                          onClick={() => void setQuantity(item.id, item.quantity - 1)}
                          aria-label="Quitar una unidad"
                        >
                          <Icon name="minus" size={14} />
                        </button>
                        <span aria-live="polite">{item.quantity}</span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void setQuantity(item.id, item.quantity + 1)}
                          aria-label="Añadir una unidad"
                        >
                          <Icon name="plus" size={14} />
                        </button>
                      </div>
                      <button
                        type="button"
                        className="text-button"
                        disabled={busy}
                        onClick={() => void removeItem(item.id)}
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                  <p className="cart-price">
                    {formatPrice(
                      Number(item.subtotal ?? item.unit_price * item.quantity),
                      currency,
                    )}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="drawer-empty">
            <Icon name="shoppingBag" size={28} />
            <h3>Tu carrito está vacío</h3>
            <p>Agrega productos desde el catálogo y paga en un solo paso.</p>
            <button type="button" className="btn btn-secondary" onClick={closeDrawer}>
              Seguir explorando
            </button>
          </div>
        )}

        {items.length ? (
          <footer className="drawer-foot">
            <p className="drawer-total">
              <span>Subtotal</span>
              <strong>{formatPrice(subtotal, currency)}</strong>
            </p>
            <p className="drawer-note">
              El envío y el pago se completan en la app de compra, con el carrito que ya armaste.
            </p>
            {checkoutUrl ? (
              <a className="btn btn-primary" href={checkoutUrl}>
                Ir a pagar <Icon name="arrowRight" size={14} />
              </a>
            ) : null}
          </footer>
        ) : null}
      </aside>
    </div>
  );
}

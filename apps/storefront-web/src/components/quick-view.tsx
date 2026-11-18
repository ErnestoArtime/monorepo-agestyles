"use client";

import Link from "next/link";
import { Icon } from "@agestyles/icons";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { QuickViewData } from "@/lib/quick-view-model";
import { ProductGallery } from "./product-gallery";
import { PurchasePanel } from "./purchase-panel";
import { useModal } from "./use-modal";

export type QuickViewTarget = {
  handle: string;
  title: string;
  thumbnail?: string | null;
  category?: string | null;
};

type QuickViewContextValue = { open: (target: QuickViewTarget) => void };
const QuickViewContext = createContext<QuickViewContextValue | null>(null);

const loaded = new Map<string, QuickViewData>();

function excerpt(text: string | null, max = 240): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
}

/**
 * Product preview in a dialog, as in the previous AgeStyles site: look, choose and add without
 * leaving the list. «Ver ficha completa» leads to the full page for the details.
 */
export function QuickViewProvider({
  buyerAppUrl,
  children,
}: {
  buyerAppUrl: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  // The dialog belongs to the page it was opened on, so navigating away closes it.
  const [opened, setOpened] = useState<{ target: QuickViewTarget; path: string } | null>(null);
  const target = opened && opened.path === pathname ? opened.target : null;
  const [fetched, setFetched] = useState<{ handle: string; data: QuickViewData | null } | null>(
    null,
  );
  const [attempt, setAttempt] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const handle = target?.handle;

  const close = useCallback(() => setOpened(null), []);
  useModal(target !== null, close, panel);

  const cached = handle ? loaded.get(handle) : undefined;
  const result = handle && fetched?.handle === handle ? fetched : null;
  const data = cached ?? result?.data ?? null;
  const state: "loading" | "ready" | "error" = data ? "ready" : result ? "error" : "loading";

  useEffect(() => {
    if (!handle || loaded.has(handle)) return;
    const controller = new AbortController();
    fetch(`/api/quick-view/${encodeURIComponent(handle)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("quick-view");
        const next = (await response.json()) as QuickViewData;
        loaded.set(handle, next);
        setFetched({ handle, data: next });
      })
      .catch((cause) => {
        if ((cause as { name?: string }).name !== "AbortError") setFetched({ handle, data: null });
      });
    return () => controller.abort();
  }, [handle, attempt]);

  const value = useMemo<QuickViewContextValue>(
    () => ({
      open: (next) => {
        setFetched(null);
        setOpened({ target: next, path: pathname });
      },
    }),
    [pathname],
  );
  const product = data?.product;
  const title = product?.title ?? target?.title ?? "";
  const images = product?.images.length
    ? product.images
    : target?.thumbnail
      ? [target.thumbnail]
      : [];
  const ficha = target ? `/productos/${encodeURIComponent(target.handle)}` : "#";

  return (
    <QuickViewContext.Provider value={value}>
      {children}
      {target ? (
        <div
          className="overlay"
          onMouseDown={(event) => event.target === event.currentTarget && close()}
        >
          <div
            className="quick-view"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-view-title"
            ref={panel}
            tabIndex={-1}
          >
            <button
              type="button"
              className="icon-button quick-close"
              onClick={close}
              aria-label="Cerrar la vista rápida"
            >
              <Icon name="close" size={20} />
            </button>
            <ProductGallery images={images} alt={title} />
            <div className="quick-body">
              <p className="eyebrow">
                {product?.category ?? target.category ?? "SELECCIÓN AGESTYLES"}
              </p>
              <h2 id="quick-view-title">{title}</h2>
              {state === "loading" ? (
                <p className="quick-loading" role="status">
                  Cargando las opciones…
                </p>
              ) : null}
              {state === "error" ? (
                <div className="quick-error" role="alert">
                  <p>No pudimos cargar las opciones de este producto.</p>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setFetched(null);
                      setAttempt((value) => value + 1);
                    }}
                  >
                    Reintentar
                  </button>
                </div>
              ) : null}
              {data ? (
                <>
                  {data.product.description ? (
                    <p className="quick-description">{excerpt(data.product.description)}</p>
                  ) : null}
                  <PurchasePanel
                    key={data.product.id}
                    data={data}
                    buyerAppUrl={buyerAppUrl}
                    onAdded={close}
                  />
                </>
              ) : null}
              <Link className="quick-ficha" href={ficha} onClick={close}>
                Ver ficha completa <Icon name="arrowRight" size={14} />
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </QuickViewContext.Provider>
  );
}

export function useQuickView(): QuickViewContextValue {
  const value = useContext(QuickViewContext);
  if (!value) throw new Error("useQuickView needs a QuickViewProvider.");
  return value;
}

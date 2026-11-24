"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { trackProductEvent, type ApiConfig } from "@/lib/product-events";

/**
 * Anonymous view events for the public catalog (AG-59). Each tracker
 * fires once per mount; the API also ignores a repeat from the same visit
 * inside a minute. A product page with several sellers fires one
 * `product_view` per seller, so each store's traffic is its own.
 */

export function ProductViewTracker({
  config,
  productId,
  sellerIds,
}: {
  config: ApiConfig;
  productId: string;
  sellerIds: string[];
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    for (const sellerId of sellerIds) {
      trackProductEvent(config, {
        product_id: productId,
        seller_id: sellerId,
        type: "product_view",
        surface: "vitrina",
      });
    }
  }, [config, productId, sellerIds]);
  return null;
}

export function StoreViewTracker({ config, sellerId }: { config: ApiConfig; sellerId: string }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackProductEvent(config, {
      product_id: null,
      seller_id: sellerId,
      type: "store_view",
      surface: "vitrina",
    });
  }, [config, sellerId]);
  return null;
}

/** Link from a product page to its store: the click itself is a `product_click`. */
export function ProductStoreLink({
  config,
  href,
  productId,
  sellerId,
  children,
}: {
  config: ApiConfig;
  href: string;
  productId: string;
  sellerId: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={() =>
        trackProductEvent(config, {
          product_id: productId,
          seller_id: sellerId,
          type: "product_click",
          surface: "vitrina",
        })
      }
    >
      {children}
    </Link>
  );
}

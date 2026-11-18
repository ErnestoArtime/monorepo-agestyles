"use client";

import Image from "next/image";
import Link from "next/link";
import { Icon } from "@agestyles/icons";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useId, useRef, useState } from "react";
import type { PublicProductCategory } from "@/lib/catalog";
import { useCart } from "./cart-provider";

type Section = "catalogos" | "novedades" | "tiendas" | null;

/** Which menu entry the current address belongs to. */
function sectionOf(pathname: string): Section {
  if (pathname === "/" || pathname.startsWith("/productos") || pathname.startsWith("/comparar")) {
    return "catalogos";
  }
  if (pathname.startsWith("/novedades")) return "novedades";
  if (pathname.startsWith("/tiendas")) return "tiendas";
  return null;
}

const categoryHref = (handle: string) => `/?category=${encodeURIComponent(handle)}#catalogo`;

function SearchBox({ id }: { id: string }) {
  const params = useSearchParams();
  return (
    <form className="chrome-search" action="/" method="get" role="search">
      <Icon name="search" size={16} />
      <input
        id={id}
        name="q"
        type="search"
        aria-label="Buscar productos"
        placeholder="Buscar productos"
        defaultValue={params.get("q") ?? ""}
        key={params.get("q") ?? ""}
      />
    </form>
  );
}

function SearchFallback({ id }: { id: string }) {
  return (
    <form className="chrome-search" action="/" method="get" role="search">
      <Icon name="search" size={16} />
      <input
        id={id}
        name="q"
        type="search"
        aria-label="Buscar productos"
        placeholder="Buscar productos"
      />
    </form>
  );
}

/**
 * The one navigation every page shares: Catálogos (with the categories), Novedades and Tiendas,
 * a search that works from anywhere and the cart.
 */
export function SiteNav({ categories }: { categories: PublicProductCategory[] }) {
  const pathname = usePathname();
  const active = sectionOf(pathname);
  const cart = useCart();
  // Remember where each menu was opened: navigating elsewhere closes it without an effect.
  const [menuAt, setMenuAt] = useState<string | null>(null);
  const [mobileAt, setMobileAt] = useState<string | null>(null);
  const menuOpen = menuAt === pathname;
  const mobileOpen = mobileAt === pathname;
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const searchId = useId();

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuAt(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuAt(null);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const current = (section: Exclude<Section, null>) => (active === section ? "page" : undefined);

  return (
    <div className="chrome">
      <div className="chrome-bar">
        <Link href="/" className="brand" aria-label="AgeStyles, inicio">
          <Image src="/agestyles-mark.svg" alt="" width={34} height={34} priority />
          <span>AgeStyles</span>
        </Link>

        <nav className="chrome-nav" aria-label="Navegación principal">
          <div
            className="nav-dropdown"
            ref={menuRef}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") setMenuAt(pathname);
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") setMenuAt(null);
            }}
          >
            <button
              type="button"
              className={active === "catalogos" ? "nav-link is-active" : "nav-link"}
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuAt(menuOpen ? null : pathname)}
            >
              Catálogos <Icon name="chevronDown" size={14} />
            </button>
            {menuOpen ? (
              <div className="nav-menu" id={menuId}>
                <Link href="/#catalogo" className="nav-menu-all">
                  Todos los productos <Icon name="arrowRight" size={13} />
                </Link>
                {categories.length ? (
                  <ul>
                    {categories.map((category) => (
                      <li key={category.id}>
                        <Link href={categoryHref(category.handle)}>{category.name}</Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
          <Link
            href="/novedades"
            className={active === "novedades" ? "nav-link is-active" : "nav-link"}
            aria-current={current("novedades")}
          >
            Novedades
          </Link>
          <Link
            href="/tiendas"
            className={active === "tiendas" ? "nav-link is-active" : "nav-link"}
            aria-current={current("tiendas")}
          >
            Tiendas
          </Link>
        </nav>

        <div className="chrome-actions">
          <div className="chrome-search-desktop">
            <Suspense fallback={<SearchFallback id={`${searchId}-d`} />}>
              <SearchBox id={`${searchId}-d`} />
            </Suspense>
          </div>
          <button
            type="button"
            className="icon-button cart-button"
            onClick={cart.openDrawer}
            aria-label={
              cart.count
                ? `Abrir el carrito, ${cart.count} ${cart.count === 1 ? "producto" : "productos"}`
                : "Abrir el carrito"
            }
          >
            <Icon name="shoppingBag" size={20} />
            {cart.count ? (
              <span className="badge">{cart.count > 99 ? "99+" : cart.count}</span>
            ) : null}
          </button>
          <button
            type="button"
            className="icon-button menu-toggle"
            onClick={() => setMobileAt(mobileOpen ? null : pathname)}
            aria-expanded={mobileOpen}
            aria-controls={`${menuId}-mobile`}
            aria-label={mobileOpen ? "Cerrar el menú" : "Abrir el menú"}
          >
            <Icon name={mobileOpen ? "close" : "menu"} size={22} />
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="mobile-panel" id={`${menuId}-mobile`}>
          <Suspense fallback={<SearchFallback id={`${searchId}-m`} />}>
            <SearchBox id={`${searchId}-m`} />
          </Suspense>
          <nav aria-label="Navegación principal">
            <p className="mobile-heading">Catálogos</p>
            <ul className="mobile-categories">
              <li>
                <Link href="/#catalogo">Todos los productos</Link>
              </li>
              {categories.map((category) => (
                <li key={category.id}>
                  <Link href={categoryHref(category.handle)}>{category.name}</Link>
                </li>
              ))}
            </ul>
            <Link href="/novedades" className="mobile-link" aria-current={current("novedades")}>
              Novedades
            </Link>
            <Link href="/tiendas" className="mobile-link" aria-current={current("tiendas")}>
              Tiendas
            </Link>
          </nav>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const storageKey = "agestyles.catalog-comparison.v1";
const changeEvent = "agestyles:catalog-comparison-change";
const maxProducts = 4;

function readSelection() {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
    return Array.isArray(value)
      ? [...new Set(value.filter((id): id is string => typeof id === "string"))].slice(
          0,
          maxProducts,
        )
      : [];
  } catch {
    return [];
  }
}

function writeSelection(ids: string[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(ids));
  window.dispatchEvent(new Event(changeEvent));
}

function useSelection() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setIds(readSelection());
    sync();
    window.addEventListener(changeEvent, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(changeEvent, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return ids;
}

export function ProductComparisonToggle({ productId }: { productId: string }) {
  const ids = useSelection();
  const selected = ids.includes(productId);
  const [notice, setNotice] = useState("");

  function toggle() {
    setNotice("");
    if (selected) {
      writeSelection(ids.filter((id) => id !== productId));
    } else if (ids.length >= maxProducts) {
      setNotice("Puedes comparar hasta 4 productos.");
    } else {
      writeSelection([...ids, productId]);
    }
  }

  return (
    <span className="comparison-toggle-wrap">
      <button
        className={selected ? "comparison-toggle is-selected" : "comparison-toggle"}
        type="button"
        onClick={toggle}
        aria-pressed={selected}
        aria-label={selected ? "Quitar producto de la comparación" : "Añadir a la comparación"}
      >
        {selected ? "En comparación" : "Comparar producto"}
      </button>
      {notice ? (
        <span className="comparison-notice" role="status">
          {notice}
        </span>
      ) : null}
    </span>
  );
}

export function ProductComparisonBar() {
  const ids = useSelection();
  if (!ids.length) return null;
  const ready = ids.length >= 2;
  const href = `/comparar?ids=${encodeURIComponent(ids.join(","))}`;

  return (
    <aside className="comparison-bar" aria-label="Productos seleccionados para comparar">
      <p>
        {ids.length} de {maxProducts} productos seleccionados
        {!ready ? " · Añade al menos otro producto" : ""}
      </p>
      <div className="comparison-bar-actions">
        {ready ? (
          <Link className="button button-dark" href={href}>
            Ver comparación
          </Link>
        ) : (
          <span className="comparison-bar-hint">Selecciona otro producto</span>
        )}
        <button className="comparison-clear" onClick={() => writeSelection([])} type="button">
          Vaciar
        </button>
      </div>
    </aside>
  );
}

"use client";

import { useEffect, useRef } from "react";

/**
 * Tooltip global por delegación de eventos.
 * Cualquier elemento con `data-tooltip="texto\nlínea2"` en la página
 * mostrará este tooltip al hacer hover. Usar `white-space: pre-line` en CSS.
 */
export function HoverTooltip() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let currentTarget: Element | null = null;

    const move = (e: MouseEvent) => {
      const td = (e.target as Element).closest("[data-tooltip]");

      if (td !== currentTarget) {
        currentTarget = td;
        if (td) {
          el.textContent = td.getAttribute("data-tooltip") ?? "";
          el.style.display = "block";
        } else {
          el.style.display = "none";
          return;
        }
      }

      if (!td) return;

      // Posicionar junto al cursor, evitando salirse del viewport.
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let left = e.clientX + 14;
      let top = e.clientY - h / 2;

      if (left + w > vw - 12) left = e.clientX - w - 14;
      if (top < 8) top = 8;
      if (top + h > vh - 8) top = vh - h - 8;

      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
    };

    document.addEventListener("mousemove", move);
    return () => document.removeEventListener("mousemove", move);
  }, []);

  return <div ref={ref} className="hover-tooltip" style={{ display: "none" }} aria-hidden />;
}

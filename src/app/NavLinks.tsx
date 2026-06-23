"use client";

import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Resumen", base: "/" },
  { href: "/calendar/matrix", label: "Calendario", base: "/calendar" },
  { href: "/coverage", label: "Cobertura", base: "/coverage" },
  { href: "/engagements", label: "Engagements", base: "/engagements" },
  { href: "/consultants", label: "Consultores", base: "/consultants" },
  { href: "/holidays", label: "Feriados", base: "/holidays" },
  { href: "/history", label: "Historial", base: "/history" },
];

export default function NavLinks() {
  const pathname = usePathname();

  const isActive = (base: string) =>
    base === "/" ? pathname === "/" : pathname.startsWith(base);

  return (
    <>
      {LINKS.map((l) => (
        <a key={l.href} href={l.href} className={`nav-link${isActive(l.base) ? " active" : ""}`}>
          {l.label}
        </a>
      ))}
    </>
  );
}

"use client";

import dynamic from "next/dynamic";
import type { TrendPoint, RankTrendPoint, TypeTrendPoint, LineConfig } from "./DashboardCharts";

// En un Client Component sí se puede usar ssr: false
const TrendChart = dynamic(
  () => import("./DashboardCharts").then((m) => m.TrendChart),
  { ssr: false, loading: () => <div className="chart-loading" /> }
);
const RankTrendChart = dynamic(
  () => import("./DashboardCharts").then((m) => m.RankTrendChart),
  { ssr: false, loading: () => <div className="chart-loading" /> }
);
const TypeTrendChart = dynamic(
  () => import("./DashboardCharts").then((m) => m.TypeTrendChart),
  { ssr: false, loading: () => <div className="chart-loading" /> }
);

export function ChartsSection({
  trend,
  rankTrend,
  typeTrend,
  activeRanks,
  typeLines,
}: {
  trend: TrendPoint[];
  rankTrend: RankTrendPoint[];
  typeTrend: TypeTrendPoint[];
  activeRanks: LineConfig[];
  typeLines: LineConfig[];
}) {
  return (
    <>
      {/* Tendencia global: 26 semanas */}
      <section className="chart-section">
        <h2>
          Utilización global{" "}
          <span className="chart-subtitle">próximas 26 semanas · horas asignadas / capacidad</span>
        </h2>
        <div className="chart-card">
          <TrendChart data={trend} />
        </div>
      </section>

      {/* Tendencia por rank */}
      <section className="chart-section">
        <h2>
          Tendencia por rank
          <span className="chart-subtitle"> · % asignado / capacidad por rank</span>
        </h2>
        <div className="chart-card">
          <RankTrendChart data={rankTrend} lines={activeRanks} />
        </div>
      </section>

      {/* Tendencia por tipo */}
      <section className="chart-section">
        <h2>
          Tendencia por tipo de asignación
          <span className="chart-subtitle"> · % de capacidad total del equipo</span>
        </h2>
        <div className="chart-card">
          <TypeTrendChart data={typeTrend} lines={typeLines} />
        </div>
      </section>
    </>
  );
}

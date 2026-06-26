// Skeleton UI for the Dashboard (Resumen) while data loads

export default function DashboardLoading() {
  return (
    <main>
      <div className="page-loading-bar" />

      {/* Title + subtitle */}
      <div className="skeleton-title" />
      <div className="skeleton-line" style={{ width: 210, marginBottom: 28 }} />

      {/* Week bar */}
      <div className="skeleton-bar" />

      {/* KPI grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "1rem",
          margin: "1.75rem 0",
        }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card" style={{ height: 90, padding: "1.1rem 1.25rem" }}>
            <div className="skeleton-line" style={{ width: "65%", marginBottom: 14 }} />
            <div className="skeleton-line" style={{ height: 28, width: "42%" }} />
          </div>
        ))}
      </div>

      {/* Utilization table */}
      <section>
        <div className="skeleton-title" style={{ height: 20, width: 190, marginBottom: 16 }} />
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="skeleton-row" />
        ))}
      </section>

      {/* Unassigned section */}
      <section>
        <div className="skeleton-title" style={{ height: 20, width: 160, marginBottom: 16 }} />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-row" />
        ))}
      </section>
    </main>
  );
}

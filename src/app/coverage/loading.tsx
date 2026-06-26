// Skeleton UI for the Coverage page while data loads

export default function CoverageLoading() {
  return (
    <main>
      <div className="page-loading-bar" />

      {/* Title */}
      <div className="skeleton-title" />

      {/* Week bar */}
      <div className="skeleton-bar" />

      {/* Coverage cards */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="card"
          style={{ marginBottom: "1.5rem", padding: "1.25rem 1.5rem" }}
        >
          {/* Card header: engagement name + badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
            <div className="skeleton-line" style={{ width: "40%", height: 18 }} />
            <div className="skeleton-line" style={{ width: 72, height: 22, borderRadius: 99 }} />
          </div>
          {/* Coverage rows */}
          <div className="skeleton-row" style={{ height: 36, marginBottom: 6 }} />
          <div className="skeleton-row" style={{ height: 36, marginBottom: 6 }} />
          <div className="skeleton-row" style={{ height: 36 }} />
        </div>
      ))}
    </main>
  );
}

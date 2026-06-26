// Skeleton UI for the History page while data loads

export default function HistoryLoading() {
  return (
    <main>
      <div className="page-loading-bar" />

      {/* Title */}
      <div className="skeleton-title" />

      {/* Snapshots section */}
      <section>
        <div className="skeleton-title" style={{ height: 20, width: 200, marginBottom: 16 }} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton-row" />
        ))}
      </section>

      {/* Audit log section */}
      <section>
        <div className="skeleton-title" style={{ height: 20, width: 160, marginBottom: 16 }} />
        {/* Filter tabs */}
        <div className="skeleton-bar" style={{ height: 40, marginBottom: 16 }} />
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="skeleton-row" />
        ))}
      </section>
    </main>
  );
}

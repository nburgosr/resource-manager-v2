// Skeleton UI for the Consultants list while data loads

export default function ConsultantsLoading() {
  return (
    <main>
      <div className="page-loading-bar" />

      {/* Title + subtitle */}
      <div className="skeleton-title" />
      <div className="skeleton-line" style={{ width: 240, marginBottom: 28 }} />

      {/* Consultant table rows */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="skeleton-row" />
      ))}
    </main>
  );
}

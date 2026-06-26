// Skeleton UI for the Engagements list while data loads

export default function EngagementsLoading() {
  return (
    <main>
      <div className="page-loading-bar" />

      {/* Title + subtitle */}
      <div className="skeleton-title" />
      <div className="skeleton-line" style={{ width: 220, marginBottom: 28 }} />

      {/* Engagement table rows */}
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="skeleton-row" />
      ))}
    </main>
  );
}

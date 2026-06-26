// Skeleton UI for the Holidays page while data loads

export default function HolidaysLoading() {
  return (
    <main>
      <div className="page-loading-bar" />

      {/* Title + subtitle */}
      <div className="skeleton-title" />
      <div className="skeleton-line" style={{ width: 200, marginBottom: 28 }} />

      {/* Holiday table rows */}
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="skeleton-row" />
      ))}
    </main>
  );
}

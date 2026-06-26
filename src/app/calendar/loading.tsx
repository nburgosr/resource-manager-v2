// Skeleton UI for the Calendar while data loads

export default function CalendarLoading() {
  return (
    <main className="wide">
      <div className="page-loading-bar" />

      {/* Title */}
      <div className="skeleton-title" />

      {/* Week bar */}
      <div className="skeleton-bar" />

      {/* Consultant rows */}
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i} className="skeleton-row" style={{ marginBottom: 6 }} />
      ))}
    </main>
  );
}

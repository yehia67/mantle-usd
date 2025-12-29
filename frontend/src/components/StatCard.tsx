export function StatCard({ label, value, suffix }: { label: string; value: string | number; suffix?: string }) {
  return (
    <div className="card stat-card">
      <div className="stat-value">
        {value}{suffix && <span className="text-sm text-secondary"> {suffix}</span>}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

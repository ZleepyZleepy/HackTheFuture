export default function MemoryPage() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Memory</h1>
      <p className="text-sm text-gray-600">
        Outcomes + feedback will live here (approved alternates, actual lead
        times, quality issues, what worked).
      </p>

      <div className="rounded-xl border bg-white p-5 shadow-sm text-sm text-gray-700">
        No records yet. After we add the backend, each event will log a chosen
        plan and outcome metrics.
      </div>
    </div>
  );
}
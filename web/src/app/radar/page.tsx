import Link from "next/link";
import AuthGate from "@/components/AuthGate";

type DisruptionEvent = {
  id: string;
  title: string;
  type: "PortDelay" | "SupplierInsolvency" | "LeadTimeSpike";
  region: string;
  severity: "Low" | "Medium" | "High";
  createdAt: string;
  status: "New" | "Investigating" | "Mitigating";
};

const events: DisruptionEvent[] = [
  {
    id: "evt_001",
    title: "Red Sea lane disruption impacting Supplier A",
    type: "PortDelay",
    region: "EMEA → NA",
    severity: "High",
    createdAt: "2026-02-28 09:12",
    status: "Investigating",
  },
  {
    id: "evt_002",
    title: "Supplier K missed 3 ASNs (cashflow stress signal)",
    type: "SupplierInsolvency",
    region: "APAC",
    severity: "Medium",
    createdAt: "2026-02-27 16:40",
    status: "New",
  },
  {
    id: "evt_003",
    title: "Lead time spike for MCU-112 (8w → 22w)",
    type: "LeadTimeSpike",
    region: "NA",
    severity: "High",
    createdAt: "2026-02-26 11:05",
    status: "Mitigating",
  },
];

function Badge({ text }: { text: string }) {
  return (
    <span className="rounded-full border bg-white px-2 py-0.5 text-xs text-gray-700">
      {text}
    </span>
  );
}

export default function RadarPage() {
  return (
    <AuthGate>
      <div className="space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Disruption Radar</h1>
            <p className="text-sm text-gray-600">
              Live signals → mapped to suppliers → BOM risk → mitigation plans.
            </p>
          </div>

          <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            Simulate new disruption
          </button>
        </div>

        <div className="grid gap-4">
          {events.map((e) => (
            <Link
              key={e.id}
              href={`/event/${e.id}`}
              className="rounded-xl border bg-white p-5 shadow-sm hover:shadow"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-sm text-gray-500">{e.id}</div>
                  <div className="text-base font-semibold">{e.title}</div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge text={e.type} />
                    <Badge text={`Region: ${e.region}`} />
                    <Badge text={`Severity: ${e.severity}`} />
                    <Badge text={`Status: ${e.status}`} />
                  </div>
                </div>

                <div className="text-sm text-gray-500">{e.createdAt}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AuthGate>
  );
}
import Link from "next/link";
import AuthGate from "@/components/AuthGate";
import AgentRunner from "./AgentRunner";

type Params = { params: Promise<{ id: string }> };

export default async function EventPage({ params }: Params) {
  const { id: eventId } = await params;

  // Stubbed example metrics (we'll compute these for real later)
  const impact = {
    topPart: "IC-778 (Power Regulator)",
    daysOfCover: 6,
    estLeadTimeDays: 28,
    lineStopInDays: 8,
    revenueAtRiskUsd: 420_000,
  };

  const actions = [
    {
      title: "Draft RFQ to Supplier B for alternate IC-778B",
      status: "Drafted",
    },
    {
      title: "Draft engineering deviation request (fast-track qualification)",
      status: "Drafted",
    },
    {
      title: "Flag ERP reorder: split PO 60/40 across suppliers",
      status: "Suggested",
    },
  ];

  return (
    <AuthGate>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-gray-500">
              <Link href="/radar" className="hover:underline">
                Radar
              </Link>{" "}
              / Event
            </div>
            <h1 className="text-2xl font-semibold">Event {eventId}</h1>
            <p className="text-sm text-gray-600">
              Impact mapping → alternate parts → trade-off plans → actions.
            </p>
          </div>
          <AgentRunner eventId={eventId} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Impact snapshot</h2>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Top constrained part</span>
                <span className="font-medium">{impact.topPart}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Days of cover</span>
                <span className="font-medium">{impact.daysOfCover} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Estimated lead time</span>
                <span className="font-medium">{impact.estLeadTimeDays} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Line-stop risk</span>
                <span className="font-medium">~{impact.lineStopInDays} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Revenue at risk</span>
                <span className="font-semibold">
                  ${impact.revenueAtRiskUsd.toLocaleString()}
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Actions</h2>
            <div className="mt-4 space-y-3">
              {actions.map((a) => (
                <div
                  key={a.title}
                  className="flex items-center justify-between rounded-lg border bg-gray-50 px-4 py-3 text-sm"
                >
                  <div className="font-medium">{a.title}</div>
                  <div className="text-gray-600">{a.status}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <button className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50">
                View drafts
              </button>
              <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:opacity-90">
                Approve & send (later)
              </button>
            </div>
          </section>
        </div>

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Reasoning trace (placeholder)</h2>
          <p className="mt-2 text-sm text-gray-600">
            We will show: supplier → parts → assemblies → risk scoring → alternate
            ranking → plan selection, with clear constraint checks and human
            override points.
          </p>
          <div className="mt-4 rounded-lg border bg-gray-50 p-4 text-sm text-gray-700">
            <div>• Detected disruption: lane delay affecting Supplier A</div>
            <div>• Found single-source parts: IC-778, MCU-112</div>
            <div>• IC-778 days-of-cover = 6, lead time = 28 → risk high</div>
            <div>• Candidate alternates ranked: IC-778B (spec match 0.91) …</div>
            <div>• Selected plan: substitute + fast-track qualification</div>
          </div>
        </section>
      </div>
    </AuthGate>
  );
}
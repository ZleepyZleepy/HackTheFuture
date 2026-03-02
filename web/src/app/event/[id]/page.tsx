import Link from "next/link";
import AuthGate from "@/components/AuthGate";
import AgentRunner from "./AgentRunner";
import EventView from "./EventView";

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
      <EventView
        eventId={eventId}
        initialImpact={impact}
        initialActions={actions}
      />
    </AuthGate>
  );
}
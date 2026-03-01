export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { eventId?: string };
  const eventId = body.eventId ?? "evt_unknown";

  // Mock “agent” output (deterministic for demo)
  const payload = {
    eventId,
    impact:
      eventId === "evt_001"
        ? {
            topPart: "IC-778 (Power Regulator)",
            daysOfCover: 6,
            estLeadTimeDays: 28,
            lineStopInDays: 8,
            revenueAtRiskUsd: 420000,
          }
        : {
            topPart: "MCU-112 (Microcontroller)",
            daysOfCover: 10,
            estLeadTimeDays: 21,
            lineStopInDays: 14,
            revenueAtRiskUsd: 180000,
          },

    alternates: [
      {
        part: "IC-778B",
        score: 0.91,
        notes: "Electrical spec match, package-compatible; needs quick validation.",
      },
      {
        part: "IC-778C",
        score: 0.84,
        notes: "Spec match ok; minor thermal derating; BOM note required.",
      },
      {
        part: "IC-778D",
        score: 0.76,
        notes: "Available stock; requires footprint change (higher re-qual cost).",
      },
    ],

    actions: [
      { title: "Draft RFQ to Supplier B for alternate IC-778B", status: "Drafted" },
      {
        title: "Draft engineering deviation request (fast-track qualification)",
        status: "Drafted",
      },
      { title: "Recommend PO split 60/40 across suppliers", status: "Suggested" },
    ],

    reasoningTrace: [
      "Detected disruption signal tied to Supplier A lane delay.",
      "Mapped affected supplier → constrained part(s) in BOM.",
      "Computed days-of-cover and lead-time gap → line-stop risk.",
      "Ranked alternates by spec match, availability, and re-qual cost.",
      "Selected plan: substitute + fast-track qualification + PO split.",
    ],
  };

  return Response.json(payload);
}
import Link from "next/link";
import AuthGate from "@/components/AuthGate";
import RadarView from "./RadarView";

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
      <RadarView events={events} />
    </AuthGate>
  );
}
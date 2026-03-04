export const runtime = "nodejs";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

let runCounter = 0;

type BomRow = {
  part: string;
  description?: string;
  supplier?: string;
  qty?: number;
};

type DisruptionType = "PortDelay" | "SupplierInsolvency" | "LeadTimeSpike";
type Severity = "Low" | "Medium" | "High";

type DisruptionProfile = {
  id: string;
  title: string;
  type: DisruptionType;
  severity: Severity;
  region?: string;
  disruptedSupplier?: string;
  partHint?: string;
};

const mockEvents: Record<string, DisruptionProfile> = {
  evt_001: {
    id: "evt_001",
    title: "Red Sea lane disruption impacting Supplier A",
    type: "PortDelay",
    severity: "High",
    region: "EMEA → NA",
    disruptedSupplier: "Supplier A",
  },
  evt_002: {
    id: "evt_002",
    title: "Supplier K missed 3 ASNs (cashflow stress signal)",
    type: "SupplierInsolvency",
    severity: "Medium",
    region: "APAC",
    disruptedSupplier: "Supplier K",
  },
  evt_003: {
    id: "evt_003",
    title: "Lead time spike for MCU-112 (8w → 22w)",
    type: "LeadTimeSpike",
    severity: "High",
    region: "NA",
    partHint: "MCU-112",
  },
};

function norm(s: unknown) {
  return String(s ?? "").trim().toLowerCase();
}

function clampInt(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function pickTopRow(rows: BomRow[]): BomRow | null {
  if (!rows.length) return null;
  let best = rows[0];
  let bestQty = Number(best.qty ?? 0) || 0;
  for (const r of rows) {
    const q = Number(r.qty ?? 0) || 0;
    if (q > bestQty) {
      best = r;
      bestQty = q;
    }
  }
  return best;
}

function leadTimeDaysFor(type: DisruptionType) {
  if (type === "PortDelay") return 28;
  if (type === "SupplierInsolvency") return 45;
  return 154; // LeadTimeSpike: ~22w
}

function severityWeight(sev: Severity) {
  if (sev === "Low") return 1.0;
  if (sev === "Medium") return 1.4;
  return 2.0;
}

// -------- Gemini structured output schema --------
const agentOutSchema = z.object({
  alternates: z
    .array(
      z.object({
        part: z.string(),
        score: z.number().min(0).max(1),
        notes: z.string(),
      })
    )
    .min(3)
    .max(3),
  actions: z
    .array(
      z.object({
        title: z.string(),
        status: z.enum(["Drafted", "Suggested"]),
      })
    )
    .min(3)
    .max(3),
  reasoningTrace: z.array(z.string()).min(3).max(8),
});

async function geminiSuggest(input: {
  profile: DisruptionProfile;
  topPart: string;
  affectedParts: string[];
  impact: {
    daysOfCover: number;
    estLeadTimeDays: number;
    lineStopInDays: number;
    revenueAtRiskUsd: number;
  };
}) {
  // If no key set, skip gracefully
  if (!process.env.GEMINI_API_KEY) return null;

  const ai = new GoogleGenAI({}); // reads GEMINI_API_KEY from env

  const prompt = `
You are Vast, an AI-powered supply chain risk agent.
Return JSON ONLY that matches the given schema.

Context:
- Disruption: "${input.profile.title}"
- Type: ${input.profile.type}, Severity: ${input.profile.severity}, Region: ${input.profile.region ?? "N/A"}
- Match mode: ${
    input.profile.partHint
      ? `partHint=${input.profile.partHint}`
      : input.profile.disruptedSupplier
        ? `supplier=${input.profile.disruptedSupplier}`
        : "none"
  }
- Computed impact (heuristic demo numbers): daysOfCover=${input.impact.daysOfCover}, estLeadTimeDays=${input.impact.estLeadTimeDays}, lineStopInDays=${input.impact.lineStopInDays}, revenueAtRiskUsd=${input.impact.revenueAtRiskUsd}
- Top constrained part: ${input.topPart}
- Affected parts (up to 25): ${input.affectedParts.join(", ") || "none"}

Requirements:
- Produce exactly 3 alternate candidates. Keep them plausible but clearly "requires verification"; do NOT claim real datasheet certainty.
- Produce exactly 3 actions (procurement + engineering + ERP-ish).
- Produce 3–8 reasoningTrace bullets that explain the logic and reference the above numbers.
`;

  // Manual JSON schema to avoid TS/Zod version conflicts
  const agentOutJsonSchema = {
    type: "object",
    additionalProperties: false,
    required: ["alternates", "actions", "reasoningTrace"],
    properties: {
      alternates: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["part", "score", "notes"],
          properties: {
            part: { type: "string" },
            score: { type: "number", minimum: 0, maximum: 1 },
            notes: { type: "string" },
          },
        },
      },
      actions: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "status"],
          properties: {
            title: { type: "string" },
            status: { type: "string", enum: ["Drafted", "Suggested"] },
          },
        },
      },
      reasoningTrace: {
        type: "array",
        minItems: 3,
        maxItems: 8,
        items: { type: "string" },
      },
    },
  } as const;

  const resp = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: agentOutJsonSchema as any,
      temperature: 0.3,
    },
  });

  const raw = resp.text;
  if (!raw) throw new Error("Gemini returned empty response text");

  const parsed = agentOutSchema.parse(JSON.parse(raw));
  return parsed;
} // ✅ IMPORTANT: closes geminiSuggest properly

function computeFromBom(profile: DisruptionProfile, bomRows: BomRow[]) {
  const hasBom = Array.isArray(bomRows) && bomRows.length > 0;

  const supplierKey = norm(profile.disruptedSupplier);
  const partKey = norm(profile.partHint);

  const affected = hasBom
    ? bomRows.filter((r) => {
        const p = norm(r.part);
        const d = norm(r.description);
        const s = norm(r.supplier);

        if (partKey) return p.includes(partKey) || d.includes(partKey);
        if (supplierKey) return s.includes(supplierKey);
        return false;
      })
    : [];

  const scoped = affected.length ? affected : bomRows;
  const top = pickTopRow(scoped);

  const affectedQty = affected.reduce((sum, r) => sum + (Number(r.qty ?? 0) || 0), 0);
  const scopeQty = scoped.reduce((sum, r) => sum + (Number(r.qty ?? 0) || 0), 0);

  const w = severityWeight(profile.severity);
  const estLeadTimeDays = leadTimeDaysFor(profile.type);

  const qtySignal = Math.log1p((affected.length ? affectedQty : scopeQty) + 1);
  const daysOfCover = clampInt(18 - w * 4 - qtySignal * 2.2, 3, 30);

  const expectedDowntimeDays = Math.max(0, estLeadTimeDays - daysOfCover);
  const revenueAtRiskUsd = Math.round(expectedDowntimeDays * 10000 * w * (1 + qtySignal / 3));

  const topPartLabel = top
    ? top.description
      ? `${top.part} (${top.description})`
      : top.part
    : "—";

  const reasoningTrace: string[] = [];
  reasoningTrace.push(`Loaded BOM rows provided by client: ${hasBom ? bomRows.length : 0}.`);
  if (partKey) reasoningTrace.push(`Event match mode: part hint "${profile.partHint}".`);
  else if (supplierKey) reasoningTrace.push(`Event match mode: disrupted supplier "${profile.disruptedSupplier}".`);
  else reasoningTrace.push("Event match mode: none (fallback to top usage part).");

  reasoningTrace.push(
    affected.length
      ? `Matched ${affected.length} BOM row(s) directly impacted by this disruption.`
      : "No direct BOM match found; using overall top usage part for demo continuity."
  );

  reasoningTrace.push(
    `Computed days-of-cover (${daysOfCover}) vs estimated lead time (${estLeadTimeDays}d) → downtime ${expectedDowntimeDays}d.`
  );

  return {
    impact: {
      topPart: topPartLabel,
      daysOfCover,
      estLeadTimeDays,
      lineStopInDays: Math.max(1, daysOfCover - 2),
      revenueAtRiskUsd,
    },
    reasoningTrace,
    affectedCount: affected.length,
    affectedParts: affected.slice(0, 25).map((r) => r.part),
  };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    eventId?: string;
    bomRows?: BomRow[];
  };

  const eventId = body.eventId ?? "evt_unknown";
  const bomRows = Array.isArray(body.bomRows) ? body.bomRows : [];

  runCounter += 1;

  const profile: DisruptionProfile =
    mockEvents[eventId] ??
    ({
      id: eventId,
      title: "Unknown disruption",
      type: "PortDelay",
      severity: "Medium",
    } satisfies DisruptionProfile);

  const computed = computeFromBom(profile, bomRows);

  // Default (fallback) if Gemini is unavailable
  const fallbackAlternates = [
    { part: "ALT-1", score: 0.9, notes: "Fallback alternate (Gemini disabled/unavailable)." },
    { part: "ALT-2", score: 0.82, notes: "Fallback alternate (Gemini disabled/unavailable)." },
    { part: "ALT-3", score: 0.74, notes: "Fallback alternate (Gemini disabled/unavailable)." },
  ];
  const fallbackActions = [
    { title: "Draft RFQ / expedite outreach", status: "Drafted" as const },
    { title: "Draft engineering deviation / qualification request", status: "Drafted" as const },
    { title: "Suggest ERP flags: pull-in date, split PO, buffer stock build", status: "Suggested" as const },
  ];

  let alternates = fallbackAlternates;
  let actions = fallbackActions;
  let reasoningTrace = computed.reasoningTrace;

  try {
    const aiOut = await geminiSuggest({
      profile,
      topPart: computed.impact.topPart,
      affectedParts: computed.affectedParts ?? [],
      impact: computed.impact,
    });

    if (aiOut) {
      alternates = aiOut.alternates;
      actions = aiOut.actions;
      reasoningTrace = [...reasoningTrace, ...aiOut.reasoningTrace];
    }
  } catch {
    reasoningTrace = [...reasoningTrace, "Gemini generation failed; used fallback alternates/actions."];
  }

  return Response.json({
    eventId,
    runId: runCounter,
    impact: computed.impact,
    alternates,
    actions,
    reasoningTrace,
    affectedCount: computed.affectedCount,
    affectedParts: computed.affectedParts,
  });
}
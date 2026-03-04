export const runtime = "nodejs";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

type AgDataRow = {
  date: string;
  location: string;
  product: string;
  supplier: string;
  quantity: number;
  unit: string;
  leadTimeDays?: number;
  costPerUnit?: number;
  routeStart?: string;
  routeEnd?: string;
  storageDays?: number;
};

const outSchema = z.object({
  scorePct: z.number().min(0).max(100),
  summary: z.string().min(10),
  keyRisks: z
    .array(
      z.object({
        category: z.enum(["InputShortage", "WeatherLogistics", "TradePolicy"]),
        title: z.string(),
        severity: z.enum(["Low", "Medium", "High"]),
        probabilityPct: z.number().min(0).max(100),
        impactUsd: z.number().min(0),
        why: z.string(),
      })
    )
    .min(3)
    .max(6),
  recommendations: z
    .array(
      z.object({
        priority: z.enum(["P0", "P1", "P2"]),
        title: z.string(),
        requiresApproval: z.boolean(),
        steps: z.array(z.string()).min(2).max(6),
        tradeoffs: z.string(),
      })
    )
    .min(3)
    .max(6),
  escalation: z.object({
    shouldEscalate: z.boolean(),
    reasons: z.array(z.string()).max(6),
    suggestedOwners: z.array(z.enum(["Procurement", "Ops", "Finance", "Legal"])).max(4),
  }),
  reasoningTrace: z.array(z.string()).min(3).max(10),
});

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function computeQuickMetrics(rows: AgDataRow[]) {
  const rowCount = rows.length;

  const exposureUsd = rows.reduce((sum, r) => {
    const q = Number(r.quantity || 0) || 0;
    const c = Number(r.costPerUnit ?? 0) || 0;
    return sum + q * c;
  }, 0);

  const withLT = rows.filter((r) => Number.isFinite(r.leadTimeDays as any));
  const withStorage = rows.filter((r) => Number.isFinite(r.storageDays as any));

  const avgLT =
    withLT.reduce((s, r) => s + (Number(r.leadTimeDays) || 0), 0) / (withLT.length || 1);

  const minStorage =
    withStorage.reduce((m, r) => Math.min(m, Number(r.storageDays) || Infinity), Infinity);

  // heuristic stockout risk signal: if storageDays < leadTimeDays, risk increases
  const riskRows = rows.filter(
    (r) =>
      Number.isFinite(r.leadTimeDays as any) &&
      Number.isFinite(r.storageDays as any) &&
      (Number(r.storageDays) || 0) < (Number(r.leadTimeDays) || 0)
  );

  const stockoutProb = clamp((riskRows.length / Math.max(1, rowCount)) * 100 + (avgLT > 20 ? 15 : 0), 5, 95);

  const topExposure = [...rows]
    .map((r) => ({
      product: r.product,
      supplier: r.supplier,
      exposure: (Number(r.quantity) || 0) * (Number(r.costPerUnit ?? 0) || 0),
    }))
    .sort((a, b) => b.exposure - a.exposure)
    .slice(0, 5);

  return {
    rowCount,
    exposureUsd: Math.round(exposureUsd),
    avgLeadTimeDays: Math.round(avgLT),
    minStorageDays: Number.isFinite(minStorage) ? Math.round(minStorage) : null,
    stockoutProbabilityPct: Math.round(stockoutProb),
    topExposure,
  };
}

function extractJson(rawMaybe: string | undefined): any {
  const raw = (rawMaybe ?? "").trim();

  // Empty / whitespace => fail fast with helpful message
  if (!raw) throw new Error("Gemini returned empty text (no JSON).");

  // Strip common ```json fences
  const unfenced = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // If still not valid JSON, try to slice from first { to last }
  const first = unfenced.indexOf("{");
  const last = unfenced.lastIndexOf("}");
  const candidate =
    first !== -1 && last !== -1 && last > first ? unfenced.slice(first, last + 1) : unfenced;

  return JSON.parse(candidate);
}

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return Response.json(
      { error: "GEMINI_API_KEY missing. Add it to web/.env.local and restart the dev server." },
      { status: 500 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    rows?: AgDataRow[];
    companyPolicy?: {
      stockoutEscalatePct?: number;
      costShockEscalateUsd?: number;
    };
  };

  const rows = Array.isArray(body.rows) ? body.rows : [];
  const policy = {
    stockoutEscalatePct: body.companyPolicy?.stockoutEscalatePct ?? 60,
    costShockEscalateUsd: body.companyPolicy?.costShockEscalateUsd ?? 50000,
  };

  const metrics = computeQuickMetrics(rows);

  const ai = new GoogleGenAI({});

  const prompt = `
You are Kairos, an agriculture supply chain resilience agent.

You must produce JSON ONLY that matches the schema.
Be specific and contextual to the provided data.

Company policy thresholds:
- Escalate if stockoutProbabilityPct >= ${policy.stockoutEscalatePct}
- Escalate if exposureUsd (proxy for cost shock / margin risk) >= ${policy.costShockEscalateUsd}

Data summary:
- rowCount=${metrics.rowCount}
- exposureUsd=${metrics.exposureUsd}
- avgLeadTimeDays=${metrics.avgLeadTimeDays}
- minStorageDays=${metrics.minStorageDays ?? "N/A"}
- stockoutProbabilityPct=${metrics.stockoutProbabilityPct}
- topExposure items (product, supplier, exposureUsd):
${metrics.topExposure.map((x) => `  - ${x.product} | ${x.supplier} | ${Math.round(x.exposure)}`).join("\n")}

Make keyRisks cover:
1) Critical input shortage / price shock
2) Weather/logistics bottleneck risk
3) Trade policy / restriction shock risk

Recommendations must include:
- buffer inventory OR adjust PO timing
- alternate supplier / reroute options
- one "approval packet" suggestion (what to send to humans)

Use numbers from metrics in reasoningTrace.
`;

  const responseJsonSchema = {
    type: "object",
    additionalProperties: false,
    required: ["scorePct", "summary", "keyRisks", "recommendations", "escalation", "reasoningTrace"],
    properties: {
      scorePct: { type: "number", minimum: 0, maximum: 100 },
      summary: { type: "string" },
      keyRisks: {
        type: "array",
        minItems: 3,
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["category", "title", "severity", "probabilityPct", "impactUsd", "why"],
          properties: {
            category: { type: "string", enum: ["InputShortage", "WeatherLogistics", "TradePolicy"] },
            title: { type: "string" },
            severity: { type: "string", enum: ["Low", "Medium", "High"] },
            probabilityPct: { type: "number", minimum: 0, maximum: 100 },
            impactUsd: { type: "number", minimum: 0 },
            why: { type: "string" },
          },
        },
      },
      recommendations: {
        type: "array",
        minItems: 3,
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["priority", "title", "requiresApproval", "steps", "tradeoffs"],
          properties: {
            priority: { type: "string", enum: ["P0", "P1", "P2"] },
            title: { type: "string" },
            requiresApproval: { type: "boolean" },
            steps: { type: "array", minItems: 2, maxItems: 6, items: { type: "string" } },
            tradeoffs: { type: "string" },
          },
        },
      },
      escalation: {
        type: "object",
        additionalProperties: false,
        required: ["shouldEscalate", "reasons", "suggestedOwners"],
        properties: {
          shouldEscalate: { type: "boolean" },
          reasons: { type: "array", maxItems: 6, items: { type: "string" } },
          suggestedOwners: { type: "array", maxItems: 4, items: { type: "string", enum: ["Procurement", "Ops", "Finance", "Legal"] } },
        },
      },
      reasoningTrace: { type: "array", minItems: 3, maxItems: 10, items: { type: "string" } },
    },
  } as const;

  const resp = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: responseJsonSchema as any,
      temperature: 0.3,
    },
  });

  const raw = resp.text;

  let jsonObj: any;
  try {
    jsonObj = extractJson(raw);
  } catch (e: any) {
    return Response.json(
      {
        error: "Failed to parse Gemini JSON output",
        detail: e?.message ?? String(e),
        rawPreview: String(raw ?? "").slice(0, 400),
      },
      { status: 500 }
    );
  }

  const parsed = outSchema.parse(jsonObj);

  return Response.json({
    ...parsed,
    _debug: {
      geminiEnabled: true,
      metrics,
    },
  });
}
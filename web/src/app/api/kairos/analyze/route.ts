export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const responseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["recommendations", "escalation", "aiInsights", "topExposureDrivers", "keyRisks"],
  properties: {
    recommendations: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "urgency", "why", "steps", "owner", "eta", "evidence"],
        properties: {
          title: { type: "string" },
          urgency: { type: "string", enum: ["low", "medium", "high"] },
          why: { type: "string" },
          steps: { type: "array", items: { type: "string" }, minItems: 1 },
          owner: { type: "string" },
          eta: { type: "string" },
          evidence: { type: "array", items: { type: "string" } },
        },
      },
    },
    escalation: {
      type: "object",
      additionalProperties: false,
      required: ["level", "message", "who", "when", "evidence"],
      properties: {
        level: { type: "string", enum: ["none", "watch", "escalate"] },
        message: { type: "string" },
        who: { type: "array", items: { type: "string" } },
        when: { type: "string" },
        evidence: { type: "array", items: { type: "string" } },
      },
    },
    aiInsights: { type: "array", items: { type: "string" } },
    topExposureDrivers: { type: "array", items: { type: "string" } },
    keyRisks: { type: "array", items: { type: "string" } },
  },
} as const;

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Missing GEMINI_API_KEY in .env.local" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as {
      meta?: { sourceFileName?: string | null; count?: number | null };
      kpis?: {
        totalSpend?: number;
        avgLeadTime?: number;
        avgStorage?: number;
        stockoutRiskPct?: number;
      };
      exposures?: {
        bySupplier?: Array<{ name: string; value: number }>;
        byProduct?: Array<{ name: string; value: number }>;
        byLocation?: Array<{ name: string; value: number }>;
      };
      signals?: unknown;
      insiderNotes?: string[];
    };

    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.KAIROS_GEMINI_MODEL ?? "gemini-3-flash-preview";

    const prompt = `
You are Kairos, an agriculture supply-chain operations copilot.
Goal: produce SPECIFIC, non-generic output grounded in the provided dataset + live signals.

Hard rules:
- Every recommendation MUST include at least ONE specific supplier/product/location (from exposures) AND at least ONE number (KPI, share %, risk score).
- No generic filler. No “may”. Be decisive.
- Short punchy sentences. Emojis are welcome in titles.
- Prefer actions that an ops team can execute in 24h / 72h / 2 weeks.
- Evidence items must reference input values (KPIs/exposure/signal scores/headlines).

INPUT (use as evidence):
Dataset meta: ${JSON.stringify(body.meta ?? {}, null, 2)}
KPIs: ${JSON.stringify(body.kpis ?? {}, null, 2)}
Exposure (top): ${JSON.stringify(body.exposures ?? {}, null, 2)}
Signals: ${JSON.stringify(body.signals ?? {}, null, 2)}
Insider notes (optional): ${JSON.stringify(body.insiderNotes ?? [], null, 2)}

Return ONLY valid JSON that matches the schema exactly.
`;

    const resp = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: responseJsonSchema as any,
        temperature: 0.3,
      },
    });

    const raw = resp.text ?? "";

    if (!raw.trim()) {
      return NextResponse.json(
        { ok: false, error: "Gemini returned empty response" },
        { status: 500 }
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: "Failed to parse Gemini JSON", rawPreview: raw.slice(0, 300) },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      asOf: new Date().toISOString(),
      model,
      output: parsed,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "analyze failed" },
      { status: 500 }
    );
  }
}
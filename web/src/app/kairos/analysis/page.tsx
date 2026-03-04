"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadAgDataFull } from "@/lib/agData";
import { saveKairosRun } from "@/lib/kairosRuns";

export default function Page() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [meta, setMeta] = useState<{ sourceFileName: string | null; count: number | null } | null>(null);

  useEffect(() => {
    loadAgDataFull()
      .then(({ meta }) => setMeta({ sourceFileName: meta?.sourceFileName ?? null, count: meta?.count ?? null }))
      .catch(() => {});
  }, []);

  async function runAnalysis() {
    setErr(null);
    setLoading(true);

    try {
      const { meta, rows } = await loadAgDataFull();
      const rowCount = rows?.length ?? 0;

      if (!rowCount) {
        throw new Error("No agriculture data found. Upload CSV on /kairos/data first.");
      }

      const resp = await fetch("/api/kairos/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows,
          companyPolicy: { stockoutEscalatePct: 60, costShockEscalateUsd: 50000 },
        }),
      });

      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error ?? "Analysis failed");

      setResult(json);

      const runId = `run_${Date.now()}`;
      await saveKairosRun({
        runId,
        createdAtMs: Date.now(),
        dataMeta: {
          sourceFileName: meta?.sourceFileName ?? null,
          rowCount,
        },
        result: json,
      });
    } catch (e: any) {
      setErr(e?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-gray-500">
          <Link href="/kairos" className="hover:underline">
            Dashboard
          </Link>{" "}
          / Analysis
        </div>
        <h1 className="text-2xl font-semibold">Analysis (Kairos)</h1>
        <p className="text-sm text-gray-600">
          Update agent analysis using your uploaded agriculture data + policy thresholds.
        </p>
        {meta?.sourceFileName ? (
          <p className="text-xs text-gray-500 mt-1">
            Current dataset: <span className="font-medium">{meta.sourceFileName}</span> ·{" "}
            <span className="font-medium">{meta.count ?? 0}</span> rows
          </p>
        ) : null}
      </div>

      <section className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white text-sm font-semibold disabled:opacity-60"
        >
          {loading ? "Running..." : "Update agent analysis"}
        </button>

        {err ? <div className="text-sm text-red-600">{err}</div> : null}
      </section>

      {result ? (
        <section className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">Latest Result</div>
            <div className="text-sm">
              Score: <span className="font-semibold">{result.scorePct}%</span>
            </div>
          </div>

          <div className="text-sm text-gray-700">{result.summary}</div>

          <div>
            <div className="text-sm font-semibold mb-2">Key Risks</div>
            <div className="space-y-2">
              {result.keyRisks?.map((r: any, i: number) => (
                <div key={i} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{r.title}</div>
                    <div className="text-xs text-gray-600">
                      {r.category} · {r.severity} · {r.probabilityPct}% · ${Math.round(r.impactUsd)}
                    </div>
                  </div>
                  <div className="text-sm text-gray-700 mt-1">{r.why}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold mb-2">Recommendations</div>
            <div className="space-y-2">
              {result.recommendations?.map((rec: any, i: number) => (
                <div key={i} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">
                      [{rec.priority}] {rec.title}
                    </div>
                    <div className="text-xs text-gray-600">
                      {rec.requiresApproval ? "Requires approval" : "No approval needed"}
                    </div>
                  </div>
                  <ul className="mt-2 list-disc pl-5 text-sm text-gray-700 space-y-1">
                    {rec.steps?.map((s: string, j: number) => (
                      <li key={j}>{s}</li>
                    ))}
                  </ul>
                  <div className="text-xs text-gray-600 mt-2">Tradeoffs: {rec.tradeoffs}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <div className="text-sm font-semibold">Escalation</div>
            <div className="text-sm text-gray-700 mt-1">
              {result.escalation?.shouldEscalate ? "Escalate: YES" : "Escalate: NO"}
            </div>
            {result.escalation?.reasons?.length ? (
              <ul className="mt-2 list-disc pl-5 text-sm text-gray-700 space-y-1">
                {result.escalation.reasons.map((s: string, i: number) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            ) : null}
            {result.escalation?.suggestedOwners?.length ? (
              <div className="text-xs text-gray-600 mt-2">
                Owners: {result.escalation.suggestedOwners.join(", ")}
              </div>
            ) : null}
          </div>

          {result.reasoningTrace?.length ? (
            <div>
              <div className="text-sm font-semibold mb-2">Reasoning Trace</div>
              <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                {result.reasoningTrace.map((s: string, i: number) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
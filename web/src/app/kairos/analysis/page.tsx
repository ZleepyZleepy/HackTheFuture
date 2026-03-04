"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadAgDataFull } from "@/lib/agData";
import { saveKairosRun, loadKairosRuns } from "@/lib/kairosRuns";
import { loadInsiderSources } from "@/lib/insiderSources";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function toneColorForPct(pct: number) {
  if (pct >= 70) return "var(--color-success)";
  if (pct >= 40) return "var(--color-warning)";
  return "var(--color-danger)";
}

function Donut({ pct, label }: { pct: number; label: string }) {
  const p = clamp(Math.round(pct), 0, 100);
  const tone = toneColorForPct(p);
  return (
    <div className="flex items-center gap-4">
      <div
        className="h-16 w-16 rounded-full"
        style={{
          background: `conic-gradient(${tone} ${p}%, rgba(0,0,0,0.08) 0)`,
        }}
        aria-label={`${label} donut`}
      />
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-lg font-semibold">{p}%</div>
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 180;
  const h = 48;
  if (!values.length) return <div className="text-xs text-gray-500">—</div>;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const pts = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * w;
    const y = h - ((v - min) / span) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg width={w} height={h} className="block text-gray-700">
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={pts.join(" ")} opacity={0.85} />
    </svg>
  );
}

function BarList({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-2">
      {items.map((it, idx) => {
        const pct = (it.value / max) * 100;
        return (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <div className="truncate pr-2">{it.label}</div>
              <div className="shrink-0 font-medium">${Math.round(it.value).toLocaleString()}</div>
            </div>
            <div className="h-2 rounded-full bg-black/10 overflow-hidden">
              <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: "var(--color-primary)" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SeverityPill({ sev }: { sev: "Low" | "Medium" | "High" }) {
  const cls =
    sev === "High"
      ? "bg-red-50 text-red-700 border-red-200"
      : sev === "Medium"
      ? "bg-yellow-50 text-yellow-700 border-yellow-200"
      : "bg-green-50 text-green-700 border-green-200";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>{sev}</span>;
}

function PlaceholderCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="text-2xl font-semibold mt-1">—</div>
      <div className="text-xs text-gray-600 mt-2">{subtitle}</div>
    </div>
  );
}

export default function Page() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [result, setResult] = useState<any | null>(null);
  const [meta, setMeta] = useState<{ sourceFileName: string | null; count: number | null } | null>(null);

  const [insiderCount, setInsiderCount] = useState<number>(0);
  const [recentScores, setRecentScores] = useState<number[]>([]);

  useEffect(() => {
    loadAgDataFull()
      .then(({ meta }) => setMeta({ sourceFileName: meta?.sourceFileName ?? null, count: meta?.count ?? null }))
      .catch(() => {});
    loadInsiderSources()
      .then((s) => setInsiderCount(s.length))
      .catch(() => setInsiderCount(0));
    loadKairosRuns(5)
      .then((runs) => {
        const scores = runs.map((r) => Number(r.result?.scorePct)).filter((n) => Number.isFinite(n)) as number[];
        setRecentScores(scores.reverse());
      })
      .catch(() => {});
  }, []);

  async function runAnalysis() {
    setErr(null);
    setLoading(true);

    try {
      const { meta, rows } = await loadAgDataFull();
      const rowCount = rows?.length ?? 0;
      if (!rowCount) throw new Error("No agriculture data found. Upload CSV on /kairos/data first.");

      // ✅ auto include if present, otherwise [] (no checkbox)
      const insiderSources = await loadInsiderSources().catch(() => []);
      const resp = await fetch("/api/kairos/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows,
          insiderSources,
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

      const runs = await loadKairosRuns(5).catch(() => []);
      const scores = runs.map((r) => Number(r.result?.scorePct)).filter((n) => Number.isFinite(n)) as number[];
      setRecentScores(scores.reverse());

      // refresh insider count in case user added some
      setInsiderCount(insiderSources.length);
    } catch (e: any) {
      setErr(e?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  }

  const metrics = result?._debug?.metrics ?? null;

  const topExposureBars = useMemo(() => {
    const list = metrics?.topExposure ?? [];
    return list.slice(0, 5).map((x: any) => ({
      label: `${x.product} · ${x.supplier}`,
      value: Number(x.exposure || 0),
    }));
  }, [metrics]);

  const scorePct = Number(result?.scorePct ?? NaN);
  const scoreTone = Number.isFinite(scorePct) ? toneColorForPct(scorePct) : "var(--color-primary)";

  return (
    <div className="space-y-6">
      {/* Title row + button (next to title) ✅ */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm text-gray-500">
            <Link href="/kairos" className="hover:underline">
              Dashboard
            </Link>{" "}
            / Analysis
          </div>
          <h1 className="text-2xl font-semibold">🌾 Kairos Analysis</h1>
          <p className="text-sm text-gray-600">
            Risk intelligence from your ops data{insiderCount ? ` + ${insiderCount} insider source(s)` : ""}.
          </p>

          <div className="mt-1 text-xs text-gray-500 flex flex-wrap gap-3">
            {meta?.sourceFileName ? (
              <span>
                📄 Dataset: <span className="font-medium">{meta.sourceFileName}</span> ·{" "}
                <span className="font-medium">{meta.count ?? 0}</span> rows
              </span>
            ) : (
              <span>📄 Dataset: —</span>
            )}

            <span>
              🕵️ Insider Sources:{" "}
              <span className="font-medium">{insiderCount}</span>{" "}
              <Link href="/kairos/sources" className="hover:underline">
                (manage)
              </Link>
            </span>

            <span className="flex items-center gap-2">
              📈 Trend (last 5): <Sparkline values={recentScores} />
            </span>
          </div>
        </div>

        <button
          onClick={runAnalysis}
          disabled={loading}
          className="rounded-lg px-4 py-2 text-white text-sm font-semibold disabled:opacity-60"
          style={{ background: "var(--color-primary)" }}
        >
          {loading ? "⏳ Updating..." : "🚀 Update analysis"}
        </button>
      </div>

      {err ? <div className="text-sm text-red-600">⚠️ {err}</div> : null}

      {/* Sections should exist BEFORE clicking update ✅ */}
      <div className="grid grid-cols-12 gap-4">
        {/* KPI row (Kintsugi-like cards) */}
        <section className="col-span-12 grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-3 rounded-xl border bg-white p-4 shadow-sm">
            <div className="text-xs text-gray-500">🧭 Overall score</div>
            <div className="text-3xl font-bold mt-1" style={{ color: scoreTone }}>
              {Number.isFinite(scorePct) ? `${scorePct}%` : "—"}
            </div>
            <div className="text-xs text-gray-600 mt-2">
              {result?.summary ? result.summary : "Click “Update analysis” to generate insights."}
            </div>
          </div>

          {result ? (
            <>
              <div className="col-span-12 md:col-span-3 rounded-xl border bg-white p-4 shadow-sm">
                <div className="text-xs text-gray-500">💸 Exposure (proxy)</div>
                <div className="text-2xl font-semibold mt-1">
                  ${Number(metrics?.exposureUsd ?? 0).toLocaleString()}
                </div>
                <div className="text-xs text-gray-600 mt-2">Top drivers shown below.</div>
              </div>

              <div className="col-span-12 md:col-span-3 rounded-xl border bg-white p-4 shadow-sm">
                <div className="text-xs text-gray-500">⏱ Avg lead time</div>
                <div className="text-2xl font-semibold mt-1">{metrics?.avgLeadTimeDays ?? "—"} days</div>
                <div className="text-xs text-gray-600 mt-2">Higher LT increases stockout sensitivity.</div>
              </div>

              <div className="col-span-12 md:col-span-3 rounded-xl border bg-white p-4 shadow-sm">
                <div className="text-xs text-gray-500">📉 Stockout probability</div>
                <div className="text-2xl font-semibold mt-1">{metrics?.stockoutProbabilityPct ?? "—"}%</div>
                <div className="text-xs text-gray-600 mt-2">Min storage: {metrics?.minStorageDays ?? "—"} days</div>
              </div>
            </>
          ) : (
            <>
              <div className="col-span-12 md:col-span-3">
                <PlaceholderCard title="💸 Exposure (proxy)" subtitle="Will compute from cost × qty × lead time." />
              </div>
              <div className="col-span-12 md:col-span-3">
                <PlaceholderCard title="⏱ Avg lead time" subtitle="Will compute from leadTimeDays column." />
              </div>
              <div className="col-span-12 md:col-span-3">
                <PlaceholderCard title="📉 Stockout probability" subtitle="Will estimate from storageDays vs lead time." />
              </div>
            </>
          )}
        </section>

        {/* Left: Key Risks */}
        <section className="col-span-12 lg:col-span-6 rounded-xl border bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">🚨 Key Risks</h2>
            <Donut pct={Number(metrics?.stockoutProbabilityPct ?? 0) || 0} label="Stockout signal" />
          </div>

          {result?.keyRisks?.length ? (
            <div className="space-y-2">
              {result.keyRisks.map((r: any, i: number) => (
                <div key={i} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{r.title}</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <SeverityPill sev={r.severity} />
                        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold">
                          🎯 {r.probabilityPct}%
                        </span>
                        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold">
                          💥 ${Math.round(r.impactUsd).toLocaleString()}
                        </span>
                        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold">
                          📌 {r.category}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-700 mt-2">{r.why}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              No risks yet. Click <span className="font-medium">“Update analysis”</span> to generate risk drivers.
            </p>
          )}
        </section>

        {/* Right: Exposure + Recommendations */}
        <section className="col-span-12 lg:col-span-6 space-y-4">
          <div className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
            <h2 className="text-lg font-semibold">📦 Top Exposure Drivers</h2>
            {result && topExposureBars.length ? (
              <BarList items={topExposureBars} />
            ) : (
              <p className="text-sm text-gray-600">
                Click <span className="font-medium">“Update analysis”</span> to compute top exposure drivers.
              </p>
            )}
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
            <h2 className="text-lg font-semibold">✅ Recommendations</h2>
            {result?.recommendations?.length ? (
              <div className="space-y-2">
                {result.recommendations.map((rec: any, i: number) => (
                  <div key={i} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold">
                        {rec.priority === "P0" ? "🔥" : rec.priority === "P1" ? "⚡" : "🟩"} [{rec.priority}]{" "}
                        {rec.title}
                      </div>
                      <div className="text-xs text-gray-600">
                        {rec.requiresApproval ? "🧾 Approval needed" : "✅ No approval"}
                      </div>
                    </div>

                    <ul className="mt-2 list-disc pl-5 text-sm text-gray-700 space-y-1">
                      {rec.steps?.map((s: string, j: number) => (
                        <li key={j}>{s}</li>
                      ))}
                    </ul>

                    <div className="text-xs text-gray-600 mt-2">⚖️ Tradeoffs: {rec.tradeoffs}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600">
                Click <span className="font-medium">“Update analysis”</span> to generate ranked recommendations.
              </p>
            )}
          </div>
        </section>

        {/* Bottom: Escalation + Trace */}
        <section className="col-span-12 grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-5 rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">📣 Escalation</h2>

            {result?.escalation ? (
              <>
                <div className="mt-2 text-sm text-gray-800">
                  {result.escalation.shouldEscalate ? "🚨 Escalate: YES" : "✅ Escalate: NO"}
                </div>
                {result.escalation.reasons?.length ? (
                  <ul className="mt-3 list-disc pl-5 text-sm text-gray-700 space-y-1">
                    {result.escalation.reasons.map((s: string, i: number) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                ) : null}
                {result.escalation.suggestedOwners?.length ? (
                  <div className="text-xs text-gray-600 mt-3">
                    👥 Owners: {result.escalation.suggestedOwners.join(", ")}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-gray-600 mt-2">
                Click <span className="font-medium">“Update analysis”</span> to generate escalation logic.
              </p>
            )}
          </div>

          <div className="col-span-12 lg:col-span-7 rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">🧠 Reasoning Trace</h2>
            {result?.reasoningTrace?.length ? (
              <ul className="mt-3 list-disc pl-5 text-sm text-gray-700 space-y-1">
                {result.reasoningTrace.map((s: string, i: number) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-600 mt-2">
                Click <span className="font-medium">“Update analysis”</span> to generate the reasoning trace.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
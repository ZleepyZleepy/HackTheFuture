"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useKairosAgent } from "@/components/kairos/useKairosAgent";

function badge(level: string) {
  const l = String(level || "").toLowerCase();
  if (l === "high") return "bg-red-100 text-red-800";
  if (l === "medium" || l === "moderate") return "bg-amber-100 text-amber-800";
  return "bg-emerald-100 text-emerald-800";
}

function icon(level: string) {
  const l = String(level || "").toLowerCase();
  if (l === "high") return "🔴";
  if (l === "medium" || l === "moderate") return "🟠";
  return "🟢";
}

function levelFromScore(score: number): "low" | "medium" | "high" {
  if (score >= 70) return "high";
  if (score >= 30) return "medium";
  return "low";
}

function scoreExplain(kind: "weather" | "geopolitics" | "logistics") {
  const base =
    kind === "weather"
      ? "Higher = higher disruption probability from severe weather across your locations."
      : kind === "geopolitics"
      ? "Higher = higher disruption probability from trade, policy, or cross-border shocks tied to your ag inputs."
      : "Higher = higher disruption probability from port, rail, strike, and closure issues.";

  return `${base} 0–30: low / safe · 31–69: moderate / monitor closely · 70–100: dangerous / high disruption risk.`;
}

function asNumber(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function topSignals(arr: any[] | undefined, n: number) {
  return (arr ?? [])
    .slice()
    .sort((a, b) => asNumber(b?.severity) - asNumber(a?.severity))
    .slice(0, n);
}

function Spinner() {
  return (
    <span
      className="inline-block h-6 w-6 animate-spin rounded-full border-[2.5px] border-slate-300 border-t-slate-700"
      aria-label="loading"
    />
  );
}

function statusText(tick: number) {
  const cycle = [
    "Collecting external signals...",
    "Analyzing supply chain risk factors...",
    "Generating strategies and solution...",
  ];
  return cycle[tick % cycle.length];
}

function SignalsList({ items }: { items: any[] }) {
  if (!items.length) return <div className="mt-2 text-sm text-gray-600">No signals yet.</div>;

  return (
    <div className="mt-3 space-y-2">
      {items.map((s, i) => (
        <div key={i} className="rounded-xl bg-white/70 p-3 shadow-sm ring-1 ring-white/60">
          <div className="flex items-center justify-between gap-3">
            <div className="font-semibold">{String(s?.title ?? "Signal")}</div>
            {"severity" in s ? <div className="text-xs text-gray-600">Severity: {String(s.severity)}/100</div> : null}
          </div>
          {s?.summary ? <div className="mt-1 text-sm text-gray-700">{String(s.summary)}</div> : null}
          {Array.isArray(s?.evidence) && s.evidence.length > 0 ? (
            <div className="mt-2 text-xs text-gray-500">Evidence: {s.evidence.slice(0, 2).map(String).join(" · ")}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function GradientKpiCard({
  title,
  score,
  level,
  explain,
  tone,
  loading,
}: {
  title: string;
  score: number;
  level: "low" | "medium" | "high";
  explain: string;
  tone: "sky" | "indigo" | "emerald";
  loading: boolean;
}) {
  const gradient =
    tone === "sky"
      ? "from-sky-700 via-sky-600 to-cyan-500"
      : tone === "indigo"
      ? "from-indigo-700 via-violet-600 to-fuchsia-500"
      : "from-emerald-700 via-teal-600 to-cyan-500";

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${gradient} p-4 text-white shadow-lg`}>
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">{title}</div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge(level)}`}>
          {icon(level)} {level}
        </span>
      </div>

      <div className="mt-2 text-3xl font-bold">{loading ? "—/100" : `${score}/100`}</div>
      <div className="mt-2 text-xs text-white/85">{loading ? "Updating signals..." : explain}</div>
    </div>
  );
}

function SectionShell({
  title,
  accent,
  children,
}: {
  title: string;
  accent: "violet" | "amber" | "emerald";
  children: ReactNode;
}) {
  const shell =
    accent === "violet"
      ? "from-violet-50 to-fuchsia-50 ring-violet-200"
      : accent === "amber"
      ? "from-amber-50 to-orange-50 ring-amber-200"
      : "from-emerald-50 to-teal-50 ring-emerald-200";

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${shell} p-4 shadow-sm ring-1`}>
      <div className="text-lg font-semibold">{title}</div>
      {children}
    </div>
  );
}

export default function Page() {
  const { meta, insiderCount, output, signals, agentAsOf, updating, error, update } = useKairosAgent();

  const updatingRef = useRef(false);
  useEffect(() => {
    updatingRef.current = updating;
  }, [updating]);

  useEffect(() => {
    const safeUpdate = () => {
      if (!updatingRef.current) update();
    };

    if (meta?.sourceFileName) safeUpdate();

    const id = window.setInterval(safeUpdate, 60 * 60 * 1000);

    window.addEventListener("storage", safeUpdate);
    window.addEventListener("kairos:data_updated", safeUpdate as any);
    window.addEventListener("kairos:insiders_updated", safeUpdate as any);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("storage", safeUpdate);
      window.removeEventListener("kairos:data_updated", safeUpdate as any);
      window.removeEventListener("kairos:insiders_updated", safeUpdate as any);
    };
  }, [update, meta?.sourceFileName]);

  const [tick, setTick] = useState(0);
  const tickRef = useRef(0);

  useEffect(() => {
    if (!updating) return;
    const id = window.setInterval(() => {
      tickRef.current += 1;
      setTick(tickRef.current);
    }, 1200);
    return () => window.clearInterval(id);
  }, [updating]);

  const datasetUpdated =
    meta?.updatedAt instanceof Date
      ? meta.updatedAt.toLocaleString()
      : meta?.updatedAt
      ? new Date(meta.updatedAt as any).toLocaleString()
      : "—";

  const runAsOf = agentAsOf ? new Date(agentAsOf).toLocaleString() : "—";

  const risk = output?.risk ?? {};
  const riskLevel = String(risk.level ?? "low").toLowerCase();
  const overallScore = asNumber(risk.overallScore, 0);

  const breakdown = (risk.breakdown ?? {}) as Record<string, number>;
  const weatherScore = asNumber(breakdown.weather, 0);
  const geoScore = asNumber(breakdown.geopolitics, 0);
  const logisticsScore = asNumber(breakdown.logistics, 0);

  const weatherSignals = (signals?.weatherSignals ?? []) as any[];
  const geoSignals = (signals?.geoSignals ?? []) as any[];
  const logisticsSignals = (signals?.logisticsSignals ?? []) as any[];

  const topWeather = useMemo(() => topSignals(weatherSignals, 3), [weatherSignals]);
  const topGeo = useMemo(() => topSignals(geoSignals, 3), [geoSignals]);
  const topLog = useMemo(() => topSignals(logisticsSignals, 3), [logisticsSignals]);

  const insights = output?.aiInsights ?? [];
  const predictions = output?.predictions ?? [];
  const strategies = output?.strategies ?? [];
  const actionPlan = output?.actionPlan ?? [];

  const stabilityLabel = riskLevel === "high" || riskLevel === "medium" ? "Unstable" : "Stable";
  const alertMessage =
    riskLevel === "high"
      ? "Immediate mitigation recommended."
      : riskLevel === "medium"
      ? "Continue monitoring and prepare mitigations."
      : "Continue monitoring.";

  const autoEmailMessage =
    riskLevel === "high" ? "Auto-email escalation has been triggered" : "Auto-email escalation has not been triggered";

  const outlookItems = useMemo(() => {
    const out: Array<{ title: string; body: string; meta?: string }> = [];

    for (const p of predictions.slice(0, 4)) {
      const horizon = String(p?.horizon ?? "Horizon");
      const pred = String(p?.prediction ?? "");
      const conf =
        typeof p?.confidence === "number"
          ? `${Math.round(p.confidence * 100)}%`
          : p?.confidence
          ? String(p.confidence)
          : null;

      out.push({
        title: `🔮 ${horizon}`,
        body: pred,
        meta: conf ? `Confidence: ${conf}` : undefined,
      });
    }

    for (const s of strategies.slice(0, 6)) {
      if (typeof s === "string") {
        out.push({ title: "🧭 Strategy", body: s });
      } else {
        const t = String(s?.title ?? "Strategy");
        const b = String(s?.summary ?? s?.why ?? "");
        out.push({ title: t.startsWith("🧭") ? t : `🧭 ${t}`, body: b });
      }
    }

    return out;
  }, [predictions, strategies]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Analytics</h1>

          <p className="mt-1 text-sm text-gray-600">
            Analyze disruption signals, supply chain exposure, and operational risk using Kairos intelligence.
          </p>

          <div className="mt-1 flex flex-wrap gap-6 text-sm text-gray-600">
            {meta?.sourceFileName ? (
              <span>
                📄 Dataset: <span className="font-medium">{meta.sourceFileName}</span> ·{" "}
                <span className="font-medium">{meta.count ?? 0}</span> rows
              </span>
            ) : (
              <span>📄 Dataset: —</span>
            )}

            <span>
              🕵️ Insider Sources: <span className="font-medium">{insiderCount}</span>{" "}
              <Link href="/kairos/sources" className="hover:underline">
                (manage)
              </Link>
            </span>

            <span>
              🕒 Dataset updated: <span className="font-medium">{datasetUpdated}</span>
            </span>
          </div>

          <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
            <span>
              🤖 Agent run as-of: <span className="font-medium">{runAsOf}</span>
            </span>
            <span className="text-gray-500">Auto-updates every hour</span>
          </div>
        </div>

        <div className="pt-1 text-sm text-gray-500">
          <div className="flex w-[370px] items-center justify-end">
            {updating ? (
              <div className="flex items-center">
                <Spinner />
                <span className="w-[320px] text-right">{statusText(tick)}</span>
              </div>
            ) : (
              <span className="w-[370px]" />
            )}
          </div>
        </div>
      </div>

      {error ? <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">🚨 Alert</div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge(riskLevel)}`}>
              {icon(riskLevel)} {riskLevel}
            </span>
          </div>

          <div className="mt-2 text-3xl font-bold">{updating ? "—/100" : `${overallScore}/100`}</div>

          <div className="mt-2 text-sm text-white/90">
            <span className="font-semibold">{stabilityLabel}</span> · {alertMessage}
          </div>

          <div className="mt-3 rounded-xl bg-white/10 p-3 text-xs text-white/80">
            {updating ? "Updating signals..." : autoEmailMessage}
          </div>
        </div>

        <GradientKpiCard
          title="☁️ Weather"
          score={weatherScore}
          level={levelFromScore(weatherScore)}
          explain={scoreExplain("weather")}
          tone="sky"
          loading={updating}
        />

        <GradientKpiCard
          title="🌍 Geopolitics"
          score={geoScore}
          level={levelFromScore(geoScore)}
          explain={scoreExplain("geopolitics")}
          tone="indigo"
          loading={updating}
        />

        <GradientKpiCard
          title="🚚 Logistics"
          score={logisticsScore}
          level={levelFromScore(logisticsScore)}
          explain={scoreExplain("logistics")}
          tone="emerald"
          loading={updating}
        />
      </div>

      <SectionShell title="🧠 AI Insights" accent="violet">
        {insights.length === 0 ? (
          <div className="mt-2 text-sm text-gray-600">Waiting for first run…</div>
        ) : (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {insights.slice(0, 6).map((x: string, i: number) => (
              <div key={i} className="rounded-xl bg-white/70 p-3 text-sm text-gray-700 shadow-sm ring-1 ring-white/60">
                {x}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl bg-gradient-to-br from-sky-50 to-sky-100/60 p-4 ring-1 ring-sky-200">
            <div className="text-sm font-semibold text-sky-900">☁️ Weather signals</div>
            <SignalsList items={topWeather} />
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100/60 p-4 ring-1 ring-indigo-200">
            <div className="text-sm font-semibold text-indigo-900">🌍 Geopolitics signals</div>
            <SignalsList items={topGeo} />
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 p-4 ring-1 ring-emerald-200">
            <div className="text-sm font-semibold text-emerald-900">🚚 Logistics signals</div>
            <SignalsList items={topLog} />
          </div>
        </div>
      </SectionShell>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell title="🔮 Outlook & Strategies" accent="amber">
          {outlookItems.length === 0 ? (
            <div className="mt-2 text-sm text-gray-600">No outlook items yet.</div>
          ) : (
            <div className="mt-3 space-y-3">
              {outlookItems.map((it, i) => (
                <div key={i} className="rounded-xl bg-white/70 p-3 shadow-sm ring-1 ring-white/70">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold">{it.title}</div>
                    {it.meta ? <div className="text-xs text-gray-600">{it.meta}</div> : null}
                  </div>
                  <div className="mt-2 text-sm text-gray-700">{it.body}</div>
                </div>
              ))}
            </div>
          )}
        </SectionShell>

        <SectionShell title="✅ Action Plan" accent="emerald">
          {Array.isArray(actionPlan) && actionPlan.length > 0 ? (
            <div className="mt-3 space-y-3">
              {actionPlan.slice(0, 12).map((s: any, i: number) => {
                const stepNum = s?.step ?? i + 1;
                const main = String(s?.do ?? s?.action ?? s?.text ?? s?.title ?? "");
                const extra =
                  typeof s?.why === "string"
                    ? String(s.why)
                    : typeof s?.details === "string"
                    ? String(s.details)
                    : "";

                return (
                  <div key={i} className="rounded-2xl bg-white/75 p-4 shadow-sm ring-1 ring-white/70">
                    <div className="text-sm font-semibold text-emerald-900">Step {stepNum}</div>
                    <div className="mt-1 text-sm text-gray-800">{main}</div>
                    {extra ? <div className="mt-2 text-sm text-gray-600">{extra}</div> : null}

                    {Array.isArray(s?.substeps) && s.substeps.length > 0 ? (
                      <ul className="mt-3 space-y-1 text-sm text-gray-700">
                        {s.substeps.slice(0, 8).map((x: any, j: number) => (
                          <li key={j} className="flex gap-2">
                            <span className="mt-0.5">•</span>
                            <span>{String(x)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-2 text-sm text-gray-600">No action plan yet.</div>
          )}
        </SectionShell>
      </div>
    </div>
  );
}
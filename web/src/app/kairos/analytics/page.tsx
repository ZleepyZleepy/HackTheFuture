"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useKairosAgent } from "@/components/kairos/useKairosAgent";

function displayLevel(level: string) {
  return level === "medium" ? "moderate" : level;
}

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

function scoreGuide(kind: "weather" | "geopolitics" | "logistics") {
  if (kind === "weather") {
    return "A metric of disruption risk from severe weather events (storms, heavy rain, snow, heat, or flooding) affecting your supply chain locations.";
  }

  if (kind === "geopolitics") {
    return "A metric of disruption risk from trade policy changes, sanctions, tariffs, export restrictions, or geopolitical instability.";
  }

  return "A metric of disruption risk from transportation issues such as port congestion, rail delays, strikes, or infrastructure bottlenecks.";
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

function SectionShell({
  title,
  accent,
  children,
}: {
  title: string;
  accent: "violet" | "amber" | "green";
  children: ReactNode;
}) {
  const shell =
    accent === "violet"
      ? "from-violet-50 to-fuchsia-50 ring-violet-200"
      : accent === "amber"
      ? "from-amber-50 to-orange-50 ring-amber-200"
      : "from-emerald-50 to-teal-50 ring-emerald-200";

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${shell} p-5 shadow-sm ring-1`}>
      <div className="text-lg font-semibold">{title}</div>
      {children}
    </div>
  );
}

function SignalsList({
  items,
  emptyText,
}: {
  items: any[];
  emptyText: string;
}) {
  if (!items.length) return <div className="mt-3 text-sm text-gray-600">{emptyText}</div>;

  return (
    <div className="mt-3 space-y-3">
      {items.map((s, i) => (
        <div key={i} className="rounded-xl bg-white/80 p-4 shadow-sm ring-1 ring-white/70">
          <div className="font-semibold text-gray-900">{String(s?.title ?? "Signal")}</div>
          {s?.summary ? <div className="mt-2 text-sm leading-6 text-gray-700">{String(s.summary)}</div> : null}
          {Array.isArray(s?.evidence) && s.evidence.length > 0 ? (
            <div className="mt-3 text-xs leading-5 text-gray-500">
              Evidence: {s.evidence.slice(0, 2).map(String).join(" · ")}
            </div>
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
  guide,
  gradient,
  loading,
  loadingNote,
  showBadge,
}: {
  title: string;
  score: number;
  level: "low" | "medium" | "high";
  guide: string;
  gradient: string;
  loading: boolean;
  loadingNote: string;
  showBadge: boolean;
}) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${gradient} p-4 text-white shadow-lg`}>
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">{title}</div>
        {showBadge ? (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge(level)}`}>
            {icon(level)} {displayLevel(level)}
          </span>
        ) : null}
      </div>

      <div className="mt-3 text-3xl font-bold">{loading ? "—/100" : `${score}/100`}</div>

      {loading ? (
        <div className="mt-3 text-sm text-white/85">{loadingNote}</div>
      ) : (
        <div className="mt-3 text-xs leading-5 text-white/90">{guide}</div>
      )}
    </div>
  );
}

function normalizePredictionTitle(horizon: string) {
  const h = horizon.toLowerCase();
  if (h.includes("1 month") || h.includes("one month") || h.includes("short-term")) {
    return "Projected Outcomes (~1 month)";
  }
  return horizon;
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

  const hasAgentResult =
    !!output?.risk ||
    !!output?.aiInsights?.length ||
    !!output?.predictions?.length ||
    !!output?.strategies?.length ||
    !!output?.actionPlan?.length;

  const showRiskBadge = hasAgentResult;

  const stabilityLabel = riskLevel === "high" || riskLevel === "medium" ? "Unstable" : "Stable";
  const alertMessage =
    riskLevel === "high"
      ? "Urgent action required"
      : riskLevel === "medium"
      ? "Prepare mitigations"
      : "Continue monitoring";

  const autoEmailMessage =
    riskLevel === "high" ? "Auto-email escalation has been triggered" : "Auto-email escalation has not been triggered";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Analytics</h1>

          <p className="mt-1 text-sm text-gray-600">
            Analyze disruption signals, supply chain exposure, and operational risk using Kairos intelligence.
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-gray-600">
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
              🕒 Last Updated: <span className="font-medium">{datasetUpdated}</span>
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-gray-600">
            <span>
              🤖 Agent run as-of: <span className="font-medium">{runAsOf}</span>
            </span>
            <span className="text-gray-500">Auto-updates every hour</span>
          </div>
        </div>

        {updating ? (
          <div className="flex items-center pt-1 text-sm text-gray-500">
            <div className="flex items-center">
              <Spinner />
              <span className="ml-2">{statusText(tick)}</span>
            </div>
          </div>
        ) : null}
      </div>

      {error ? <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">🚨 Alert</div>
            {showRiskBadge ? (
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge(riskLevel)}`}>
                {icon(riskLevel)} {displayLevel(riskLevel)}
              </span>
            ) : null}
          </div>

          <div className="mt-2 text-3xl font-bold">{updating ? "—/100" : `${overallScore}/100`}</div>

          <div className="mt-2 text-sm text-white/90">
            <span className="font-semibold">{stabilityLabel}</span> · {alertMessage}
          </div>

          <div className="mt-3 rounded-xl bg-white/10 p-3 text-xs text-white/80">
            {updating ? "Refreshing alert status..." : autoEmailMessage}
          </div>
        </div>

        <GradientKpiCard
          title="☁️ Weather"
          score={weatherScore}
          level={levelFromScore(weatherScore)}
          guide={scoreGuide("weather")}
          gradient="from-sky-700 via-sky-600 to-cyan-500"
          loading={updating}
          loadingNote="Refreshing weather forecast signals..."
          showBadge={showRiskBadge}
        />

        <GradientKpiCard
          title="🌍 Geopolitics"
          score={geoScore}
          level={levelFromScore(geoScore)}
          guide={scoreGuide("geopolitics")}
          gradient="from-indigo-700 via-violet-600 to-fuchsia-500"
          loading={updating}
          loadingNote="Reviewing geopolitical developments..."
          showBadge={showRiskBadge}
        />

        <GradientKpiCard
          title="🚚 Logistics"
          score={logisticsScore}
          level={levelFromScore(logisticsScore)}
          guide={scoreGuide("logistics")}
          gradient="from-orange-700 via-amber-600 to-yellow-500"
          loading={updating}
          loadingNote="Checking transport and route disruptions..."
          showBadge={showRiskBadge}
        />
      </div>

      <SectionShell title="🧠 AI Insights" accent="violet">
        {updating ? (
          <div className="mt-3 rounded-xl bg-white/70 p-3 text-sm text-gray-600 shadow-sm ring-1 ring-white/70">
            Refreshing AI insights and signal summaries...
          </div>
        ) : insights.length === 0 ? (
          <div className="mt-2 text-sm text-gray-600">Waiting for first run…</div>
        ) : (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {insights.slice(0, 4).map((x: string, i: number) => (
              <div key={i} className="rounded-xl bg-white/70 p-3 text-sm text-gray-700 shadow-sm ring-1 ring-white/60">
                {x}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl bg-gradient-to-br from-sky-50 to-sky-100/60 p-4 ring-1 ring-sky-200">
            <div className="text-sm font-semibold text-sky-900">Weather signals</div>
            <SignalsList items={topWeather} emptyText={updating ? "Refreshing weather signals..." : "No signals yet."} />
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100/60 p-4 ring-1 ring-indigo-200">
            <div className="text-sm font-semibold text-indigo-900">Geopolitics signals</div>
            <SignalsList items={topGeo} emptyText={updating ? "Refreshing geopolitics signals..." : "No signals yet."} />
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-orange-50 to-amber-100/60 p-4 ring-1 ring-orange-200">
            <div className="text-sm font-semibold text-orange-900">Logistics signals</div>
            <SignalsList items={topLog} emptyText={updating ? "Refreshing logistics signals..." : "No signals yet."} />
          </div>
        </div>
      </SectionShell>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionShell title="🧭 Strategies and Predictions" accent="amber">
          {updating ? (
            <div className="mt-3 rounded-xl bg-white/70 p-3 text-sm text-gray-600 shadow-sm ring-1 ring-white/70">
              Updating strategies and projected outcomes...
            </div>
          ) : (
            <>
              <div className="mt-3">
                <div className="text-sm font-semibold text-amber-900">Strategies</div>
                {strategies.length === 0 ? (
                  <div className="mt-2 text-sm text-gray-600">No strategies yet.</div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {strategies.slice(0, 6).map((s: any, i: number) => {
                      const title = String(s?.title ?? "Strategy");
                      const body = String(s?.summary ?? "");
                      const effectiveness =
                        typeof s?.effectiveness === "number"
                          ? `${Math.round(s.effectiveness * 100)}%`
                          : s?.effectiveness
                          ? String(s.effectiveness)
                          : null;

                      return (
                        <div key={i} className="rounded-xl bg-white/70 p-3 shadow-sm ring-1 ring-white/70">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold">{title}</div>
                            {effectiveness ? (
                              <div className="text-xs text-gray-600">Effectiveness: {effectiveness}</div>
                            ) : null}
                          </div>
                          <div className="mt-2 text-sm leading-6 text-gray-700">{body}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-5">
                <div className="text-sm font-semibold text-amber-900">Predictions</div>
                {predictions.length === 0 ? (
                  <div className="mt-2 text-sm text-gray-600">No predictions yet.</div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {predictions.slice(0, 6).map((p: any, i: number) => {
                      const horizon = normalizePredictionTitle(String(p?.horizon ?? "Horizon"));
                      const title = String(p?.title ?? horizon);
                      const pred = String(p?.prediction ?? "");
                      const conf =
                        typeof p?.confidence === "number"
                          ? `${Math.round(p.confidence * 100)}%`
                          : p?.confidence
                          ? String(p.confidence)
                          : null;

                      return (
                        <div key={i} className="rounded-xl bg-white/70 p-3 shadow-sm ring-1 ring-white/70">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold">{title}</div>
                            {conf ? <div className="text-xs text-gray-600">Confidence: {conf}</div> : null}
                          </div>
                          <div className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                            {horizon}
                          </div>
                          <div className="mt-2 text-sm leading-6 text-gray-700">{pred}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </SectionShell>

        <SectionShell title="✅ Action Plan" accent="green">
          {updating ? (
            <div className="mt-3 rounded-xl bg-white/75 p-3 text-sm text-gray-600 shadow-sm ring-1 ring-white/70">
              Building detailed action plan...
            </div>
          ) : Array.isArray(actionPlan) && actionPlan.length > 0 ? (
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
                    <div className="mt-1 text-sm font-medium text-gray-800">{main}</div>
                    {extra ? <div className="mt-2 text-sm leading-6 text-gray-600">{extra}</div> : null}

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
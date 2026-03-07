"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
} from "recharts";
import { useKairosAgent } from "@/components/kairos/useKairosAgent";

function fmtMoney(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number) {
  return `${n.toFixed(1)}%`;
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function formatDateTime(value: unknown) {
  if (!value) return "—";
  if (typeof value === "string" || typeof value === "number" || value instanceof Date) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString();
  }
  return String(value);
}

const moneyTooltip = (value: number | string | undefined) => fmtMoney(Number(value ?? 0));

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
    "Loading supply chain data...",
    "Running disruption scenarios...",
    "Simulating mitigation strategies...",
  ];
  return cycle[tick % cycle.length];
}

function KpiCard({
  title,
  value,
  sub,
  gradient,
}: {
  title: string;
  value: string;
  sub: string;
  gradient: string;
}) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${gradient} p-5 text-white shadow-lg`}>
      <div className="text-sm font-medium text-white/85">{title}</div>
      <div className="mt-2 text-3xl font-bold tracking-tight">{value}</div>
      <div className="mt-2 text-xs text-white/80">{sub}</div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

type SavingsDriver = {
  name?: string;
  value?: number;
};

type AgentStrategy = {
  title?: string;
  summary?: string;
  effectiveness?: number;
};

type FinanceOpportunity = {
  title?: string;
  impact?: string;
  type?: string;
  level?: "low" | "medium" | "high";
  detail?: string;
};

type FinanceTrendPoint = {
  month?: string;
  revenue?: number;
  cost?: number;
  profit?: number;
};

type FinanceScenarioPoint = {
  stage?: string;
  value?: number;
};

export default function SimulationPage() {
  const { meta, insiderCount, output, agentAsOf, updating, error, update } = useKairosAgent();

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

  const datasetUpdated = formatDateTime(meta?.updatedAt ?? null);
  const runAsOf = formatDateTime(agentAsOf);

  const finance = output?.finance ?? {};
  const strategiesRaw = Array.isArray(output?.strategies) ? output.strategies : [];
  const overallRisk = toNumber(output?.risk?.overallScore);
  const marginPct = toNumber(finance.marginPct);

  const simulationSummary = useMemo(() => {
    const baselineProfit =
      toNumber(finance.currentProfit) || (toNumber(finance.currentRevenue) - toNumber(finance.currentCost));

    const projectedProfit = Math.max(
      baselineProfit,
      ...((finance.profitScenario ?? []).map((item: FinanceScenarioPoint) => toNumber(item?.value)))
    );

    return {
      baselineProfit,
      projectedProfit,
      costReduction: toNumber(finance.potentialSavings),
      downsideAvoided: toNumber(finance.lossAvoidance),
      addedValue: toNumber(finance.addedValue),
      expectedROI: toNumber(finance.profitLiftPct),
    };
  }, [finance]);

  const selectedStrategies = useMemo(() => {
    const colors = [
      "bg-sky-50 ring-sky-200 text-sky-700",
      "bg-violet-50 ring-violet-200 text-violet-700",
      "bg-emerald-50 ring-emerald-200 text-emerald-700",
      "bg-amber-50 ring-amber-200 text-amber-700",
    ];

    return strategiesRaw.slice(0, 4).map((item: AgentStrategy, i: number) => ({
      title: item?.title ?? "Strategy",
      color: colors[i % colors.length],
      detail: item?.summary ?? "",
    }));
  }, [strategiesRaw]);

  const avgEffectiveness = useMemo(() => {
    if (strategiesRaw.length === 0) return 0;
    const total = strategiesRaw.reduce(
      (sum: number, item: AgentStrategy) => sum + toNumber(item?.effectiveness),
      0
    );
    return total / strategiesRaw.length;
  }, [strategiesRaw]);

  const scenarios = useMemo(() => {
    const rawStages = (finance.profitScenario ?? [])
      .map((item: FinanceScenarioPoint) => ({
        name: String(item?.stage ?? "").trim(),
        value: toNumber(item?.value),
      }))
      .filter((item) => item.name && item.value > 0)
      .slice(0, 3);

    if (rawStages.length === 0) return [];

    const cards = [
      {
        badge: "bg-sky-100 text-sky-700",
        card: "bg-sky-50 ring-sky-200",
      },
      {
        badge: "bg-violet-100 text-violet-700",
        card: "bg-violet-50 ring-violet-200",
      },
      {
        badge: "bg-emerald-100 text-emerald-700",
        card: "bg-emerald-50 ring-emerald-200",
      },
    ];

    const baselineProfit = simulationSummary.baselineProfit;
    const maxProfit = Math.max(...rawStages.map((stage) => stage.value));
    const upliftSpan = Math.max(0, maxProfit - baselineProfit);

    return rawStages.map((stage, i) => {
      const share =
        upliftSpan > 0 ? clamp((stage.value - baselineProfit) / upliftSpan, 0, 1) : 0;

      const serviceLevel = clamp(
        94 + marginPct * 0.08 - overallRisk * 0.03 + share * 2 + avgEffectiveness * 1.2,
        90,
        99.9
      );

      const fillRate = clamp(serviceLevel + 0.5 + avgEffectiveness * 0.3, 90, 99.9);

      return {
        name: stage.name,
        profit: stage.value,
        savings: Math.round(simulationSummary.costReduction * share),
        lossAvoided: Math.round(simulationSummary.downsideAvoided * share),
        serviceLevel,
        fillRate,
        badge: cards[i % cards.length].badge,
        card: cards[i % cards.length].card,
      };
    });
  }, [
    finance.profitScenario,
    avgEffectiveness,
    marginPct,
    overallRisk,
    simulationSummary.baselineProfit,
    simulationSummary.costReduction,
    simulationSummary.downsideAvoided,
  ]);

  const comparisonData = useMemo(() => {
    const scenarioPoints = (finance.profitScenario ?? [])
      .map((item: FinanceScenarioPoint) => ({
        name: String(item?.stage ?? "").trim(),
        profit: toNumber(item?.value),
      }))
      .filter((item) => item.name && item.profit > 0);

    const maxProfit = Math.max(
      simulationSummary.baselineProfit,
      ...scenarioPoints.map((item) => item.profit)
    );
    const upliftSpan = Math.max(0, maxProfit - simulationSummary.baselineProfit);

    return [
      {
        name: "Baseline",
        profit: simulationSummary.baselineProfit,
        savings: 0,
        riskReduction: 0,
      },
      ...scenarioPoints.map((item) => {
        const share =
          upliftSpan > 0
            ? clamp((item.profit - simulationSummary.baselineProfit) / upliftSpan, 0, 1)
            : 0;

        return {
          name: item.name,
          profit: item.profit,
          savings: Math.round(simulationSummary.costReduction * share),
          riskReduction: Math.round(simulationSummary.downsideAvoided * share),
        };
      }),
    ];
  }, [
    finance.profitScenario,
    simulationSummary.baselineProfit,
    simulationSummary.costReduction,
    simulationSummary.downsideAvoided,
  ]);

  const rolloutTrend = useMemo(() => {
    return (finance.monthlyTrend ?? [])
      .map((point: FinanceTrendPoint) => ({
        week: String(point?.month ?? "").trim(),
        baseline: simulationSummary.baselineProfit,
        simulated: toNumber(point?.profit),
      }))
      .filter((item) => item.week && item.simulated !== 0)
      .slice(-6);
  }, [finance.monthlyTrend, simulationSummary.baselineProfit]);

  const estimatedOutcomes = useMemo(() => {
    const boxes = [
      { box: "bg-sky-50 ring-sky-200", pill: "bg-sky-600" },
      { box: "bg-rose-50 ring-rose-200", pill: "bg-rose-600" },
      { box: "bg-violet-50 ring-violet-200", pill: "bg-violet-600" },
      { box: "bg-emerald-50 ring-emerald-200", pill: "bg-emerald-600" },
    ];

    return (finance.opportunities ?? []).slice(0, 4).map((item: FinanceOpportunity, i: number) => ({
      title: item?.title ?? "Outcome",
      value: item?.impact ?? "—",
      description: item?.detail ?? "",
      box: boxes[i % boxes.length].box,
      pill: boxes[i % boxes.length].pill,
    }));
  }, [finance.opportunities]);

  const savingsDrivers = useMemo(() => {
    return (finance.savingsDrivers ?? [])
      .slice(0, 5)
      .map((item: SavingsDriver) => ({
        name: item?.name ?? "—",
        value: toNumber(item?.value),
      }))
      .filter((item) => item.name && item.value > 0);
  }, [finance.savingsDrivers]);

  const barColors = ["#60A5FA", "#A78BFA", "#34D399", "#F59E0B"];

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Simulation</h1>

            <p className="mt-1 text-sm text-gray-600">
              Run predictive scenarios to evaluate disruption impact and test mitigation strategies across your supply chain using Kairos intelligence.
            </p>

            <div className="mt-1 flex flex-wrap gap-6 text-sm text-slate-600">
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
                🕒 Last updated: <span className="font-medium">{datasetUpdated}</span>
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-slate-600">
              <span>
                🤖 Agent run as-of: <span className="font-medium">{runAsOf}</span>
              </span>
              <span className="text-slate-500">Auto-updates every hour</span>
            </div>
          </div>
        </div>

        {updating ? (
          <div className="flex items-center pt-1 text-sm text-slate-500">
            <div className="flex items-center">
              <Spinner />
              <span className="ml-2">{statusText(tick)}</span>
            </div>
          </div>
        ) : null}
      </div>

      {error ? <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          title="Baseline Profit"
          value={updating ? "—" : fmtMoney(simulationSummary.baselineProfit)}
          sub="Current operating baseline"
          gradient="from-slate-700 via-slate-600 to-slate-500"
        />
        <KpiCard
          title="Projected Profit"
          value={updating ? "—" : fmtMoney(simulationSummary.projectedProfit)}
          sub="Estimated outcome after strategy rollout"
          gradient="from-violet-700 via-indigo-600 to-blue-500"
        />
        <KpiCard
          title="Cost Reduction"
          value={updating ? "—" : fmtMoney(simulationSummary.costReduction)}
          sub="Estimated avoidable operating spend"
          gradient="from-sky-700 via-cyan-600 to-blue-500"
        />
        <KpiCard
          title="Downside Avoided"
          value={updating ? "—" : fmtMoney(simulationSummary.downsideAvoided)}
          sub="Loss prevented from disruption response"
          gradient="from-amber-600 via-orange-500 to-rose-500"
        />
        <KpiCard
          title="Expected ROI"
          value={updating ? "—" : fmtPct(simulationSummary.expectedROI)}
          sub="Modeled return from selected strategy mix"
          gradient="from-emerald-700 via-green-600 to-teal-500"
        />
      </div>

      <SectionCard
        title="Selected simulation strategies"
        subtitle="These controls define the current modeled scenario"
      >
        {updating ? (
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
            Updating strategies and projected outcomes...
          </div>
        ) : selectedStrategies.length === 0 ? (
          <div className="text-sm text-slate-600">No strategies yet.</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {selectedStrategies.map((item, i) => (
              <div key={i} className={`rounded-2xl p-4 ring-1 ${item.color}`}>
                <div className="text-sm font-semibold">{item.title}</div>
                <div className="mt-2 text-sm leading-6 text-slate-700">{item.detail}</div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {scenarios.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-3">
          {scenarios.map((scenario, i) => (
            <div key={i} className={`rounded-2xl p-5 shadow-sm ring-1 ${scenario.card}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="text-lg font-semibold text-slate-900">{scenario.name}</div>
                <div className={`rounded-full px-3 py-1 text-xs font-semibold ${scenario.badge}`}>
                  Scenario
                </div>
              </div>

              <div className="mt-4 text-3xl font-bold text-slate-900">{fmtMoney(scenario.profit)}</div>
              <div className="mt-1 text-sm text-slate-500">Estimated profit outcome</div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/75 p-3 ring-1 ring-white/80">
                  <div className="text-xs text-slate-500">Savings</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{fmtMoney(scenario.savings)}</div>
                </div>
                <div className="rounded-xl bg-white/75 p-3 ring-1 ring-white/80">
                  <div className="text-xs text-slate-500">Loss avoided</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{fmtMoney(scenario.lossAvoided)}</div>
                </div>
                <div className="rounded-xl bg-white/75 p-3 ring-1 ring-white/80">
                  <div className="text-xs text-slate-500">Service level</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{fmtPct(scenario.serviceLevel)}</div>
                </div>
                <div className="rounded-xl bg-white/75 p-3 ring-1 ring-white/80">
                  <div className="text-xs text-slate-500">Fill rate</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{fmtPct(scenario.fillRate)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !updating ? (
        <div className="rounded-2xl bg-white p-5 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
          No simulation scenarios yet.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Scenario comparison"
          subtitle="Compare expected profit, savings, and avoided downside across modeled cases"
        >
          {comparisonData.length <= 1 ? (
            <div className="text-sm text-slate-600">
              {updating ? "Refreshing scenario comparison..." : "No scenario comparison yet."}
            </div>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={moneyTooltip} />
                  <Bar dataKey="profit" radius={[8, 8, 0, 0]} fill="#6366f1" />
                  <Bar dataKey="savings" radius={[8, 8, 0, 0]} fill="#0ea5e9" />
                  <Bar dataKey="riskReduction" radius={[8, 8, 0, 0]} fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Projected rollout impact"
          subtitle="Estimated value progression as strategies begin taking effect"
        >
          {rolloutTrend.length === 0 ? (
            <div className="text-sm text-slate-600">
              {updating ? "Refreshing rollout impact..." : "No rollout trend yet."}
            </div>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rolloutTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={moneyTooltip} />
                  <Line type="monotone" dataKey="baseline" stroke="#94a3b8" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="simulated" stroke="#16a34a" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Estimated outcome drivers"
        subtitle="Where the modeled value is coming from"
      >
        {estimatedOutcomes.length === 0 ? (
          <div className="text-sm text-slate-600">
            {updating ? "Refreshing outcome drivers..." : "No outcome drivers yet."}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {estimatedOutcomes.map((item, i) => (
              <div key={i} className={`rounded-2xl p-4 ring-1 ${item.box}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="font-semibold text-slate-900">{item.title}</div>
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${item.pill}`}>
                    {item.value}
                  </div>
                </div>
                <div className="mt-3 text-sm leading-6 text-slate-700">{item.description}</div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Savings mix"
        subtitle="Relative contribution by strategy lever"
      >
        {savingsDrivers.length === 0 ? (
          <div className="text-sm text-slate-600">
            {updating ? "Refreshing savings mix..." : "No savings mix yet."}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-5">
            {savingsDrivers.map((item, i) => (
              <div key={i} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div
                  className="mb-3 h-2 rounded-full"
                  style={{ backgroundColor: barColors[i % barColors.length] }}
                />
                <div className="text-sm font-semibold text-slate-900">{item.name}</div>
                <div className="mt-2 text-xl font-bold text-slate-900">{fmtMoney(item.value)}</div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
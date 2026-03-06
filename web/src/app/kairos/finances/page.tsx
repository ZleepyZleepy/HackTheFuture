"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
} from "recharts";
import { useKairosAgent } from "@/components/kairos/useKairosAgent";

function icon(level: string) {
  const l = String(level || "").toLowerCase();
  if (l === "high") return "🔴";
  if (l === "medium" || l === "moderate") return "🟠";
  return "🟢";
}

function displayLevel(level: string) {
  return level === "medium" ? "moderate" : level;
}

function fmtMoney(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number) {
  return `${n.toFixed(1)}%`;
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
    "Collecting finance inputs...",
    "Estimating profitability scenarios...",
    "Generating finance recommendations...",
  ];
  return cycle[tick % cycle.length];
}

function FinanceKpiCard({
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const moneyTooltip = (value: number | string | undefined) => fmtMoney(Number(value ?? 0));
const percentTooltip = (value: number | string | undefined) => `${Number(value ?? 0).toFixed(1)}%`;

function moneyOrDash(isLoading: boolean, n: number) {
  return isLoading ? "—" : fmtMoney(n);
}

function fmtDisplayLevel(level: string) {
  const s = displayLevel(level);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function impactPillClass(level: string) {
  const l = String(level || "").toLowerCase();
  if (l === "high") return "bg-red-100 text-red-800";
  if (l === "medium" || l === "moderate") return "bg-amber-100 text-amber-800";
  return "bg-emerald-100 text-emerald-800";
}

function opportunityBoxByIndex(i: number) {
  const boxes = [
    "bg-cyan-50 ring-cyan-200",
    "bg-orange-50 ring-orange-200",
    "bg-fuchsia-50 ring-fuchsia-200",
    "bg-lime-50 ring-lime-200",
  ];
  return boxes[i] ?? boxes[i % 4];
}

export default function FinancePage() {
  const { meta, insiderCount, output, agentAsOf, updating, error, update } = useKairosAgent();

  const runAsOf = agentAsOf ? new Date(agentAsOf).toLocaleString() : "—";

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

  const finance = {
    currentRevenue: Number(output?.finance?.currentRevenue ?? 0),
    currentCost: Number(output?.finance?.currentCost ?? 0),
    currentProfit: Number(output?.finance?.currentProfit ?? 0),
    marginPct: Number(output?.finance?.marginPct ?? 0),
    potentialSavings: Number(output?.finance?.potentialSavings ?? 0),
    lossAvoidance: Number(output?.finance?.lossAvoidance ?? 0),
    addedValue: Number(output?.finance?.addedValue ?? 0),
    profitLiftPct: Number(output?.finance?.profitLiftPct ?? 0),
    monthlyTrend: output?.finance?.monthlyTrend ?? [],
    savingsDrivers: output?.finance?.savingsDrivers ?? [],
    profitScenario: output?.finance?.profitScenario ?? [],
    marginTrend: output?.finance?.marginTrend ?? [],
    opportunities: output?.finance?.opportunities ?? [],
  };

  const monthlyTrend = useMemo(() => finance.monthlyTrend ?? [], [finance.monthlyTrend]);
  const savingsDrivers = useMemo(() => finance.savingsDrivers ?? [], [finance.savingsDrivers]);
  const profitScenario = useMemo(() => finance.profitScenario ?? [], [finance.profitScenario]);
  const marginTrend = useMemo(() => finance.marginTrend ?? [], [finance.marginTrend]);
  const opportunities = useMemo(() => (finance.opportunities ?? []).slice(0, 4), [finance.opportunities]);

  const hasFinanceResult =
    !!output?.finance &&
    (
      monthlyTrend.length > 0 ||
      savingsDrivers.length > 0 ||
      profitScenario.length > 0 ||
      marginTrend.length > 0 ||
      opportunities.length > 0
    );

  const showDashValues = updating || !hasFinanceResult;

  const datasetUpdated =
    meta?.updatedAt instanceof Date
      ? meta.updatedAt.toLocaleString()
      : meta?.updatedAt
      ? new Date(meta.updatedAt as any).toLocaleString()
      : "—";

  const savingsColors = ["#0EA5E9", "#8B5CF6", "#F97316", "#22C55E", "#EC4899"];
  const upliftColors = ["#2563EB", "#A855F7", "#F59E0B", "#10B981", "#EC4899"];

  return (
    <div className="space-y-4">
    <div className="space-y-2">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-slate-900">Finance</h1>

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
            🕒 Last updated: <span className="font-medium">{datasetUpdated}</span>
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard
          title="Current Profit"
          value={moneyOrDash(showDashValues, finance.currentProfit)}
          sub={showDashValues ? "Generating current margin estimate" : `Current margin: ${fmtPct(finance.marginPct)}`}
          gradient="from-emerald-700 via-green-600 to-teal-500"
        />
        <FinanceKpiCard
          title="Potential Savings"
          value={moneyOrDash(showDashValues, finance.potentialSavings)}
          sub={showDashValues ? "Estimating cost reduction opportunity" : "Direct cost reduction opportunity"}
          gradient="from-blue-700 via-indigo-600 to-violet-500"
        />
        <FinanceKpiCard
          title="Potential Loss Avoided"
          value={moneyOrDash(showDashValues, finance.lossAvoidance)}
          sub={showDashValues ? "Estimating preventable downside" : "Preventable disruption-related downside"}
          gradient="from-amber-600 via-orange-500 to-red-500"
        />
        <FinanceKpiCard
          title="Potential Added Value"
          value={moneyOrDash(showDashValues, finance.addedValue)}
          sub={showDashValues ? "Estimating profit lift" : `Estimated profit lift: ${fmtPct(finance.profitLiftPct)}`}
          gradient="from-fuchsia-700 via-pink-600 to-rose-500"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SectionCard
            title="Profitability trend"
            subtitle="Track revenue, cost, and profit trajectory over time"
          >
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrend}>
                  <defs>
                    <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={moneyTooltip} />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    stroke="#16a34a"
                    strokeWidth={3}
                    fill="url(#profitFill)"
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="cost" stroke="#ef4444" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>

        <div>
          <SectionCard
            title="Margin trend"
            subtitle="Profit margin improvement over recent periods"
          >
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={marginTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={percentTooltip} />
                  <Line type="monotone" dataKey="margin" stroke="#7c3aed" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Savings opportunities"
          subtitle="Largest cost reduction levers across operations"
        >
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={savingsDrivers} layout="vertical" margin={{ left: 0, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="value" type="number" tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`} tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" width={135} tick={{ fontSize: 12 }} tickMargin={6} />
                <Tooltip formatter={moneyTooltip} />
                <Bar dataKey="value" radius={[0, 10, 10, 0]}>
                  {savingsDrivers.map((_: any, i: number) => (
                    <Cell key={i} fill={savingsColors[i % savingsColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Profit uplift scenario"
          subtitle="How much value could be unlocked after finance improvements"
        >
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={profitScenario}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={moneyTooltip} />
                <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                  {profitScenario.map((_: any, i: number) => (
                    <Cell key={i} fill={upliftColors[i % upliftColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="High-impact finance opportunities">
        {hasFinanceResult ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {opportunities.map((item: any, i: number) => {
              const box = opportunityBoxByIndex(i);
              const level = String(item?.level ?? "medium");

              return (
                <div key={i} className={`rounded-2xl p-4 ring-1 ${box}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-semibold text-slate-900">{String(item?.title ?? "Opportunity")}</div>
                    <div className={`rounded-full px-3 py-1 text-xs font-semibold ${impactPillClass(level)}`}>
                      {icon(level)}{fmtDisplayLevel(level)}
                    </div>
                  </div>

                  <div className="mt-2 text-xs font-medium text-slate-500">
                    {String(item?.type ?? "Finance")}
                  </div>
                  <div className="mt-3 text-sm leading-6 text-slate-700">{String(item?.detail ?? "")}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-slate-500">
            {updating ? "Generating finance opportunities..." : "No finance opportunities yet."}
          </div>
        )}
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl bg-sky-50 p-4 shadow-sm ring-1 ring-sky-200">
          <div className="text-sm text-sky-700">Revenue</div>
          <div className="mt-2 text-2xl font-bold text-sky-700">
            {moneyOrDash(showDashValues, finance.currentRevenue)}
          </div>
        </div>
        <div className="rounded-2xl bg-rose-50 p-4 shadow-sm ring-1 ring-rose-200">
          <div className="text-sm text-rose-700">Cost Base</div>
          <div className="mt-2 text-2xl font-bold text-rose-700">
            {moneyOrDash(showDashValues, finance.currentCost)}
          </div>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-4 shadow-sm ring-1 ring-emerald-200">
          <div className="text-sm text-emerald-700">Potential Net Upside</div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">
            {showDashValues
              ? "—"
              : fmtMoney(finance.potentialSavings + finance.lossAvoidance + finance.addedValue)}
          </div>
        </div>
        <div className="rounded-2xl bg-violet-50 p-4 shadow-sm ring-1 ring-violet-200">
          <div className="text-sm text-violet-700">Projected Profit</div>
          <div className="mt-2 text-2xl font-bold text-violet-700">
            {showDashValues
              ? "—"
              : fmtMoney(
                  finance.currentProfit + finance.potentialSavings + finance.lossAvoidance + finance.addedValue
                )}
          </div>
        </div>
      </div>
    </div>
  );
}
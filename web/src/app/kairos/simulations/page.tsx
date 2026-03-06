"use client";

import Link from "next/link";
import {
  ResponsiveContainer,
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

function fmtMoney(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number) {
  return `${n.toFixed(1)}%`;
}

const moneyTooltip = (value: number | string | undefined) => fmtMoney(Number(value ?? 0));
const percentTooltip = (value: number | string | undefined) => `${Number(value ?? 0).toFixed(1)}%`;

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
  name: string;
  value: number;
};

const savingsDrivers: SavingsDriver[] = [
  { name: "Route optimization", value: 42000 },
  { name: "Supplier renegotiation", value: 31000 },
  { name: "Lower expedite spend", value: 22000 },
  { name: "Inventory rebalancing", value: 18000 },
  { name: "Storage reduction", value: 15000 },
];

export default function SimulationPage() {
  const meta = {
    sourceFileName: "agriculture_supply_chain_sample.csv",
    count: 124,
    updatedAt: "2026-03-05 3:42 PM",
  };
  const insiderCount = 5;

  const simulationSummary = {
    baselineProfit: 443000,
    projectedProfit: 612000,
    costReduction: 97000,
    downsideAvoided: 72000,
    addedValue: 54000,
    expectedROI: 18.4,
  };

  const selectedStrategies = [
    {
      title: "Dynamic rerouting",
      color: "bg-sky-50 ring-sky-200 text-sky-700",
      detail: "Shift exposed shipments from delayed lanes to alternate corridors when thresholds are triggered.",
    },
    {
      title: "Supplier split allocation",
      color: "bg-violet-50 ring-violet-200 text-violet-700",
      detail: "Spread volume across primary and backup suppliers to reduce concentration and late-fill risk.",
    },
    {
      title: "Targeted safety stock",
      color: "bg-emerald-50 ring-emerald-200 text-emerald-700",
      detail: "Build extra coverage only for high-margin or disruption-sensitive inputs.",
    },
    {
      title: "Expedite approval controls",
      color: "bg-amber-50 ring-amber-200 text-amber-700",
      detail: "Tighten urgent spend rules and reserve premium freight for highest-value cases.",
    },
  ];

  const scenarios = [
    {
      name: "Conservative",
      profit: 522000,
      savings: 54000,
      lossAvoided: 31000,
      serviceLevel: 95.8,
      fillRate: 96.4,
      badge: "bg-sky-100 text-sky-700",
      card: "bg-sky-50 ring-sky-200",
    },
    {
      name: "Balanced",
      profit: 612000,
      savings: 97000,
      lossAvoided: 72000,
      serviceLevel: 97.1,
      fillRate: 97.6,
      badge: "bg-violet-100 text-violet-700",
      card: "bg-violet-50 ring-violet-200",
    },
    {
      name: "Aggressive",
      profit: 688000,
      savings: 131000,
      lossAvoided: 94000,
      serviceLevel: 97.8,
      fillRate: 98.2,
      badge: "bg-emerald-100 text-emerald-700",
      card: "bg-emerald-50 ring-emerald-200",
    },
  ];

  const comparisonData = [
    { name: "Baseline", profit: 443000, savings: 0, riskReduction: 0 },
    { name: "Conservative", profit: 522000, savings: 54000, riskReduction: 31000 },
    { name: "Balanced", profit: 612000, savings: 97000, riskReduction: 72000 },
    { name: "Aggressive", profit: 688000, savings: 131000, riskReduction: 94000 },
  ];

  const rolloutTrend = [
    { week: "W1", baseline: 443000, simulated: 468000 },
    { week: "W2", baseline: 443000, simulated: 497000 },
    { week: "W3", baseline: 443000, simulated: 538000 },
    { week: "W4", baseline: 443000, simulated: 565000 },
    { week: "W5", baseline: 443000, simulated: 592000 },
    { week: "W6", baseline: 443000, simulated: 612000 },
  ];

  const barColors = ["#60A5FA", "#A78BFA", "#34D399", "#F59E0B"];

  const estimatedOutcomes = [
    {
      title: "Freight spend reduction",
      value: "$42,000",
      description: "Lower reliance on premium rerouting and rushed bookings by switching earlier.",
      box: "bg-sky-50 ring-sky-200",
      pill: "bg-sky-600",
    },
    {
      title: "Delay-loss prevention",
      value: "$29,000",
      description: "Reduce missed deliveries, spoilage risk, and emergency handling costs during disruption windows.",
      box: "bg-rose-50 ring-rose-200",
      pill: "bg-rose-600",
    },
    {
      title: "Supplier resilience uplift",
      value: "$25,000",
      description: "Improve fulfillment consistency by splitting volume and keeping second-source capacity warm.",
      box: "bg-violet-50 ring-violet-200",
      pill: "bg-violet-600",
    },
    {
      title: "Margin-focused allocation",
      value: "$54,000",
      description: "Direct constrained inputs toward higher-value outputs and protect more profitable demand.",
      box: "bg-emerald-50 ring-emerald-200",
      pill: "bg-emerald-600",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">🧪 Simulation</h1>

          <div className="mt-1 flex flex-wrap gap-6 text-sm text-slate-600">
            <span>
              📄 Dataset: <span className="font-medium">{meta.sourceFileName}</span> ·{" "}
              <span className="font-medium">{meta.count}</span> rows
            </span>

            <span>
              🕵️ Insider Sources: <span className="font-medium">{insiderCount}</span>{" "}
              <Link href="/kairos/sources" className="hover:underline">
                (manage)
              </Link>
            </span>

            <span>
              🕒 Last updated: <span className="font-medium">{meta.updatedAt}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          title="Baseline Profit"
          value={fmtMoney(simulationSummary.baselineProfit)}
          sub="Current operating baseline"
          gradient="from-slate-700 via-slate-600 to-slate-500"
        />
        <KpiCard
          title="Projected Profit"
          value={fmtMoney(simulationSummary.projectedProfit)}
          sub="Estimated outcome after strategy rollout"
          gradient="from-violet-700 via-indigo-600 to-blue-500"
        />
        <KpiCard
          title="Cost Reduction"
          value={fmtMoney(simulationSummary.costReduction)}
          sub="Estimated avoidable operating spend"
          gradient="from-sky-700 via-cyan-600 to-blue-500"
        />
        <KpiCard
          title="Downside Avoided"
          value={fmtMoney(simulationSummary.downsideAvoided)}
          sub="Loss prevented from disruption response"
          gradient="from-amber-600 via-orange-500 to-rose-500"
        />
        <KpiCard
          title="Expected ROI"
          value={fmtPct(simulationSummary.expectedROI)}
          sub="Modeled return from selected strategy mix"
          gradient="from-emerald-700 via-green-600 to-teal-500"
        />
      </div>

      <SectionCard
        title="Selected simulation strategies"
        subtitle="These controls define the current modeled scenario"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {selectedStrategies.map((item, i) => (
            <div key={i} className={`rounded-2xl p-4 ring-1 ${item.color}`}>
              <div className="text-sm font-semibold">{item.title}</div>
              <div className="mt-2 text-sm leading-6 text-slate-700">{item.detail}</div>
            </div>
          ))}
        </div>
      </SectionCard>

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

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Scenario comparison"
          subtitle="Compare expected profit, savings, and avoided downside across modeled cases"
        >
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
        </SectionCard>

        <SectionCard
          title="Projected rollout impact"
          subtitle="Estimated value progression as strategies begin taking effect"
        >
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
        </SectionCard>
      </div>

      <SectionCard
        title="Estimated outcome drivers"
        subtitle="Where the modeled value is coming from"
      >
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
      </SectionCard>

      <SectionCard
        title="Savings mix"
        subtitle="Relative contribution by strategy lever"
      >
        <div className="grid gap-3 md:grid-cols-5">
          {savingsDrivers.map((item: SavingsDriver, i: number) => (
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
      </SectionCard>
    </div>
  );
}
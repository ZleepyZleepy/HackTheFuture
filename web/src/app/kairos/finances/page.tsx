"use client";

import Link from "next/link";
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

function fmtMoney(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number) {
  return `${n.toFixed(1)}%`;
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

export default function FinancePage() {
  const meta = {
    sourceFileName: "agriculture_supply_chain_sample.csv",
    count: 124,
    updatedAt: "2026-03-05 3:42 PM",
  };
  const insiderCount = 5;

  const finance = {
    currentRevenue: 1825000,
    currentCost: 1382000,
    currentProfit: 443000,
    marginPct: 24.3,
    potentialSavings: 128000,
    lossAvoidance: 94000,
    addedValue: 167000,
    profitLiftPct: 8.6,
  };

  const monthlyTrend = [
    { month: "Oct", revenue: 1540000, cost: 1210000, profit: 330000 },
    { month: "Nov", revenue: 1610000, cost: 1265000, profit: 345000 },
    { month: "Dec", revenue: 1680000, cost: 1320000, profit: 360000 },
    { month: "Jan", revenue: 1710000, cost: 1348000, profit: 362000 },
    { month: "Feb", revenue: 1770000, cost: 1367000, profit: 403000 },
    { month: "Mar", revenue: 1825000, cost: 1382000, profit: 443000 },
  ];

  const savingsDrivers = [
    { name: "Route optimization", value: 42000 },
    { name: "Supplier renegotiation", value: 31000 },
    { name: "Lower expedite spend", value: 22000 },
    { name: "Inventory rebalancing", value: 18000 },
    { name: "Storage reduction", value: 15000 },
  ];

  const profitScenario = [
    { stage: "Current", value: 443000 },
    { stage: "Cost savings", value: 571000 },
    { stage: "Loss avoided", value: 665000 },
    { stage: "Added value", value: 832000 },
  ];

  const marginTrend = [
    { month: "Oct", margin: 21.4 },
    { month: "Nov", margin: 21.4 },
    { month: "Dec", margin: 21.4 },
    { month: "Jan", margin: 21.2 },
    { month: "Feb", margin: 22.8 },
    { month: "Mar", margin: 24.3 },
  ];

  const opportunities = [
    {
      title: "Reduce expedited freight",
      impact: "$42,000",
      type: "Cost reduction",
      detail:
        "Too much spend is concentrated in late reroutes and rush shipments. Better forecasting and lane switching rules can cut this fast.",
      box: "bg-cyan-50 ring-cyan-200",
      pill: "bg-cyan-600",
    },
    {
      title: "Prevent weather-related spoilage and delay losses",
      impact: "$28,000",
      type: "Loss avoided",
      detail:
        "Improved signal monitoring and buffer allocation can reduce write-offs, missed delivery penalties, and unplanned handling costs.",
      box: "bg-orange-50 ring-orange-200",
      pill: "bg-orange-600",
    },
    {
      title: "Improve supplier price discipline",
      impact: "$31,000",
      type: "Margin improvement",
      detail:
        "High-spend inputs are still being purchased with weak negotiation leverage. Consolidated demand and alternate bids should improve terms.",
      box: "bg-fuchsia-50 ring-fuchsia-200",
      pill: "bg-fuchsia-600",
    },
    {
      title: "Unlock higher-value allocation",
      impact: "$64,000",
      type: "Added value",
      detail:
        "Shifting scarce inputs toward higher-margin outputs increases total contribution without increasing total supply.",
      box: "bg-lime-50 ring-lime-200",
      pill: "bg-lime-600",
    },
  ];

  const savingsColors = ["#0EA5E9", "#8B5CF6", "#F97316", "#22C55E", "#EC4899"];
  const upliftColors = ["#2563EB", "#A855F7", "#F59E0B", "#10B981"];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">💰 Finance</h1>

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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard
          title="Current Profit"
          value={fmtMoney(finance.currentProfit)}
          sub={`Current margin: ${fmtPct(finance.marginPct)}`}
          gradient="from-emerald-700 via-green-600 to-teal-500"
        />
        <FinanceKpiCard
          title="Potential Savings"
          value={fmtMoney(finance.potentialSavings)}
          sub="Direct cost reduction opportunity"
          gradient="from-blue-700 via-indigo-600 to-violet-500"
        />
        <FinanceKpiCard
          title="Potential Loss Avoided"
          value={fmtMoney(finance.lossAvoidance)}
          sub="Preventable disruption-related downside"
          gradient="from-amber-600 via-orange-500 to-red-500"
        />
        <FinanceKpiCard
          title="Potential Added Value"
          value={fmtMoney(finance.addedValue)}
          sub={`Estimated profit lift: ${fmtPct(finance.profitLiftPct)}`}
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
                  <YAxis domain={[18, 26]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
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
              <BarChart data={savingsDrivers} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`} tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                <Tooltip formatter={moneyTooltip} />
                <Bar dataKey="value" radius={[0, 10, 10, 0]}>
                  {savingsDrivers.map((_, i) => (
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
                  {profitScenario.map((_, i) => (
                    <Cell key={i} fill={upliftColors[i % upliftColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="High-impact finance opportunities">
        <div className="grid gap-4 lg:grid-cols-2">
          {opportunities.map((item, i) => (
            <div key={i} className={`rounded-2xl p-4 ring-1 ${item.box}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="font-semibold text-slate-900">{item.title}</div>
                <div className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${item.pill}`}>
                  {item.impact}
                </div>
              </div>

              <div className="mt-2 text-xs font-medium text-slate-500">{item.type}</div>
              <div className="mt-3 text-sm leading-6 text-slate-700">{item.detail}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl bg-sky-50 p-4 shadow-sm ring-1 ring-sky-200">
          <div className="text-sm text-sky-700">Revenue</div>
          <div className="mt-2 text-2xl font-bold text-sky-700">{fmtMoney(finance.currentRevenue)}</div>
        </div>
        <div className="rounded-2xl bg-rose-50 p-4 shadow-sm ring-1 ring-rose-200">
          <div className="text-sm text-rose-700">Cost Base</div>
          <div className="mt-2 text-2xl font-bold text-rose-700">{fmtMoney(finance.currentCost)}</div>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-4 shadow-sm ring-1 ring-emerald-200">
          <div className="text-sm text-emerald-700">Potential Net Upside</div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">
            {fmtMoney(finance.potentialSavings + finance.lossAvoidance + finance.addedValue)}
          </div>
        </div>
        <div className="rounded-2xl bg-violet-50 p-4 shadow-sm ring-1 ring-violet-200">
          <div className="text-sm text-violet-700">Projected Profit</div>
          <div className="mt-2 text-2xl font-bold text-violet-700">
            {fmtMoney(finance.currentProfit + finance.potentialSavings + finance.lossAvoidance + finance.addedValue)}
          </div>
        </div>
      </div>
    </div>
  );
}
"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";

export type KairosKpi = {
  totalSpend: number;
  avgLeadTime: number;
  avgStorage: number;
  stockoutRiskPct: number;
  topSupplier: { name: string; sharePct: number } | null;
};

export type KairosChartData = {
  spendByProduct: { name: string; value: number }[];
  spendBySupplier: { name: string; value: number }[];
  leadTimeTrend: { date: string; leadTimeDays: number; storageDays: number }[];
};

const money = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0
  );

const COLORS = ["#3b82f6", "#22c55e", "#ef4444", "#f59e0b", "#a855f7", "#06b6d4", "#64748b"];

export function KpiRow({ kpi }: { kpi: KairosKpi }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <KpiCard tone="blue" title="💰 Total Spend" value={money(kpi.totalSpend)} sub="Qty × cost per unit" />
      <KpiCard tone="green" title="⏱️ Average Lead Time" value={`${Math.round(kpi.avgLeadTime)} days`} sub="Delay sensitivity" />
      <KpiCard
        tone="red"
        title="🚨 Stockout Probability"
        value={`${Math.round(kpi.stockoutRiskPct)}%`}
        sub={`Avg storage: ${Math.round(kpi.avgStorage)} days`}
      />
      <KpiCard
        tone="slate"
        title="🧩 Top Supplier Exposure"
        value={kpi.topSupplier ? `${kpi.topSupplier.name}` : "—"}
        sub={kpi.topSupplier ? `${Math.round(kpi.topSupplier.sharePct)}% of spend` : "Upload data to compute"}
      />
    </div>
  );
}

function KpiCard({
  title,
  value,
  sub,
  tone,
}: {
  title: string;
  value: string;
  sub: string;
  tone: "blue" | "green" | "red" | "slate";
}) {
  const toneCls =
    tone === "blue"
      ? "bg-blue-50 border-blue-100"
      : tone === "green"
      ? "bg-green-50 border-green-100"
      : tone === "red"
      ? "bg-red-50 border-red-100"
      : "bg-slate-50 border-slate-200";

  return (
    <div className={`rounded-xl border ${toneCls} p-4`}>
      <div className="text-xs font-semibold text-slate-600">{title}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-600">{sub}</div>
    </div>
  );
}

export function ChartsGrid({ data }: { data: KairosChartData }) {
  const hasAny =
    (data.spendByProduct?.length ?? 0) > 0 ||
    (data.spendBySupplier?.length ?? 0) > 0 ||
    (data.leadTimeTrend?.length ?? 0) > 0;

  if (!hasAny) {
    return (
      <div className="rounded-xl border bg-white p-6 text-sm text-slate-600">
        📈 Upload Data and click <span className="font-semibold">Update agent analysis</span> to populate charts.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="rounded-xl border bg-white p-4">
        <div className="mb-2 text-sm font-semibold text-slate-800">📦 Spend by Product</div>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.spendByProduct}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" hide />
              <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: any) => money(Number(v))} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="mb-2 text-sm font-semibold text-slate-800">🏭 Exposure by Supplier</div>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data.spendBySupplier} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
                {data.spendBySupplier.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => money(Number(v))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 xl:col-span-2">
        <div className="mb-2 text-sm font-semibold text-slate-800">📉 Lead Time vs Storage</div>
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.leadTimeTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="leadTimeDays" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="storageDays" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { useKairosData } from "@/components/kairos/useKairosData";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function fmtMoneyCAD(n: number) {
  const value = Number.isFinite(n) ? n : 0;
  return "$" + value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtNum(n: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(Number.isFinite(n) ? n : 0);
}

/* ---------- KPI CARD ---------- */

function KpiCard({
  title,
  value,
  sub,
  className,
}: {
  title: string;
  value: string;
  sub?: string | string[];
  className: string;
}) {
  const lines = Array.isArray(sub) ? sub : sub ? [sub] : [];

  return (
    <div className={`rounded-2xl p-4 text-white shadow-sm ${className}`}>
      <div className="text-xs opacity-90">{title}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>

      {lines.length > 0 && (
        <div className="mt-1 space-y-0.5 text-xs opacity-90">
          {lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- MULTI LINE PRODUCT LABEL ---------- */

function wrapLabelTwoLines(label: string) {
  const words = String(label ?? "").split(" ");

  if (words.length <= 1) return [label];

  if (words.length === 2) return words;

  const mid = Math.ceil(words.length / 2);

  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

function ProductTick(props: any) {
  const { x, y, payload } = props;

  const lines = wrapLabelTwoLines(payload.value);

  return (
    <text x={x} y={y + 10} textAnchor="middle" fill="#64748b" fontSize={12}>
      {lines.map((line: string, i: number) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : 14}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/* ---------- COLORS ---------- */

const BAR_COLORS = ["#3b82f6", "#22c55e", "#a855f7", "#f59e0b", "#ef4444", "#06b6d4"];

const PIE_COLORS = ["#3b82f6", "#22c55e", "#ef4444", "#f59e0b", "#a855f7", "#06b6d4"];

/* ---------- PAGE ---------- */

export default function Page() {
  const { meta, rows, insiderCount, loading, error, reload } = useKairosData();

  const loadingRef = useRef(loading);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  /* ---------- AUTO REFRESH ---------- */

  useEffect(() => {
    if (!reload) return;

    const safeReload = () => {
      if (!loadingRef.current) reload();
    };

    window.addEventListener("storage", safeReload);
    window.addEventListener("kairos:data_updated", safeReload as any);
    window.addEventListener("kairos:insiders_updated", safeReload as any);
    window.addEventListener("kairos:agent_ran", safeReload as any);

    const id = setInterval(safeReload, 4000);

    return () => {
      window.removeEventListener("storage", safeReload);
      window.removeEventListener("kairos:data_updated", safeReload as any);
      window.removeEventListener("kairos:insiders_updated", safeReload as any);
      window.removeEventListener("kairos:agent_ran", safeReload as any);
      clearInterval(id);
    };
  }, [reload]);

  /* ---------- COMPUTED DATA ---------- */

  const computed = useMemo(() => {
    const safe = rows ?? [];

    const spend = (r: any) => (Number(r.quantity) || 0) * (Number(r.costPerUnit) || 0);

    const totalSpend = safe.reduce((s, r) => s + spend(r), 0);

    const avgLeadTime = safe.length
      ? safe.reduce((s, r) => s + (Number(r.leadTimeDays) || 0), 0) / safe.length
      : 0;

    const avgStorage = safe.length
      ? safe.reduce((s, r) => s + (Number(r.storageDays) || 0), 0) / safe.length
      : 0;

    const gap = avgLeadTime - avgStorage;

    const stockoutRiskPct = clamp((gap / 20) * 100, 0, 100);

    const riskLabel = stockoutRiskPct >= 75 ? "High" : stockoutRiskPct >= 45 ? "Moderate" : "Low";

    const byProduct = new Map<string, number>();
    const bySupplier = new Map<string, number>();

    for (const r of safe) {
      const p = String(r.product ?? "Unknown");
      const s = String(r.supplier ?? "Unknown");

      byProduct.set(p, (byProduct.get(p) ?? 0) + spend(r));
      bySupplier.set(s, (bySupplier.get(s) ?? 0) + spend(r));
    }

    const topN = (m: Map<string, number>, n: number) =>
      [...m.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([name, value]) => ({ name, value }));

    const spendByProduct = topN(byProduct, 6);

    const spendBySupplier = topN(bySupplier, 6);

    const topSupplier = spendBySupplier[0]
      ? {
          name: spendBySupplier[0].name,
          sharePct: totalSpend ? (spendBySupplier[0].value / totalSpend) * 100 : 0,
        }
      : null;

    const leadTimeTrend = [...safe]
      .slice()
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .slice(0, 12)
      .map((r: any) => ({
        date: r.date,
        leadTimeDays: Number(r.leadTimeDays) || 0,
        storageDays: Number(r.storageDays) || 0,
      }));

    return {
      totalSpend,
      avgLeadTime,
      avgStorage,
      stockoutRiskPct,
      riskLabel,
      topSupplier,
      spendByProduct,
      spendBySupplier,
      leadTimeTrend,
    };
  }, [rows]);

  const lastUpdated = meta?.updatedAt ? meta.updatedAt.toLocaleString() : null;

  /* ---------- UI ---------- */

  return (
    <div className="space-y-4">

      {/* HEADER */}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>

          <p className="text-sm text-gray-600">
            Key operational metrics, supplier exposure, and inventory risk computed by Kairos.
          </p>

          <div className="mt-1 flex flex-wrap gap-6 text-sm text-gray-600">

            {meta?.sourceFileName ? (
              <span>
                📄 Dataset: <span className="font-medium">{meta.sourceFileName}</span> ·{" "}
                <span className="font-medium">{meta.count ?? rows.length}</span> rows
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
              🕒 Last Updated: <span className="font-medium">{lastUpdated ?? "—"}</span>
            </span>

          </div>

        </div>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      {/* KPI CARDS */}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">

        <KpiCard
          title="Total Spend"
          value={fmtMoneyCAD(computed.totalSpend)}
          sub={[
            "Sum in CAD",
            "(quantity × cost per unit)"
          ]}
          className="bg-gradient-to-br from-indigo-600 to-blue-600"
        />

        <KpiCard
          title="Average Lead Time"
          value={`${fmtNum(computed.avgLeadTime)} days`}
          sub="Across all rows"
          className="bg-gradient-to-br from-emerald-600 to-teal-600"
        />

        <KpiCard
          title="Average Storage"
          value={`${fmtNum(computed.avgStorage)} days`}
          sub="Coverage on hand"
          className="bg-gradient-to-br from-violet-600 to-fuchsia-600"
        />

        <KpiCard
          title="Stockout Risk"
          value={`${fmtNum(computed.stockoutRiskPct)}%`}
          sub={`Heuristic: ${computed.riskLabel}`}
          className="bg-gradient-to-br from-amber-500 to-orange-600"
        />

        <KpiCard
          title="Top Supplier Share"
          value={computed.topSupplier ? `${fmtNum(computed.topSupplier.sharePct)}%` : "—"}
          sub={computed.topSupplier ? computed.topSupplier.name : "No supplier data"}
          className="bg-gradient-to-br from-slate-700 to-slate-900"
        />

      </div>

      {/* CHARTS */}

      <div className="grid gap-4 lg:grid-cols-2">

        {/* Spend by Product */}

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-lg font-semibold">Spend by Product</div>

          <div className="mt-3 h-72">

            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={computed.spendByProduct}
                margin={{ top: 8, right: 12, left: 8, bottom: 12 }}
              >
                <CartesianGrid strokeDasharray="3 3" />

                <XAxis
                  dataKey="name"
                  interval={0}
                  height={40}
                  tick={<ProductTick />}
                />

                <YAxis
                  tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                />

                <Tooltip formatter={(v) => fmtMoneyCAD(Number(v))} />

                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {computed.spendByProduct.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>

              </BarChart>
            </ResponsiveContainer>

          </div>
        </div>

        {/* Supplier Exposure */}

        <div className="rounded-xl bg-white p-4 shadow-sm">

          <div className="text-lg font-semibold">Exposure by Supplier</div>

          <div className="mt-3 h-72">

            <ResponsiveContainer width="100%" height="100%">
              <PieChart>

                <Pie
                  data={computed.spendBySupplier}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={90}
                  label
                >
                  {computed.spendBySupplier.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>

                <Tooltip formatter={(v) => fmtMoneyCAD(Number(v))} />

                <Legend />

              </PieChart>
            </ResponsiveContainer>

          </div>

        </div>

        {/* Lead Time vs Storage */}

        <div className="rounded-xl bg-white p-4 shadow-sm lg:col-span-2">

          <div className="text-lg font-semibold">Lead Time vs Storage</div>

          <div className="mt-3 h-72">

            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={computed.leadTimeTrend}>

                <CartesianGrid strokeDasharray="3 3" />

                <XAxis dataKey="date" />

                <YAxis />

                <Tooltip />

                <Legend />

                <Line
                  type="monotone"
                  dataKey="leadTimeDays"
                  stroke="#ef4444"
                  strokeWidth={2}
                  name="Lead Time"
                />

                <Line
                  type="monotone"
                  dataKey="storageDays"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Storage"
                />

              </LineChart>
            </ResponsiveContainer>

          </div>

        </div>

      </div>

    </div>
  );
}
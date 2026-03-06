"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  Legend,
  PieChart,
  Pie,
} from "recharts";
import { useKairosData } from "@/components/kairos/useKairosData";

type AgRow = {
  date: string;
  location: string;
  product: string;
  supplier: string;
  quantity: number;
  unit: string;
  leadTimeDays: number;
  costPerUnit: number;
  routeStart: string;
  routeEnd: string;
  storageDays: number;
};

function fmtMoneyCAD(n: number) {
  const value = Number.isFinite(n) ? n : 0;
  return "$" + value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtNum(n: number, digits = 1) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(
    Number.isFinite(n) ? n : 0
  );
}

function shortLabel(label: string, max = 16) {
  const text = String(label ?? "");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function splitXAxisLabel(label: string, preserveArrow = false, truncate = true) {
  const text = String(label ?? "").trim();
  if (!text) return [""];

  const base = truncate ? shortLabel(text, preserveArrow ? 24 : 20) : text;
  const parts = base.split(" ").filter(Boolean);

  if (!preserveArrow) return parts;

  const lines: string[] = [];
  for (const part of parts) {
    if (part === "→") {
      if (lines.length > 0) {
        lines[lines.length - 1] = `${lines[lines.length - 1]} ${part}`;
      } else {
        lines.push(part);
      }
    } else {
      lines.push(part);
    }
  }

  return lines;
}

function MultilineTick({
  x,
  y,
  payload,
  preserveArrow = false,
  truncate = true,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
  preserveArrow?: boolean;
  truncate?: boolean;
}) {
  const lines = splitXAxisLabel(String(payload?.value ?? ""), preserveArrow, truncate);

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={48} textAnchor="middle" fill="#64748b" fontSize={12}>
        {lines.map((line, i) => (
          <tspan key={i} x={0} dy={i === 0 ? 0 : 14}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function KpiCard({
  title,
  value,
  sub,
  className,
}: {
  title: string;
  value: string;
  sub: string;
  className: string;
}) {
  return (
    <div className={`rounded-2xl p-4 text-white shadow-sm ${className}`}>
      <div className="text-xs opacity-90">{title}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      <div className="mt-1 text-xs opacity-90">{sub}</div>
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
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <div className="text-lg font-semibold">{title}</div>
      {subtitle ? <div className="mt-1 text-sm text-gray-600">{subtitle}</div> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function FilterGroup({
  label,
  options,
  selected,
  onToggle,
  onClear,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  const allSelected = selected.length === 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-gray-600">{label}</div>
        <button
          type="button"
          onClick={onClear}
          className={`rounded-full px-2 py-1 text-xs ${
            allSelected
              ? "bg-emerald-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          All
        </button>
      </div>

      <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto pr-1">
        {options.map((option) => {
          const active = selected.includes(option);

          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${
                active
                  ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function toggleInArray(arr: string[], value: string) {
  return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
}

const BAR_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4"];

export default function Page() {
  const { meta, rows, insiderCount, loading, error, reload } = useKairosData();

  const loadingRef = useRef(loading);

  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

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

  const filterOptions = useMemo(() => {
    const locations = new Set<string>();
    const suppliers = new Set<string>();
    const products = new Set<string>();

    for (const r of (rows ?? []) as AgRow[]) {
      if (r.location) locations.add(r.location);
      if (r.supplier) suppliers.add(r.supplier);
      if (r.product) products.add(r.product);
    }

    return {
      locations: Array.from(locations).sort((a, b) => a.localeCompare(b)),
      suppliers: Array.from(suppliers).sort((a, b) => a.localeCompare(b)),
      products: Array.from(products).sort((a, b) => a.localeCompare(b)),
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    return ((rows ?? []) as AgRow[]).filter((r) => {
      if (selectedLocations.length > 0 && !selectedLocations.includes(r.location)) return false;
      if (selectedSuppliers.length > 0 && !selectedSuppliers.includes(r.supplier)) return false;
      if (selectedProducts.length > 0 && !selectedProducts.includes(r.product)) return false;
      return true;
    });
  }, [rows, selectedLocations, selectedSuppliers, selectedProducts]);

  const computed = useMemo(() => {
    const spend = (r: AgRow) => (Number(r.quantity) || 0) * (Number(r.costPerUnit) || 0);
    const routeName = (r: AgRow) =>
      [r.routeStart, r.routeEnd].filter(Boolean).join(" → ") || "Unknown";

    const byDate = new Map<
      string,
      {
        date: string;
        spend: number;
        quantity: number;
        cpuSum: number;
        cpuCount: number;
        leadSum: number;
        leadCount: number;
        storageSum: number;
        storageCount: number;
      }
    >();

    const byRoute = new Map<string, number>();
    const supplierLead = new Map<string, { total: number; count: number }>();
    const locationQuantity = new Map<string, number>();

    for (const r of filteredRows) {
      const spendValue = spend(r);
      const key = String(r.date || "Unknown");

      const current = byDate.get(key) ?? {
        date: key,
        spend: 0,
        quantity: 0,
        cpuSum: 0,
        cpuCount: 0,
        leadSum: 0,
        leadCount: 0,
        storageSum: 0,
        storageCount: 0,
      };

      current.spend += spendValue;
      current.quantity += Number(r.quantity) || 0;
      current.cpuSum += Number(r.costPerUnit) || 0;
      current.cpuCount += 1;
      current.leadSum += Number(r.leadTimeDays) || 0;
      current.leadCount += 1;
      current.storageSum += Number(r.storageDays) || 0;
      current.storageCount += 1;

      byDate.set(key, current);

      const route = routeName(r);
      byRoute.set(route, (byRoute.get(route) ?? 0) + spendValue);

      const supplierKey = r.supplier || "Unknown";
      const supplierCurrent = supplierLead.get(supplierKey) ?? { total: 0, count: 0 };
      supplierCurrent.total += Number(r.leadTimeDays) || 0;
      supplierCurrent.count += 1;
      supplierLead.set(supplierKey, supplierCurrent);

      const locationKey = r.location || "Unknown";
      locationQuantity.set(locationKey, (locationQuantity.get(locationKey) ?? 0) + (Number(r.quantity) || 0));
    }

    const timeSeries = [...byDate.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        date: d.date,
        spend: d.spend,
        quantity: d.quantity,
        avgCostPerUnit: d.cpuCount ? d.cpuSum / d.cpuCount : 0,
        leadGap:
          (d.leadCount ? d.leadSum / d.leadCount : 0) -
          (d.storageCount ? d.storageSum / d.storageCount : 0),
      }));

    const topRoutes = [...byRoute.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));

    const supplierLeadBars = [...supplierLead.entries()]
      .map(([name, value]) => ({
        name,
        value: value.count ? value.total / value.count : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    const locationVolumeBars = [...locationQuantity.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));

    const avgCostPerUnit = filteredRows.length
      ? filteredRows.reduce((sum, r) => sum + (Number(r.costPerUnit) || 0), 0) / filteredRows.length
      : 0;

    const avgGap = timeSeries.length
      ? timeSeries.reduce((sum, x) => sum + x.leadGap, 0) / timeSeries.length
      : 0;

    const locationVolumeTotal = locationVolumeBars.reduce((sum, x) => sum + x.value, 0);

    return {
      rowCount: filteredRows.length,
      routesInView: new Set(filteredRows.map(routeName)).size,
      avgCostPerUnit,
      avgGap,
      timeSeries,
      topRoutes,
      supplierLeadBars,
      locationVolumeBars,
      locationVolumeTotal,
    };
  }, [filteredRows]);

  const lastUpdated =
    meta?.updatedAt instanceof Date
      ? meta.updatedAt.toLocaleString()
      : meta?.updatedAt
      ? new Date(meta.updatedAt as any).toLocaleString()
      : "—";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Trends</h1>

          <p className="text-sm text-gray-600">
            Explore historical movement across spend, quantity, pricing, routes, and supplier lead-time patterns.
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
              🕒 Last Updated: <span className="font-medium">{lastUpdated}</span>
            </span>
          </div>
        </div>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <SectionCard
        title="Filters"
        subtitle="Select multiple locations, suppliers, and products to shape the trend view"
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <FilterGroup
            label="Locations"
            options={filterOptions.locations}
            selected={selectedLocations}
            onToggle={(value) => setSelectedLocations((prev) => toggleInArray(prev, value))}
            onClear={() => setSelectedLocations([])}
          />

          <FilterGroup
            label="Suppliers"
            options={filterOptions.suppliers}
            selected={selectedSuppliers}
            onToggle={(value) => setSelectedSuppliers((prev) => toggleInArray(prev, value))}
            onClear={() => setSelectedSuppliers([])}
          />

          <FilterGroup
            label="Products"
            options={filterOptions.products}
            selected={selectedProducts}
            onToggle={(value) => setSelectedProducts((prev) => toggleInArray(prev, value))}
            onClear={() => setSelectedProducts([])}
          />
        </div>
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Rows in View"
          value={fmtNum(computed.rowCount, 0)}
          sub="Filtered records"
          className="bg-gradient-to-br from-slate-700 to-slate-900"
        />
        <KpiCard
          title="Routes in View"
          value={fmtNum(computed.routesInView, 0)}
          sub="Active route combinations"
          className="bg-gradient-to-br from-blue-600 to-cyan-600"
        />
        <KpiCard
          title="Average Unit Cost"
          value={fmtMoneyCAD(computed.avgCostPerUnit)}
          sub="Mean cost per unit"
          className="bg-gradient-to-br from-violet-600 to-fuchsia-600"
        />
        <KpiCard
          title="Average Coverage Gap"
          value={`${fmtNum(computed.avgGap)} days`}
          sub="Lead time minus storage"
          className="bg-gradient-to-br from-amber-500 to-orange-600"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Spend trend"
          subtitle="How total spend changes over time inside the filtered view"
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={computed.timeSeries}>
                <defs>
                  <linearGradient id="spendFillTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip formatter={(v) => fmtMoneyCAD(Number(v))} />

                <Area
                  type="monotone"
                  dataKey="spend"
                  stroke="#2563eb"
                  strokeWidth={3}
                  fill="url(#spendFillTrend)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Quantity trend"
          subtitle="Movement in total shipped or ordered quantity over time"
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={computed.timeSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="quantity"
                  stroke="#10b981"
                  strokeWidth={3}
                  name="Quantity"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Average unit cost trend"
          subtitle="Track how pricing shifts across the filtered selection"
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={computed.timeSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(v) => `$${Number(v).toFixed(0)}`} />
                <Tooltip formatter={(v) => fmtMoneyCAD(Number(v))} />
                <Line
                  type="monotone"
                  dataKey="avgCostPerUnit"
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  name="Avg Cost / Unit"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Coverage gap trend"
          subtitle="Positive values mean lead time is outpacing storage coverage"
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={computed.timeSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="leadGap"
                  stroke="#ef4444"
                  strokeWidth={3}
                  name="Coverage Gap"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Top routes by spend"
          subtitle="Most expensive route combinations in the current filtered view"
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={computed.topRoutes}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  interval={0}
                  height={120}
                  tick={<MultilineTick preserveArrow truncate={false} />}
                />
                <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip formatter={(v) => fmtMoneyCAD(Number(v))} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {computed.topRoutes.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Suppliers with longest lead times"
          subtitle="Average lead-time ranking for the current filtered selection"
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={computed.supplierLeadBars}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  interval={0}
                  height={120}
                  tick={<MultilineTick />}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {computed.supplierLeadBars.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[(i + 2) % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Highest-volume locations"
        subtitle="Top locations by total quantity in the filtered selection"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={computed.locationVolumeBars}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  interval={0}
                  height={120}
                  tick={<MultilineTick />}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {computed.locationVolumeBars.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[(i + 1) % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={computed.locationVolumeBars}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  label={({ name, percent }) =>
                    `${shortLabel(String(name), 14)} ${fmtNum((Number(percent) || 0) * 100, 0)}%`
                  }
                >
                  {computed.locationVolumeBars.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[(i + 1) % BAR_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number | string | undefined, _name, props: any) => {
                    const numeric = Number(value ?? 0);
                    const pct =
                      computed.locationVolumeTotal > 0
                        ? (numeric / computed.locationVolumeTotal) * 100
                        : 0;
                    return [`${fmtNum(numeric, 0)} (${fmtNum(pct, 1)}%)`, "Quantity"];
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
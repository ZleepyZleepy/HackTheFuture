"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { loadAgDataFull } from "@/lib/agData";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

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

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function money(n: number) {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function Page() {
  const [rows, setRows] = useState<AgRow[]>([]);
  const [meta, setMeta] = useState<{ sourceFileName: string | null; count: number | null; updatedAt: Date | null } | null>(null);

  const [uid, setUid] = useState<string | null>(null);
  const [insiderCount, setInsiderCount] = useState(0);

  // filters
  const [location, setLocation] = useState<string>("All");
  const [supplier, setSupplier] = useState<string>("All");
  const [product, setProduct] = useState<string>("All");

  const [hasRun, setHasRun] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null)), []);
  useEffect(() => {
    loadAgDataFull()
      .then(({ meta, rows }) => {
        setMeta(meta ?? null);
        setRows((rows ?? []) as any);
      })
      .catch(() => {
        setMeta(null);
        setRows([]);
      });
  }, []);

  useEffect(() => {
    if (!uid) return;
    getDocs(collection(db, "users", uid, "insiderSources"))
      .then((snap) => setInsiderCount(snap.size))
      .catch(() => setInsiderCount(0));
  }, [uid]);

  const filterOptions = useMemo(() => {
    const locs = new Set<string>();
    const sups = new Set<string>();
    const prods = new Set<string>();
    for (const r of rows ?? []) {
      if (r.location) locs.add(r.location);
      if (r.supplier) sups.add(r.supplier);
      if (r.product) prods.add(r.product);
    }
    const sort = (a: string, b: string) => a.localeCompare(b);
    return {
      locations: ["All", ...Array.from(locs).sort(sort)],
      suppliers: ["All", ...Array.from(sups).sort(sort)],
      products: ["All", ...Array.from(prods).sort(sort)],
    };
  }, [rows]);

  const filtered = useMemo(() => {
    return (rows ?? []).filter((r) => {
      if (location !== "All" && r.location !== location) return false;
      if (supplier !== "All" && r.supplier !== supplier) return false;
      if (product !== "All" && r.product !== product) return false;
      return true;
    });
  }, [rows, location, supplier, product]);

  const computed = useMemo(() => {
    const safe = filtered ?? [];
    const spend = (r: any) => (Number(r.quantity) || 0) * (Number(r.costPerUnit) || 0);

    const totalSpend = safe.reduce((s, r) => s + spend(r), 0);
    const avgLeadTime = safe.length ? safe.reduce((s, r) => s + (Number(r.leadTimeDays) || 0), 0) / safe.length : 0;
    const avgStorage = safe.length ? safe.reduce((s, r) => s + (Number(r.storageDays) || 0), 0) / safe.length : 0;
    const stockoutRiskPct = clamp(((avgLeadTime - avgStorage) / 20) * 100, 0, 100);

    // time series
    const series = [...safe]
      .slice()
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .map((r) => ({
        date: String(r.date),
        leadTimeDays: Number(r.leadTimeDays) || 0,
        storageDays: Number(r.storageDays) || 0,
        spend: spend(r),
      }));

    // aggregations
    const bySupplier = new Map<string, number>();
    const byProduct = new Map<string, number>();
    const byLocation = new Map<string, number>();

    for (const r of safe) {
      bySupplier.set(r.supplier ?? "Unknown", (bySupplier.get(r.supplier ?? "Unknown") ?? 0) + spend(r));
      byProduct.set(r.product ?? "Unknown", (byProduct.get(r.product ?? "Unknown") ?? 0) + spend(r));
      byLocation.set(r.location ?? "Unknown", (byLocation.get(r.location ?? "Unknown") ?? 0) + spend(r));
    }

    const topN = (m: Map<string, number>, n: number) =>
      [...m.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([name, value]) => ({ name, value }));

    const supplierBars = topN(bySupplier, 8);
    const productBars = topN(byProduct, 8);
    const locationPie = topN(byLocation, 6);

    return {
      totalSpend,
      avgLeadTime,
      avgStorage,
      stockoutRiskPct,
      series,
      supplierBars,
      productBars,
      locationPie,
      rowCount: safe.length,
    };
  }, [filtered]);

  async function runTrends() {
    setUpdating(true);
    // (optional) tiny delay so "Updating..." is visible even if calc is instant
    await new Promise((r) => setTimeout(r, 150));
    setHasRun(true);
    setUpdating(false);
  }

  // recharts wants some colors — keep it Kairos-ish but add red/green too
  const PIE_COLORS = ["#4880ff", "#00b69b", "#fcbe2d", "#fd5454", "#7c3aed", "#0ea5e9"];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-slate-500">Trends</div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">📈 Kairos Trends</h1>

          <div className="mt-2 flex flex-wrap items-center gap-6 text-xs text-slate-500">
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
          </div>
        </div>

        <button
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          onClick={runTrends}
          disabled={updating}
        >
          {updating ? "Updating..." : "🚀 Update agent analysis"}
        </button>
      </div>

      {/* Filters */}
      <section className="rounded-xl border bg-white p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">🔎 Filters</h2>
            <p className="mt-1 text-sm text-slate-600">
              Slice your dataset by location, supplier, and product.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="text-xs text-slate-600">
              Location
              <select
                className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                {filterOptions.locations.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs text-slate-600">
              Supplier
              <select
                className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
              >
                {filterOptions.suppliers.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs text-slate-600">
              Product
              <select
                className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
              >
                {filterOptions.products.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-700">
          <div className="rounded-lg border bg-slate-50 px-3 py-2">📦 Rows in view: <span className="font-semibold">{computed.rowCount}</span></div>
          <div className="rounded-lg border bg-slate-50 px-3 py-2">💰 Spend: <span className="font-semibold">{money(computed.totalSpend)}</span></div>
          <div className="rounded-lg border bg-slate-50 px-3 py-2">⏱ Avg lead time: <span className="font-semibold">{computed.avgLeadTime.toFixed(1)}d</span></div>
          <div className="rounded-lg border bg-slate-50 px-3 py-2">🧊 Avg storage: <span className="font-semibold">{computed.avgStorage.toFixed(1)}d</span></div>
          <div className="rounded-lg border bg-slate-50 px-3 py-2">🚨 Stockout probability: <span className="font-semibold">{Math.round(computed.stockoutRiskPct)}%</span></div>
        </div>

        {!hasRun ? (
          <p className="mt-3 text-sm text-slate-500">
            Charts load immediately, but click <span className="font-semibold">Update</span> to “lock in” the latest analysis state.
          </p>
        ) : null}
      </section>

      {/* Charts */}
      <div className="space-y-4">
        {/* Row 1: 50/50 */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {/* Lead time vs storage */}
          <section className="rounded-xl border bg-white p-5">
            <h2 className="text-sm font-bold text-slate-900">⏱ Lead Time vs Storage Coverage (over time)</h2>
            <p className="mt-1 text-sm text-slate-600">Watch for divergence — that’s where stockouts form.</p>

            <div className="mt-4 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={computed.series}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="leadTimeDays" name="Lead Time (days)" stroke="#fd5454" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="storageDays" name="Storage (days)" stroke="#00b69b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Location exposure pie */}
          <section className="rounded-xl border bg-white p-5">
            <h2 className="text-sm font-bold text-slate-900">🗺 Exposure by Location</h2>
            <p className="mt-1 text-sm text-slate-600">Where your spend concentrates (risk surface).</p>

            <div className="mt-4 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={computed.locationPie}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={105}
                    label={(p) => `${p.name}`}
                  >
                    {computed.locationPie.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => money(Number(v) || 0)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        {/* Row 2: 50/50 */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {/* Supplier bars */}
          <section className="rounded-xl border bg-white p-5">
            <h2 className="text-sm font-bold text-slate-900">🏭 Supplier Exposure (Top)</h2>
            <p className="mt-1 text-sm text-slate-600">Concentration risk → escalation trigger.</p>

            <div className="mt-4 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={computed.supplierBars}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => money(Number(v) || 0)} />
                  <Bar dataKey="value" name="Spend" fill="#4880ff" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Product bars */}
          <section className="rounded-xl border bg-white p-5">
            <h2 className="text-sm font-bold text-slate-900">📦 Product Exposure (Top)</h2>
            <p className="mt-1 text-sm text-slate-600">Which inputs dominate your burn.</p>

            <div className="mt-4 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={computed.productBars}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => money(Number(v) || 0)} />
                  <Bar dataKey="value" name="Spend" fill="#00b69b" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}



// "use client";

// import Link from "next/link";
// import { useKairosData } from "@/components/kairos/useKairosData";
// import { useKairosSignals } from "@/components/kairos/useKairosSignals";

// export default function KairosTrendsPage() {
//   const { meta, rows, insiderCount } = useKairosData();
//   const { signals, updating, error, updateSignals } = useKairosSignals(rows);

//   return (
//     <div className="space-y-4">
//       <div className="flex items-start justify-between gap-4">
//         <div>
//           <h1 className="text-2xl font-bold">📈 Kairos Trends</h1>

//           <div className="mt-1 flex flex-wrap gap-6 text-sm text-gray-600">
//             {meta?.sourceFileName ? (
//               <span>
//                 📄 Dataset: <span className="font-medium">{meta.sourceFileName}</span> ·{" "}
//                 <span className="font-medium">{meta.count ?? 0}</span> rows
//               </span>
//             ) : (
//               <span>📄 Dataset: —</span>
//             )}

//             <span>
//               🕵️ Insider Sources: <span className="font-medium">{insiderCount}</span>{" "}
//               <Link href="/kairos/sources" className="hover:underline">
//                 (manage)
//               </Link>
//             </span>
//           </div>
//         </div>

//         <button
//           onClick={updateSignals}
//           disabled={updating || !rows.length}
//           className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
//           title={!rows.length ? "Upload a dataset first" : undefined}
//         >
//           {updating ? "Updating..." : "Update"}
//         </button>
//       </div>

//       {error ? <div className="text-sm text-red-600">{error}</div> : null}

//       {/* You can feed `rows` into your deeper charts; signals are extra overlays */}
//       <div className="grid gap-4 lg:grid-cols-2">
//         <div className="rounded-xl bg-white p-4 shadow-sm">
//           <div className="text-lg font-semibold">☁️ Weather by Location</div>
//           <div className="mt-2 text-sm text-gray-700">
//             {signals ? (
//               <ul className="space-y-1">
//                 {signals.weather.locations.slice(0, 6).map((x) => (
//                   <li key={x.location}>
//                     • {x.location}: <span className="font-semibold">{x.risk}/100</span>
//                     {typeof x.tempC === "number" ? ` · ${Math.round(x.tempC)}°C` : ""}
//                     {typeof x.windMps === "number" ? ` · ${Math.round(x.windMps)} m/s` : ""}
//                   </li>
//                 ))}
//               </ul>
//             ) : (
//               "Click Update to load location signals."
//             )}
//           </div>
//         </div>

//         <div className="rounded-xl bg-white p-4 shadow-sm">
//           <div className="text-lg font-semibold">🌍 Geopolitics Trend Proxy</div>
//           <div className="mt-2 text-sm text-gray-700">
//             {signals ? (
//               <>
//                 Risk score: <span className="font-semibold">{signals.geopolitics.riskScore}/100</span>
//                 <br />
//                 Articles: <span className="font-semibold">{signals.geopolitics.articles.length}</span>
//               </>
//             ) : (
//               "Click Update to load geopolitics signals."
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
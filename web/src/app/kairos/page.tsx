"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { loadAgDataFull } from "@/lib/agData";
import { ChartsGrid, KpiRow, type KairosChartData, type KairosKpi } from "@/components/kairos/KairosCharts";

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

export default function Page() {
  const [rows, setRows] = useState<AgRow[]>([]);
  const [meta, setMeta] = useState<{ sourceFileName: string | null; count: number | null; updatedAt: Date | null } | null>(null);

  const [uid, setUid] = useState<string | null>(null);
  const [insiderCount, setInsiderCount] = useState(0);

  const [hasRun, setHasRun] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [keyRisks, setKeyRisks] = useState<string[]>([]);

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

  const computed = useMemo(() => {
    const safe = rows ?? [];
    const spend = (r: any) => (Number(r.quantity) || 0) * (Number(r.costPerUnit) || 0);

    const totalSpend = safe.reduce((s, r) => s + spend(r), 0);
    const avgLeadTime = safe.length ? safe.reduce((s, r) => s + (Number(r.leadTimeDays) || 0), 0) / safe.length : 0;
    const avgStorage = safe.length ? safe.reduce((s, r) => s + (Number(r.storageDays) || 0), 0) / safe.length : 0;

    const gap = avgLeadTime - avgStorage;
    const stockoutRiskPct = clamp((gap / 20) * 100, 0, 100);

    const byProduct = new Map<string, number>();
    const bySupplier = new Map<string, number>();

    for (const r of safe) {
      const p = String(r.product ?? "Unknown");
      const s = String(r.supplier ?? "Unknown");
      byProduct.set(p, (byProduct.get(p) ?? 0) + spend(r));
      bySupplier.set(s, (bySupplier.get(s) ?? 0) + spend(r));
    }

    const topN = (m: Map<string, number>, n: number) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, value]) => ({ name, value }));

    const spendByProduct = topN(byProduct, 6);
    const spendBySupplier = topN(bySupplier, 5);

    const topSupplier = spendBySupplier[0]
      ? { name: spendBySupplier[0].name, sharePct: totalSpend ? (spendBySupplier[0].value / totalSpend) * 100 : 0 }
      : null;

    const leadTimeTrend = [...safe]
      .slice()
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .slice(0, 12)
      .map((r) => ({
        date: String(r.date),
        leadTimeDays: Number(r.leadTimeDays) || 0,
        storageDays: Number(r.storageDays) || 0,
      }));

    const kpi: KairosKpi = { totalSpend, avgLeadTime, avgStorage, stockoutRiskPct, topSupplier };
    const chartData: KairosChartData = { spendByProduct, spendBySupplier, leadTimeTrend };

    return { kpi, chartData, totalSpend };
  }, [rows]);

  async function runDashboard() {
    setUpdating(true);
    await new Promise((r) => setTimeout(r, 200));

    const { kpi } = computed;

    const risks: string[] = [];
    if (kpi.stockoutRiskPct >= 75) risks.push("🚨 High stockout risk: lead time outruns coverage (storage days).");
    else if (kpi.stockoutRiskPct >= 45) risks.push("⚠️ Moderate stockout risk: tighten PO timing on long-lead inputs.");
    else risks.push("✅ Stockout risk looks controlled under current coverage.");

    if (kpi.topSupplier && kpi.topSupplier.sharePct >= 45) risks.push("🧩 Supplier concentration risk: one vendor dominates exposure.");
    if (kpi.avgLeadTime >= 18) risks.push("⏱ Long lead-time mix: weather + port delays will amplify volatility.");

    setKeyRisks(risks);
    setHasRun(true);
    setUpdating(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-slate-500">Dashboard</div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">🌾 Kairos</h1>

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
          onClick={runDashboard}
          disabled={updating}
        >
          {updating ? "Updating..." : "🚀 Update agent analysis"}
        </button>
      </div>

      <KpiRow kpi={computed.kpi} />
      <ChartsGrid data={computed.chartData} />

      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-sm font-bold text-slate-900">⚠️ Key Risks</h2>
        {!hasRun ? (
          <p className="mt-2 text-sm text-slate-600">Click Update to generate a concrete risk list.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {keyRisks.map((x, i) => (
              <li key={i} className="rounded-lg border bg-slate-50 px-3 py-2">
                {x}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}



// "use client";

// import Link from "next/link";
// import { useKairosData } from "@/components/kairos/useKairosData";
// import { useKairosSignals } from "@/components/kairos/useKairosSignals";

// export default function KairosDashboardPage() {
//   const { meta, rows, insiderCount } = useKairosData();
//   const { signals, updating, error, updateSignals } = useKairosSignals(rows);

//   return (
//     <div className="space-y-4">
//       <div className="flex items-start justify-between gap-4">
//         <div>
//           <h1 className="text-2xl font-bold">🌾 Kairos Dashboard</h1>

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
//           disabled={updating}
//           className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
//         >
//           {updating ? "Updating..." : "🚀 Update agent analysis"}
//         </button>
//       </div>

//       {error ? <div className="text-sm text-red-600">{error}</div> : null}

//       <div className="grid gap-4 md:grid-cols-3">
//         <div className="rounded-xl bg-white p-4 shadow-sm">
//           <div className="text-sm text-gray-600">☁️ Weather Risk</div>
//           <div className="mt-1 text-2xl font-bold">{signals ? `${signals.weather.overallRisk}/100` : "—"}</div>
//           <div className="mt-1 text-xs text-gray-500">
//             {signals ? `Max location risk: ${signals.weather.maxRisk}/100` : "Click Update to fetch live signals."}
//           </div>
//         </div>

//         <div className="rounded-xl bg-white p-4 shadow-sm">
//           <div className="text-sm text-gray-600">🌍 Geopolitics Risk</div>
//           <div className="mt-1 text-2xl font-bold">{signals ? `${signals.geopolitics.riskScore}/100` : "—"}</div>
//           <div className="mt-1 text-xs text-gray-500">
//             {signals ? `Articles: ${signals.geopolitics.articles.length}` : "Click Update to fetch live signals."}
//           </div>
//         </div>

//         <div className="rounded-xl bg-white p-4 shadow-sm">
//           <div className="text-sm text-gray-600">🕒 Signals As-Of</div>
//           <div className="mt-1 text-base font-semibold">{signals ? new Date(signals.asOf).toLocaleString() : "—"}</div>
//           <div className="mt-1 text-xs text-gray-500">Cached until next update.</div>
//         </div>
//       </div>
//     </div>
//   );
// }
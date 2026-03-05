"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { loadAgDataFull } from "@/lib/agData";

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

  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const [recs, setRecs] = useState<string[]>([]);
  const [escalation, setEscalation] = useState<{ level: "Low" | "Medium" | "High"; note: string } | null>(null);

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

    const bySupplier = new Map<string, number>();
    for (const r of safe) {
      const s = String(r.supplier ?? "Unknown");
      bySupplier.set(s, (bySupplier.get(s) ?? 0) + spend(r));
    }
    const spendBySupplier = [...bySupplier.entries()].sort((a, b) => b[1] - a[1]);
    const topSupplier = spendBySupplier[0]
      ? { name: spendBySupplier[0][0], sharePct: totalSpend ? (spendBySupplier[0][1] / totalSpend) * 100 : 0 }
      : null;

    return { totalSpend, avgLeadTime, avgStorage, stockoutRiskPct, topSupplier };
  }, [rows]);

  async function runAnalytics() {
    setUpdating(true);
    await new Promise((r) => setTimeout(r, 200));

    const { stockoutRiskPct, avgLeadTime, topSupplier } = computed;

    const insights: string[] = [];
    insights.push(`🌾 Rows scanned: ${rows.length} (${meta?.sourceFileName ?? "uploaded file"}).`);
    insights.push(`🚨 Stockout probability: ${Math.round(stockoutRiskPct)}% (lead time vs storage coverage).`);
    if (topSupplier) insights.push(`🏭 Highest exposure supplier: ${topSupplier.name} (~${Math.round(topSupplier.sharePct)}% of spend).`);
    insights.push(`🕵️ Insider sources attached: ${insiderCount} (used as additional context).`);

    const r: string[] = [];
    if (stockoutRiskPct >= 60) r.push("📦 Buffer critical inputs (short-term safety stock) for the highest-usage SKUs.");
    if (topSupplier && topSupplier.sharePct >= 40) r.push("🔁 Dual-source top supplier items (approve a secondary vendor + small PO now).");
    if (avgLeadTime >= 18) r.push("🚚 Pull-in POs on long-lead items + pre-book transport capacity for weather volatility.");
    r.push("🧾 Prepare an approval packet: cost delta, lead time delta, and risk score for each action.");

    let esc: { level: "Low" | "Medium" | "High"; note: string } = { level: "Low", note: "No escalation needed right now." };
    if (stockoutRiskPct >= 75 || (topSupplier && topSupplier.sharePct >= 55)) {
      esc = { level: "High", note: "Escalate to Procurement + Ops today (risk exceeds threshold)." };
    } else if (stockoutRiskPct >= 45 || (topSupplier && topSupplier.sharePct >= 45)) {
      esc = { level: "Medium", note: "Escalate to Ops lead (monitor daily; pre-approve contingency actions)." };
    }

    setAiInsights(insights);
    setRecs(r);
    setEscalation(esc);
    setHasRun(true);
    setUpdating(false);
  }

  const escTone =
    escalation?.level === "High"
      ? "border-red-200 bg-red-50"
      : escalation?.level === "Medium"
      ? "border-amber-200 bg-amber-50"
      : "border-green-200 bg-green-50";

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-slate-500">Analytics</div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">📊 Kairos Analytics</h1>

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
          onClick={runAnalytics}
          disabled={updating}
        >
          {updating ? "Updating..." : "🚀 Update agent analysis"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-xl border bg-white p-5 xl:col-span-2">
          <h2 className="text-sm font-bold text-slate-900">✅ Recommendations</h2>
          {!hasRun ? (
            <p className="mt-2 text-sm text-slate-600">Click Update to generate a prioritized action list.</p>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              {recs.map((x, i) => (
                <div key={i} className="rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-800">
                  {x}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={`rounded-xl border p-5 ${hasRun ? escTone : "bg-white"}`}>
          <h2 className="text-sm font-bold text-slate-900">🧯 Escalation</h2>
          {!hasRun ? (
            <p className="mt-2 text-sm text-slate-600">Click Update to compute escalation level + rationale.</p>
          ) : (
            <div className="mt-2 text-sm text-slate-800">
              <div className="font-semibold">Level: {escalation?.level}</div>
              <div className="mt-1">{escalation?.note}</div>
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-white p-5">
          <h2 className="text-sm font-bold text-slate-900">🧠 AI Insights</h2>
          {!hasRun ? (
            <p className="mt-2 text-sm text-slate-600">Click Update to generate insights tied to your dataset.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {aiInsights.map((x, i) => (
                <li key={i} className="rounded-lg border bg-slate-50 px-3 py-2">
                  {x}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { loadAgDataFull } from "@/lib/agData";
import type { KairosSignals } from "@/components/kairos/useKairosSignals"; // or copy the type

type Driver = { name: string; value: number };

function topN(map: Map<string, number>, n: number): Driver[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, value]) => ({ name, value }));
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

async function fetchSignals(input: { locations: string[]; suppliers: string[]; products: string[] }) {
  const res = await fetch("/api/kairos/signals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`signals API failed (${res.status})`);
  return (await res.json()) as KairosSignals;
}

export type KairosAgentOutput = {
  recommendations: Array<{
    title: string;
    urgency: "low" | "medium" | "high";
    why: string;
    steps: string[];
    owner: string;
    eta: string;
    evidence: string[];
  }>;
  escalation: {
    level: "none" | "watch" | "escalate";
    message: string;
    who: string[];
    when: string;
    evidence: string[];
  };
  aiInsights: string[];
  topExposureDrivers: Array<{ driver: string; sharePct: number; evidence: string }>;
  keyRisks: Array<{ risk: string; severity: "low" | "medium" | "high"; evidence: string[] }>;
};

export function useKairosAgent() {
  const [meta, setMeta] = useState<{ sourceFileName: string | null; count: number | null; updatedAt: Date | null } | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [insiderCount, setInsiderCount] = useState(0);
  const [insiderNotes, setInsiderNotes] = useState<string[]>([]);

  const [signals, setSignals] = useState<KairosSignals | null>(null);
  const [output, setOutput] = useState<KairosAgentOutput | null>(null);

  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // load dataset + insider sources once (auto-uses saved dataset)
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return;
      try {
        const loaded = await loadAgDataFull();
        setMeta(loaded.meta);
        setRows(loaded.rows);

        const snap = await getDocs(collection(db, "users", u.uid, "insiderSources"));
        setInsiderCount(snap.size);

        const notes = snap.docs
          .map((d) => String((d.data() as any)?.text ?? (d.data() as any)?.note ?? ""))
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 10);

        setInsiderNotes(notes);
      } catch {
        setMeta(null);
        setRows([]);
      }
    });
    return () => unsub();
  }, []);

  const summary = useMemo(() => {
    const safe = rows ?? [];
    const spend = (r: any) => (Number(r.quantity) || 0) * (Number(r.costPerUnit) || 0);

    const totalSpend = safe.reduce((s: number, r: any) => s + spend(r), 0);
    const avgLeadTime = safe.length ? safe.reduce((s: number, r: any) => s + (Number(r.leadTimeDays) || 0), 0) / safe.length : 0;
    const avgStorage = safe.length ? safe.reduce((s: number, r: any) => s + (Number(r.storageDays) || 0), 0) / safe.length : 0;

    const gap = avgLeadTime - avgStorage;
    const stockoutRiskPct = clamp((gap / 20) * 100, 0, 100);

    const bySupplier = new Map<string, number>();
    const byProduct = new Map<string, number>();
    const byLocation = new Map<string, number>();

    for (const r of safe) {
      const s = String(r.supplier ?? "Unknown");
      const p = String(r.product ?? "Unknown");
      const l = String(r.location ?? "Unknown");

      bySupplier.set(s, (bySupplier.get(s) ?? 0) + spend(r));
      byProduct.set(p, (byProduct.get(p) ?? 0) + spend(r));
      byLocation.set(l, (byLocation.get(l) ?? 0) + spend(r));
    }

    return {
      kpis: { totalSpend, avgLeadTime, avgStorage, stockoutRiskPct },
      exposures: {
        bySupplier: topN(bySupplier, 6),
        byProduct: topN(byProduct, 6),
        byLocation: topN(byLocation, 6),
      },
      entities: {
        locations: topN(byLocation, 20).map((x) => x.name).filter(Boolean).slice(0, 8),
        suppliers: topN(bySupplier, 20).map((x) => x.name).filter(Boolean).slice(0, 8),
        products: topN(byProduct, 20).map((x) => x.name).filter(Boolean).slice(0, 8),
      },
    };
  }, [rows]);

  const update = useCallback(async () => {
    if (updating) return;
    setUpdating(true);
    setError(null);

    try {
      // 1) fetch live signals
      const s = await fetchSignals(summary.entities);
      setSignals(s);

      // 2) ask Gemini to generate real “agent” output grounded in dataset + signals
      const res = await fetch("/api/kairos/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meta,
          kpis: summary.kpis,
          exposures: summary.exposures,
          signals: s,
          insiderNotes, // optional; can be []
        }),
      });

      if (!res.ok) throw new Error(`analyze failed (${res.status})`);
      const json = await res.json();
      setOutput(json.output as KairosAgentOutput);
    } catch (e: any) {
      setError(e?.message ?? "Update failed");
    } finally {
      setUpdating(false);
    }
  }, [meta, summary, insiderNotes, updating]);

  return { meta, insiderCount, signals, output, updating, error, update };
}
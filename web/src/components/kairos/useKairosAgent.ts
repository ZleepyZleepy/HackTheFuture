"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { loadAgDataFull } from "@/lib/agData";

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

export type KairosAdkOutput = {
  signals?: {
    weatherSignals?: any[];
    geoSignals?: any[];
    logisticsSignals?: any[];
    insiderSignals?: any[];
  };
  risk?: {
    overallScore?: number;
    level?: "low" | "medium" | "high";
    breakdown?: Record<string, number>;
    why?: string[];
  };
  aiInsights?: string[];
  predictions?: any[];
  strategies?: any[];
  actionPlan?: any[];
};

function computeSummary(rows: any[]) {
  const safe = rows ?? [];
  const spend = (r: any) => (Number(r.quantity) || 0) * (Number(r.costPerUnit) || 0);

  const totalSpend = safe.reduce((s: number, r: any) => s + spend(r), 0);
  const avgLeadTime = safe.length
    ? safe.reduce((s: number, r: any) => s + (Number(r.leadTimeDays) || 0), 0) / safe.length
    : 0;
  const avgStorage = safe.length
    ? safe.reduce((s: number, r: any) => s + (Number(r.storageDays) || 0), 0) / safe.length
    : 0;

  const gap = avgLeadTime - avgStorage;
  const stockoutRiskPct = clamp((gap / 20) * 100, 0, 100);

  const bySupplier = new Map<string, number>();
  const byProduct = new Map<string, number>();
  const byLocation = new Map<string, number>();
  const byRoute = new Map<string, number>();

  for (const r of safe) {
    const s = String(r.supplier ?? "Unknown");
    const p = String(r.product ?? "Unknown");
    const l = String(r.location ?? "Unknown");
    const rs = String(r.routeStart ?? "").trim();
    const re = String(r.routeEnd ?? "").trim();
    const route = rs && re ? `${rs} → ${re}` : rs || re ? `${rs}${re}` : "";

    bySupplier.set(s, (bySupplier.get(s) ?? 0) + spend(r));
    byProduct.set(p, (byProduct.get(p) ?? 0) + spend(r));
    byLocation.set(l, (byLocation.get(l) ?? 0) + spend(r));
    if (route) byRoute.set(route, (byRoute.get(route) ?? 0) + spend(r));
  }

  const exposures = {
    bySupplier: topN(bySupplier, 6),
    byProduct: topN(byProduct, 6),
    byLocation: topN(byLocation, 6),
    byRoute: topN(byRoute, 8),
  };

  const entities = {
    locations: topN(byLocation, 20).map((x) => x.name).filter(Boolean).slice(0, 8),
    suppliers: topN(bySupplier, 20).map((x) => x.name).filter(Boolean).slice(0, 8),
    products: topN(byProduct, 20).map((x) => x.name).filter(Boolean).slice(0, 8),
    routes: topN(byRoute, 20).map((x) => x.name).filter(Boolean).slice(0, 8),
  };

  return {
    kpis: { totalSpend, avgLeadTime, avgStorage, stockoutRiskPct },
    exposures,
    entities,
  };
}

async function readErrorMessage(res: Response): Promise<string> {
  // Prefer JSON error, fallback to text
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const j = await res.json().catch(() => null);
    if (j?.error && j?.details) return `${j.error}: ${String(j.details).slice(0, 300)}`;
    if (j?.error) return String(j.error);
  }
  const t = await res.text().catch(() => "");
  return t ? t.slice(0, 300) : `HTTP ${res.status}`;
}

export function useKairosAgent() {
  const [meta, setMeta] = useState<{ sourceFileName: string | null; count: number | null; updatedAt: Date | null } | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [insiderCount, setInsiderCount] = useState(0);
  const [insiderNotes, setInsiderNotes] = useState<string[]>([]);

  const [output, setOutput] = useState<KairosAdkOutput | null>(null);
  const [agentAsOf, setAgentAsOf] = useState<string | null>(null);

  const [updating, setUpdating] = useState(false);
  const updatingRef = useRef(false);

  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => computeSummary(rows), [rows]);

  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    updatingRef.current = updating;
  }, [updating]);

  // initial load
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      setUid(u?.uid ?? null);
      if (!u) return;

      try {
        const loaded = await loadAgDataFull();
        setMeta(loaded.meta);
        setRows(loaded.rows ?? []);

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
        setInsiderCount(0);
        setInsiderNotes([]);
      }
    });

    return () => unsub();
  }, []);

  const reloadInputs = useCallback(async () => {
    const userId = uid ?? auth.currentUser?.uid ?? null;
    if (!userId) throw new Error("Not signed in");

    const loaded = await loadAgDataFull();
    const freshMeta = loaded.meta ?? null;
    const freshRows = loaded.rows ?? [];

    const snap = await getDocs(collection(db, "users", userId, "insiderSources"));
    const freshInsiderCount = snap.size;
    const freshNotes = snap.docs
      .map((d) => String((d.data() as any)?.text ?? (d.data() as any)?.note ?? ""))
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);

    setMeta(freshMeta);
    setRows(freshRows);
    setInsiderCount(freshInsiderCount);
    setInsiderNotes(freshNotes);

    return { freshMeta, freshRows, freshInsiderCount, freshNotes, userId };
  }, [uid]);

  // IMPORTANT: update() no longer depends on `updating` state -> stable identity -> stops flashing loop
  const update = useCallback(async () => {
    if (updatingRef.current) return;

    updatingRef.current = true;
    setUpdating(true);
    setError(null);

    try {
      const { freshMeta, freshRows, freshNotes, userId } = await reloadInputs();
      const freshSummary = computeSummary(freshRows);

      if (!freshMeta?.sourceFileName || freshRows.length === 0) {
        throw new Error("No dataset loaded yet. Upload a CSV first.");
      }

      const datasetForAdk = {
        locations: freshSummary.entities.locations,
        suppliers: freshSummary.entities.suppliers,
        products: freshSummary.entities.products,
        routes: freshSummary.entities.routes,
        kpis: freshSummary.kpis,
        exposures: freshSummary.exposures,
      };

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          sessionId: "kairos",
          dataset: datasetForAdk,
          insiderNotes: freshNotes,
        }),
      });

      if (!res.ok) {
        const msg = await readErrorMessage(res);
        throw new Error(msg || `analyze failed (${res.status})`);
      }

      const json = await res.json();

      setAgentAsOf(String(json.asOf ?? ""));
      setOutput(json.output as KairosAdkOutput);
    } catch (e: any) {
      setError(e?.message ?? "Update failed");
    } finally {
      updatingRef.current = false;
      setUpdating(false);
    }
  }, [reloadInputs]);

  const signals = output?.signals ?? null;

  return { meta, insiderCount, signals, output, agentAsOf, updating, error, update };
}
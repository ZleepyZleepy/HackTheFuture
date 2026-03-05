"use client";

import { useMemo, useState } from "react";
import type { AgDataRow } from "@/lib/agData";

export type KairosSignals = {
  ok: boolean;
  asOf: string;
  weather: { locations: any[]; overallRisk: number; maxRisk: number };
  geopolitics: { riskScore: number; queryUsed: string; articles: any[] };
  warnings: string[];
};

function uniq(arr: string[]) {
  return Array.from(new Set(arr)).filter(Boolean);
}

export function useKairosSignals(rows: AgDataRow[]) {
  const [signals, setSignals] = useState<KairosSignals | null>(null);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputs = useMemo(() => {
    const locations = uniq(rows.map((r) => String(r.location ?? "")));
    const suppliers = uniq(rows.map((r) => String(r.supplier ?? "")));
    const products = uniq(rows.map((r) => String(r.product ?? "")));
    return { locations, suppliers, products };
  }, [rows]);

  async function updateSignals() {
    setError(null);
    setUpdating(true);
    try {
      const resp = await fetch("/api/kairos/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputs),
      });

      if (!resp.ok) throw new Error(`Signals failed (${resp.status})`);
      const json = (await resp.json()) as KairosSignals;
      setSignals(json);
    } catch (e: any) {
      setError(e?.message ?? "Failed to fetch signals");
      setSignals(null);
    } finally {
      setUpdating(false);
    }
  }

  return { signals, updating, error, updateSignals };
}
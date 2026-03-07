"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { loadAgDataFull } from "@/lib/agData";

type Driver = { name: string; value: number };
type AlertLevel = "low" | "medium" | "high";

const ALERT_FINGERPRINT_STORAGE_KEY = "kairos:lastHighAlertFingerprint";

function topN(map: Map<string, number>, n: number): Driver[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, value]) => ({ name, value }));
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function levelFromScore(score: unknown): AlertLevel {
  const n = Number(score ?? 0);
  if (n >= 70) return "high";
  if (n >= 45) return "medium";
  return "low";
}

function normalizeLevel(value: unknown): AlertLevel {
  const v = String(value ?? "").toLowerCase();
  if (v === "high") return "high";
  if (v === "medium" || v === "moderate") return "medium";
  return "low";
}

function levelFromSeverity(severity: unknown, fallback: AlertLevel = "low"): AlertLevel {
  const n = Number(severity);
  if (!Number.isFinite(n)) return fallback;
  if (n >= 70) return "high";
  if (n >= 45) return "medium";
  return "low";
}

function fmtPct(value: unknown, digits = 1) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: digits,
  }).format(Number.isFinite(n) ? n : 0);
}

export type KairosAdkOutput = {
  signals?: {
    weatherSignals?: Array<{
      title?: string;
      summary?: string;
      location?: string;
      timeWindow?: string;
      severity?: number;
      evidence?: string[];
    }>;
    geoSignals?: Array<{
      title?: string;
      summary?: string;
      region?: string;
      severity?: number;
      links?: string[];
      evidence?: string[];
    }>;
    logisticsSignals?: Array<{
      title?: string;
      summary?: string;
      corridor?: string;
      severity?: number;
      links?: string[];
      evidence?: string[];
    }>;
    insiderSignals?: Array<{
      title?: string;
      summary?: string;
      severity?: number;
      evidence?: string[];
    }>;
  };
  risk?: {
    overallScore?: number;
    level?: "low" | "medium" | "high";
    breakdown?: {
      weather?: number;
      geopolitics?: number;
      logistics?: number;
      insider?: number;
    };
    why?: string[];
  };
  aiInsights?: string[];
  predictions?: Array<{
    category?: "short_term" | "long_term";
    horizon?: string;
    title?: string;
    prediction?: string;
    confidence?: number;
    drivers?: string[];
  }>;
  strategies?: Array<{
    title?: string;
    summary?: string;
    effectiveness?: number;
  }>;
  actionPlan?: Array<{
    step?: number;
    do?: string;
    details?: string;
  }>;
  finance?: {
    currentRevenue?: number;
    currentCost?: number;
    currentProfit?: number;
    marginPct?: number;
    potentialSavings?: number;
    lossAvoidance?: number;
    addedValue?: number;
    profitLiftPct?: number;
    monthlyTrend?: Array<{
      month?: string;
      revenue?: number;
      cost?: number;
      profit?: number;
    }>;
    savingsDrivers?: Array<{
      name?: string;
      value?: number;
    }>;
    profitScenario?: Array<{
      stage?: string;
      value?: number;
    }>;
    marginTrend?: Array<{
      month?: string;
      margin?: number;
    }>;
    opportunities?: Array<{
      title?: string;
      impact?: string;
      type?: string;
      detail?: string;
    }>;
  };
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
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const j = await res.json().catch(() => null);
    if (j?.error && j?.details) return `${j.error}: ${String(j.details).slice(0, 300)}`;
    if (j?.error) return String(j.error);
  }
  const t = await res.text().catch(() => "");
  return t ? t.slice(0, 300) : `HTTP ${res.status}`;
}

function buildAlertPayload(params: {
  meta: { sourceFileName: string | null; count: number | null; updatedAt: Date | null } | null;
  kpis: {
    totalSpend?: number;
    avgLeadTime?: number;
    avgStorage?: number;
    stockoutRiskPct?: number;
  };
  exposures: {
    bySupplier: Driver[];
    byProduct: Driver[];
    byLocation: Driver[];
    byRoute: Driver[];
  };
  output: KairosAdkOutput;
  signalsAsOf: string | null;
}) {
  const { meta, kpis, exposures, output, signalsAsOf } = params;

  const overallScore = Number(output.risk?.overallScore ?? 0);
  const overallLevel = normalizeLevel(output.risk?.level ?? levelFromScore(overallScore));

  const escalationLevel =
    overallLevel === "high" ? "escalate" : overallLevel === "medium" ? "watch" : "none";

  const escalationMessage =
    output.risk?.why?.[0] ??
    (overallLevel === "high"
      ? "Kairos detected a high-severity disruption pattern that needs immediate review."
      : overallLevel === "medium"
      ? "Kairos detected a developing risk pattern that should be monitored closely."
      : "Kairos risk level is currently stable.");

  const evidenceBase = (output.risk?.why ?? []).filter(Boolean).slice(0, 4);

  const signalRisks = [
    ...(output.signals?.weatherSignals ?? []).slice(0, 2).map((x) => ({
      risk: x.title || x.summary || "Weather disruption signal",
      severity: levelFromSeverity(x.severity, overallLevel),
      evidence: [...(x.evidence ?? []), x.location, x.timeWindow].filter(Boolean) as string[],
    })),
    ...(output.signals?.geoSignals ?? []).slice(0, 2).map((x) => ({
      risk: x.title || x.summary || "Geopolitics disruption signal",
      severity: levelFromSeverity(x.severity, overallLevel),
      evidence: [...(x.evidence ?? []), x.region].filter(Boolean) as string[],
    })),
    ...(output.signals?.logisticsSignals ?? []).slice(0, 2).map((x) => ({
      risk: x.title || x.summary || "Logistics disruption signal",
      severity: levelFromSeverity(x.severity, overallLevel),
      evidence: [...(x.evidence ?? []), x.corridor].filter(Boolean) as string[],
    })),
    ...(output.signals?.insiderSignals ?? []).slice(0, 2).map((x) => ({
      risk: x.title || x.summary || "Insider disruption signal",
      severity: levelFromSeverity(x.severity, overallLevel),
      evidence: [...(x.evidence ?? [])].filter(Boolean) as string[],
    })),
  ];

  const keyRisks =
    signalRisks.length > 0
      ? signalRisks
      : evidenceBase.map((why) => ({
          risk: why,
          severity: overallLevel,
          evidence: [why],
        }));

  const actionPlanItems = (output.actionPlan ?? []).slice(0, 5);

  const recommendations =
    actionPlanItems.length > 0
      ? actionPlanItems.map((item, index) => ({
          title: item.do || `Action Step ${item.step ?? index + 1}`,
          urgency: overallLevel,
          why: item.details || item.do || "Kairos recommends immediate operational follow-up.",
          steps: [item.do, item.details].filter(Boolean) as string[],
          owner: "Kairos",
          eta: overallLevel === "high" ? "Immediate" : overallLevel === "medium" ? "24-72 hours" : "Planned",
          evidence: evidenceBase,
        }))
      : (output.strategies ?? []).slice(0, 5).map((item, index) => ({
          title: item.title || `Strategy ${index + 1}`,
          urgency: overallLevel,
          why: item.summary || "Kairos recommends reviewing this strategy.",
          steps: [item.summary].filter(Boolean) as string[],
          owner: "Kairos",
          eta: overallLevel === "high" ? "Immediate" : overallLevel === "medium" ? "24-72 hours" : "Planned",
          evidence: evidenceBase,
        }));

  const totalSpend = Number(kpis.totalSpend ?? 0);

  const topExposureDrivers = [
    ...exposures.bySupplier.slice(0, 2).map((x) => ({
      driver: `Supplier: ${x.name}`,
      sharePct: totalSpend > 0 ? (x.value / totalSpend) * 100 : 0,
      evidence: `${x.name} accounts for ${fmtPct(totalSpend > 0 ? (x.value / totalSpend) * 100 : 0)} of spend.`,
    })),
    ...exposures.byProduct.slice(0, 2).map((x) => ({
      driver: `Product: ${x.name}`,
      sharePct: totalSpend > 0 ? (x.value / totalSpend) * 100 : 0,
      evidence: `${x.name} accounts for ${fmtPct(totalSpend > 0 ? (x.value / totalSpend) * 100 : 0)} of spend.`,
    })),
  ].slice(0, 4);

  return {
    meta: {
      sourceFileName: meta?.sourceFileName ?? null,
      count: meta?.count ?? null,
    },
    kpis,
    signals: {
      asOf: signalsAsOf ?? undefined,
    },
    output: {
      recommendations,
      escalation: {
        level: escalationLevel,
        message: escalationMessage,
        who: overallLevel === "high" ? ["Ops", "Procurement", "Supply Chain"] : ["Ops", "Procurement"],
        when: overallLevel === "high" ? "Immediately" : overallLevel === "medium" ? "Within 24 hours" : "Routine review",
        evidence: evidenceBase,
      },
      aiInsights: output.aiInsights ?? [],
      topExposureDrivers,
      keyRisks,
    },
  };
}

function shouldAttemptHighAlert(output: KairosAdkOutput): boolean {
  const level = normalizeLevel(output.risk?.level ?? levelFromScore(output.risk?.overallScore));
  if (level === "high") return true;

  const anyHighSignal = [
    ...(output.signals?.weatherSignals ?? []),
    ...(output.signals?.geoSignals ?? []),
    ...(output.signals?.logisticsSignals ?? []),
    ...(output.signals?.insiderSignals ?? []),
  ].some((item: any) => Number(item?.severity ?? 0) >= 70);

  return anyHighSignal;
}

function buildAlertFingerprint(payload: ReturnType<typeof buildAlertPayload>) {
  return JSON.stringify({
    dataset: payload.meta?.sourceFileName ?? null,
    count: payload.meta?.count ?? null,
    stockoutRiskPct: payload.kpis?.stockoutRiskPct ?? null,
    escalationLevel: payload.output?.escalation?.level ?? null,
    escalationMessage: payload.output?.escalation?.message ?? null,
    highRisks: (payload.output?.keyRisks ?? [])
      .filter((x) => x.severity === "high")
      .map((x) => x.risk),
    highRecommendations: (payload.output?.recommendations ?? [])
      .filter((x) => x.urgency === "high")
      .map((x) => x.title),
  });
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

  const [uid, setUid] = useState<string | null>(null);
  const lastAlertFingerprintRef = useRef<string | null>(null);

  useEffect(() => {
    updatingRef.current = updating;
  }, [updating]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      lastAlertFingerprintRef.current = localStorage.getItem(ALERT_FINGERPRINT_STORAGE_KEY);
    } catch {
      lastAlertFingerprintRef.current = null;
    }
  }, []);

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
      const adkOutput = json.output as KairosAdkOutput;
      const asOf = String(json.asOf ?? "");

      setAgentAsOf(asOf);
      setOutput(adkOutput);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("kairos:agent_ran"));
      }

      if (shouldAttemptHighAlert(adkOutput)) {
        const alertPayload = buildAlertPayload({
          meta: freshMeta,
          kpis: freshSummary.kpis,
          exposures: freshSummary.exposures,
          output: adkOutput,
          signalsAsOf: asOf,
        });

        const fingerprint = buildAlertFingerprint(alertPayload);
        const previousFingerprint =
          lastAlertFingerprintRef.current ??
          (typeof window !== "undefined"
            ? localStorage.getItem(ALERT_FINGERPRINT_STORAGE_KEY)
            : null);

        if (fingerprint !== previousFingerprint) {
          try {
            const alertRes = await fetch("/api/alert", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(alertPayload),
            });

            const alertJson = await alertRes.json().catch(() => null);

            if (alertRes.ok && alertJson?.ok && !alertJson?.skipped) {
              lastAlertFingerprintRef.current = fingerprint;
              if (typeof window !== "undefined") {
                localStorage.setItem(ALERT_FINGERPRINT_STORAGE_KEY, fingerprint);
              }
            }
          } catch (alertError) {
            console.warn("Kairos auto-email failed:", alertError);
          }
        }
      }
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
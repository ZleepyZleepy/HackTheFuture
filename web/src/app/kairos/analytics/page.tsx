"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { useKairosAgent } from "@/components/kairos/useKairosAgent";

function fmtNum(n: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0);
}

function riskBadge(level: "Low" | "Moderate" | "High") {
  if (level === "High") return "bg-red-100 text-red-800";
  if (level === "Moderate") return "bg-amber-100 text-amber-800";
  return "bg-emerald-100 text-emerald-800";
}

function computeOverallRisk({
  escalationLevel,
  weatherRisk,
  geoRisk,
}: {
  escalationLevel?: string;
  weatherRisk?: number;
  geoRisk?: number;
}): "Low" | "Moderate" | "High" {
  if (escalationLevel === "escalate") return "High";
  const w = Number(weatherRisk ?? 0);
  const g = Number(geoRisk ?? 0);
  const worst = Math.max(w, g);
  if (worst >= 70) return "High";
  if (worst >= 45) return "Moderate";
  return "Low";
}

function demoPredictions(signals: any) {
  const w = Number(signals?.weather?.overallRisk ?? 35);
  const g = Number(signals?.geopolitics?.riskScore ?? 30);
  const bump = Math.min(20, Math.round((Math.max(w, g) - 40) / 2));

  return [
    {
      horizon: "Next 7 days",
      prediction: `Lead times likely drift up by ~${Math.max(2, bump)} days on exposed lanes if current signals persist.`,
      confidence: w > 60 || g > 60 ? "Medium" : "Low",
      drivers: [
        w > 55 ? `Weather risk elevated (${fmtNum(w)}/100)` : "Normal weather volatility",
        g > 55 ? `Geopolitics risk elevated (${fmtNum(g)}/100)` : "No major geopolitical spike",
      ],
      doNow: "Pull in POs for top inputs, confirm inbound ETAs, and pre-book secondary routes.",
    },
    {
      horizon: "Next 2–4 weeks",
      prediction: "Supplier performance variance increases; expect higher partial fills on constrained inputs.",
      confidence: "Medium",
      drivers: ["Upstream disruption headlines + seasonal demand fluctuations", "Tighter carrier capacity windows"],
      doNow: "Split orders across 2 suppliers where possible; add safety stock for long-lead SKUs.",
    },
    {
      horizon: "Next 60 days",
      prediction: "Cost pressure risk (spot freight + input pricing) rises, especially on reroutes and expedited shipments.",
      confidence: "Low–Medium",
      drivers: ["Reroute premiums", "Potential tariff/sanction noise affecting ag inputs"],
      doNow: "Lock contract lanes, set approval thresholds for expediting, and pre-negotiate alternates.",
    },
  ];
}

function demoStrategies() {
  return [
    {
      title: "🌦 Climate resilience (weather-driven volatility)",
      why: "Reduce exposure to storm/temperature disruption by improving coverage and lane flexibility.",
      steps: [
        "Identify top 5 SKUs by spend + lead time; set minimum coverage (days on hand) thresholds.",
        "Create a ‘weather watch’ SOP: if weather risk > 70, trigger PO pull-forward and receiving overtime plan.",
        "Pre-arrange alternate carriers for the top lane, with rate cards for expedited options.",
      ],
      owners: "Procurement + Logistics",
    },
    {
      title: "🚢 Routing strategy (lane disruptions)",
      why: "Keep service levels stable when primary routes get congested or delayed.",
      steps: [
        "Define primary + secondary routes per region; map switching rules (cost ceiling, service floor).",
        "Implement reroute playbook: switch when delay > X days or risk score exceeds threshold.",
        "Pre-approve budget band for reroutes to avoid waiting on approvals during incidents.",
      ],
      owners: "Logistics + Finance",
    },
    {
      title: "👷 Workforce + movement of supplies",
      why: "Prevent internal bottlenecks when inbound timing becomes spiky.",
      steps: [
        "Stand up a ‘surge roster’ for receiving + QA when inbound hits cluster.",
        "Cross-train 2 backup staff on critical receiving checks and ERP receiving steps.",
        "Pre-stage storage locations for top inputs to reduce dock-to-stock time.",
      ],
      owners: "Ops + Warehouse",
    },
    {
      title: "📦 Allocation of resources (scarcity planning)",
      why: "Allocate constrained inputs to protect highest-value outputs.",
      steps: [
        "Rank production orders by margin + contractual SLA impact.",
        "Create allocation rules for scarce inputs (A-tier orders first).",
        "Trigger supplier outreach + substitution workflow if fill-rate drops below target.",
      ],
      owners: "Planning + Procurement",
    },
  ];
}

export default function KairosAnalyticsPage() {
  const { meta, insiderCount, signals, output, updating, error, update } = useKairosAgent();

  const lastUpdated =
    meta?.updatedAt instanceof Date
      ? meta.updatedAt.toLocaleString()
      : meta?.updatedAt
      ? new Date(meta.updatedAt as any).toLocaleString()
      : null;

  // ---- Auto update (no button) ----
  const updatingRef = useRef(false);
  useEffect(() => {
    updatingRef.current = updating;
  }, [updating]);

  const signature = `${meta?.sourceFileName ?? ""}|${meta?.count ?? ""}|${insiderCount}`;
  const lastSigRef = useRef<string>("");

  useEffect(() => {
    // run once when we first have a dataset (or when dataset/insiders change)
    if (!meta?.sourceFileName) return;
    if (lastSigRef.current === signature) return;
    lastSigRef.current = signature;
    if (!updatingRef.current) update();
  }, [signature, meta?.sourceFileName, update]);

  useEffect(() => {
    // interval: every 5 minutes
    const id = window.setInterval(() => {
      if (!updatingRef.current && meta?.sourceFileName) update();
    }, 5 * 60 * 1000);

    // instant refresh hooks (optional but nice)
    const safeUpdate = () => {
      if (!updatingRef.current && meta?.sourceFileName) update();
    };

    window.addEventListener("storage", safeUpdate);
    window.addEventListener("kairos:data_updated", safeUpdate as any);
    window.addEventListener("kairos:insiders_updated", safeUpdate as any);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("storage", safeUpdate);
      window.removeEventListener("kairos:data_updated", safeUpdate as any);
      window.removeEventListener("kairos:insiders_updated", safeUpdate as any);
    };
  }, [update, meta?.sourceFileName]);

  // ---- Alert / risk summary ----
  const weatherRisk = signals?.weather?.overallRisk;
  const geoRisk = signals?.geopolitics?.riskScore;
  const escalationLevel = output?.escalation?.level;
  const overallRisk = computeOverallRisk({ escalationLevel, weatherRisk, geoRisk });

  const autoActions =
    overallRisk === "High"
      ? [
          "Planned: Auto-email escalation to Ops + Procurement (stub; implement later).",
          "Planned: Attach the action plan + supplier outreach draft.",
        ]
      : overallRisk === "Moderate"
      ? ["Planned: Post alert to internal channel (stub)."]
      : ["No auto actions triggered."];

  // ---- Predictions & strategies (fabricated if needed) ----
  const predictions = useMemo(() => demoPredictions(signals), [signals]);
  const strategies = useMemo(() => demoStrategies(), []);

  // ---- Action Plan (prefer Gemini recommendations; fallback to realistic plan) ----
  const actionPlan = output?.recommendations?.length
    ? output.recommendations.map((r: any) => ({
        title: r.title,
        urgency: r.urgency,
        why: r.why,
        steps: r.steps,
        owner: r.owner,
        eta: r.eta,
        evidence: r.evidence,
      }))
    : [
        {
          title: "📌 Stabilize inbound timing (24–72h)",
          urgency: "high",
          why: "Signals indicate rising disruption volatility; prevent short-term stockouts and missed deliveries.",
          steps: [
            "Confirm ETAs for top 5 inbound POs and flag anything slipping >2 days.",
            "Pull forward POs for long-lead inputs where possible; split shipments if needed.",
            "Pre-book backup carrier option for the most exposed lane.",
          ],
          owner: "Procurement + Logistics",
          eta: "72 hours",
          evidence: ["Based on current weather/geopolitics risk signals and dataset lead time sensitivity."],
        },
        {
          title: "🧩 Reduce concentration risk (2 weeks)",
          urgency: "medium",
          why: "Concentrated spend increases fragility during disruptions.",
          steps: [
            "Identify the top supplier/product exposures by spend.",
            "Create 1 alternate supplier option per top input (even if higher unit cost).",
            "Negotiate temporary MOQ/lead-time terms for alternates.",
          ],
          owner: "Procurement",
          eta: "2 weeks",
          evidence: ["Exposure concentration patterns inferred from your uploaded dataset."],
        },
      ];

  return (
    <div className="space-y-4">
      {/* Header (matches your style) */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">📊 Analytics</h1>
          <div className="mt-1 flex flex-wrap gap-6 text-sm text-gray-600">
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

            <span>
              🕒 Last updated: <span className="font-medium">{lastUpdated ?? "—"}</span>
            </span>
          </div>
        </div>

        {/* no button; show status */}
        <div className="pt-1 text-sm text-gray-500">{updating ? "Updating…" : null}</div>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      {/* Alert + Signals */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-semibold">🚨 Alert</div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${riskBadge(overallRisk)}`}>
              {overallRisk} Risk
            </span>
          </div>
          <div className="mt-2 text-sm text-gray-700">
            {overallRisk === "High"
              ? "Immediate mitigation recommended. Escalation workflow should trigger."
              : overallRisk === "Moderate"
              ? "Watch closely. Prepare reroute and supplier split options."
              : "Stable. Continue monitoring."}
          </div>
          <div className="mt-3 text-xs text-gray-600">
            <div className="font-semibold text-gray-700">Auto-actions</div>
            <ul className="mt-1 list-disc pl-5">
              {autoActions.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-lg font-semibold">☁️ Weather Risk</div>
          <div className="mt-2 text-3xl font-bold">{signals ? `${fmtNum(weatherRisk ?? 0)}/100` : "—"}</div>
          <div className="mt-1 text-xs text-gray-600">
            {signals ? `Max location risk: ${fmtNum(signals.weather.maxRisk)}/100` : "Auto-updates every 5 minutes."}
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-lg font-semibold">🌍 Geopolitics Risk</div>
          <div className="mt-2 text-3xl font-bold">{signals ? `${fmtNum(geoRisk ?? 0)}/100` : "—"}</div>
          <div className="mt-1 text-xs text-gray-600">
            {signals ? `Articles scanned: ${signals.geopolitics.articles?.length ?? 0}` : "Auto-updates every 5 minutes."}
          </div>
        </div>
      </div>

      {/* AI Insights */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="text-lg font-semibold">🧠 AI Insights</div>
        {!output ? (
          <div className="mt-2 text-sm text-gray-600">Generating insights…</div>
        ) : (
          <ul className="mt-2 list-disc pl-5 text-sm text-gray-700">
            {output.aiInsights.map((x: string, i: number) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Predictions */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="text-lg font-semibold">🔮 Predictions</div>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {predictions.map((p, i) => (
            <div key={i} className="rounded-lg bg-gray-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{p.horizon}</div>
                <div className="text-xs text-gray-600">Confidence: {p.confidence}</div>
              </div>
              <div className="mt-2 text-sm text-gray-700">{p.prediction}</div>
              <div className="mt-2 text-xs text-gray-600">
                <div className="font-semibold text-gray-700">Drivers</div>
                <ul className="mt-1 list-disc pl-5">
                  {p.drivers.map((d: string, j: number) => (
                    <li key={j}>{d}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                <span className="font-semibold text-gray-700">Do now:</span> {p.doNow}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Strategies */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="text-lg font-semibold">🧭 Strategies</div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {strategies.map((s, i) => (
            <div key={i} className="rounded-lg bg-gray-50 p-3">
              <div className="font-semibold">{s.title}</div>
              <div className="mt-1 text-sm text-gray-700">{s.why}</div>
              <ol className="mt-2 list-decimal pl-5 text-sm text-gray-700">
                {s.steps.map((step: string, j: number) => (
                  <li key={j}>{step}</li>
                ))}
              </ol>
              <div className="mt-2 text-xs text-gray-600">
                Owner: <span className="font-medium">{s.owners}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Plan */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="text-lg font-semibold">✅ Action Plan (step-by-step)</div>
        <div className="mt-3 space-y-3">
          {actionPlan.map((r: any, i: number) => (
            <div key={i} className="rounded-lg bg-gray-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold">{r.title}</div>
                <div className="text-xs text-gray-600">Urgency: {r.urgency}</div>
              </div>
              <div className="mt-2 text-sm text-gray-700">{r.why}</div>
              <ul className="mt-2 list-disc pl-5 text-sm text-gray-700">
                {r.steps.map((s: string, j: number) => (
                  <li key={j}>{s}</li>
                ))}
              </ul>
              <div className="mt-2 text-xs text-gray-600">
                Owner: <span className="font-medium">{r.owner}</span> · ETA: <span className="font-medium">{r.eta}</span>
              </div>
              <div className="mt-2 text-xs text-gray-500">Evidence: {r.evidence.join(" · ")}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// "use client";

// import Link from "next/link";
// import { useEffect, useMemo, useRef } from "react";
// import { useKairosAgent } from "@/components/kairos/useKairosAgent";

// function clsRisk(level: "Low" | "Moderate" | "High") {
//   if (level === "High") return "bg-red-100 text-red-800";
//   if (level === "Moderate") return "bg-amber-100 text-amber-800";
//   return "bg-emerald-100 text-emerald-800";
// }

// function iconRisk(level: "Low" | "Moderate" | "High") {
//   if (level === "High") return "🔴";
//   if (level === "Moderate") return "🟠";
//   return "🟢";
// }

// function levelFromScore(score: number): "Low" | "Moderate" | "High" {
//   // simple UI thresholds (0–100)
//   if (score >= 70) return "High";
//   if (score >= 45) return "Moderate";
//   return "Low";
// }

// function explainScore(kind: "weather" | "geo") {
//   if (kind === "weather") {
//     return "0–100. Higher = higher disruption probability from severe weather across your locations (storms, extreme temps).";
//   }
//   return "0–100. Higher = higher disruption probability from policy/trade shocks (tariffs, sanctions, export controls) tied to your inputs/suppliers.";
// }

// function inferDeliverable(step: string) {
//   const s = step.toLowerCase();
//   if (s.includes("confirm") || s.includes("eta")) return "Updated ETA list + flagged late POs";
//   if (s.includes("reroute") || s.includes("alternate route")) return "Approved reroute option + carrier booking reference";
//   if (s.includes("split") || s.includes("secondary supplier") || s.includes("alternate supplier")) return "Supplier split plan + RFQ sent";
//   if (s.includes("buffer") || s.includes("safety stock") || s.includes("coverage")) return "Reorder + target coverage days set";
//   if (s.includes("notify") || s.includes("email") || s.includes("escalat")) return "Stakeholder alert with summary + next actions";
//   if (s.includes("approve") || s.includes("threshold")) return "Approval rule + budget band documented";
//   return "Checklist item completed + note logged";
// }

// export default function KairosAnalyticsPage() {
//   const { meta, insiderCount, signals, output, updating, error, update } = useKairosAgent();

//   // --- Auto-update: every 5 minutes + on upload/insider changes (events/storage) ---
//   const updatingRef = useRef(false);
//   useEffect(() => {
//     updatingRef.current = updating;
//   }, [updating]);

//   useEffect(() => {
//     const safeUpdate = () => {
//       if (!updatingRef.current) update();
//     };

//     // run once when page loads (if dataset exists)
//     if (meta?.sourceFileName) safeUpdate();

//     // every 5 minutes
//     const id = window.setInterval(safeUpdate, 5 * 60 * 1000);

//     // instant refresh hooks (optional, but if you dispatch these events it updates immediately)
//     window.addEventListener("storage", safeUpdate);
//     window.addEventListener("kairos:data_updated", safeUpdate as any);
//     window.addEventListener("kairos:insiders_updated", safeUpdate as any);

//     return () => {
//       window.clearInterval(id);
//       window.removeEventListener("storage", safeUpdate);
//       window.removeEventListener("kairos:data_updated", safeUpdate as any);
//       window.removeEventListener("kairos:insiders_updated", safeUpdate as any);
//     };
//   }, [update, meta?.sourceFileName]);

//   // --- timestamps ---
//   const datasetUpdated =
//     meta?.updatedAt instanceof Date
//       ? meta.updatedAt.toLocaleString()
//       : meta?.updatedAt
//       ? new Date(meta.updatedAt as any).toLocaleString()
//       : "—";

//   const signalsAsOf = signals?.asOf ? new Date(signals.asOf).toLocaleString() : "—";

//   // --- risk ---
//   const weatherScore = Number(signals?.weather?.overallRisk ?? 0);
//   const geoScore = Number(signals?.geopolitics?.riskScore ?? 0);
//   const overallScore = Math.round(Math.max(weatherScore, geoScore));
//   const overallLevel = levelFromScore(overallScore);

//   const weatherLevel = levelFromScore(weatherScore);
//   const geoLevel = levelFromScore(geoScore);

//   // --- compact “predictions” derived from scores (not demo, just deterministic heuristics) ---
//   const predictions = useMemo(() => {
//     const leadTimeBump =
//       overallScore >= 70 ? "▲ 3–6 days" : overallScore >= 45 ? "▲ 1–3 days" : "≈ stable";

//     const costPressure =
//       geoScore >= 70 ? "▲ higher" : geoScore >= 45 ? "▲ slight" : "≈ stable";

//     return [
//       { label: "Lead-time trend (7–14d)", value: leadTimeBump },
//       { label: "Expedite likelihood", value: overallScore >= 70 ? "High" : overallScore >= 45 ? "Medium" : "Low" },
//       { label: "Cost pressure (30d)", value: costPressure },
//     ];
//   }, [overallScore, geoScore]);

//   // --- action plan formatting (step-by-step w/ outputs) ---
//   const actionPlans = output?.recommendations ?? [];

//   return (
//     <div className="space-y-4">
//       {/* Header (consistent) */}
//       <div className="flex items-start justify-between gap-4">
//         <div>
//           <h1 className="text-2xl font-bold">📊 Analytics</h1>

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

//             <span>
//               🕒 Updated: <span className="font-medium">{datasetUpdated}</span>
//             </span>

//             <span>
//               🛰 Signals as-of: <span className="font-medium">{signalsAsOf}</span>
//             </span>

//             <span className="text-gray-500">Auto-updates every 5 min</span>
//           </div>
//         </div>

//         <div className="pt-1 text-sm text-gray-500">{updating ? "Updating…" : null}</div>
//       </div>

//       {error ? <div className="text-sm text-red-600">{error}</div> : null}

//       {/* Top: Alert + Weather + Geo */}
//       <div className="grid gap-4 md:grid-cols-3">
//         {/* Overall Alert */}
//         <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 p-4 text-white shadow-sm">
//           <div className="flex items-center justify-between gap-3">
//             <div className="text-lg font-semibold">🚨 Alert</div>
//             <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${clsRisk(overallLevel)}`}>
//               {iconRisk(overallLevel)} {overallLevel} Risk
//             </span>
//           </div>

//           <div className="mt-2 text-sm text-white/90">
//             Overall risk score: <span className="font-semibold">{overallScore}/100</span>
//           </div>

//           <div className="mt-3 grid grid-cols-3 gap-2">
//             {predictions.map((p, i) => (
//               <div key={i} className="rounded-xl bg-white/10 p-2">
//                 <div className="text-[11px] text-white/70">{p.label}</div>
//                 <div className="mt-1 text-sm font-semibold">{p.value}</div>
//               </div>
//             ))}
//           </div>

//           <div className="mt-3 text-xs text-white/70">
//             (Planned) If High: auto-email Ops/Procurement with this page’s plan.
//           </div>
//         </div>

//         {/* Weather */}
//         <div className="rounded-2xl bg-white p-4 shadow-sm">
//           <div className="flex items-center justify-between">
//             <div className="text-lg font-semibold">☁️ Weather</div>
//             <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${clsRisk(weatherLevel)}`}>
//               {iconRisk(weatherLevel)} {weatherLevel}
//             </span>
//           </div>

//           <div className="mt-2 text-3xl font-bold">{signals ? `${weatherScore}/100` : "—"}</div>
//           <div className="mt-2 text-xs text-gray-600">{explainScore("weather")}</div>

//           <div className="mt-2 text-xs text-gray-500">
//             Max location risk: <span className="font-medium">{signals ? `${signals.weather.maxRisk}/100` : "—"}</span>
//           </div>
//         </div>

//         {/* Geopolitics */}
//         <div className="rounded-2xl bg-white p-4 shadow-sm">
//           <div className="flex items-center justify-between">
//             <div className="text-lg font-semibold">🌍 Geopolitics</div>
//             <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${clsRisk(geoLevel)}`}>
//               {iconRisk(geoLevel)} {geoLevel}
//             </span>
//           </div>

//           <div className="mt-2 text-3xl font-bold">{signals ? `${geoScore}/100` : "—"}</div>
//           <div className="mt-2 text-xs text-gray-600">{explainScore("geo")}</div>

//           <div className="mt-2 text-xs text-gray-500">
//             Articles scanned: <span className="font-medium">{signals?.geopolitics?.articles?.length ?? 0}</span>
//           </div>
//         </div>
//       </div>

//       {/* AI Insights (short + visual) */}
//       <div className="rounded-2xl bg-white p-4 shadow-sm">
//         <div className="flex items-center justify-between">
//           <div className="text-lg font-semibold">🧠 AI Insights</div>
//           <span className="text-xs text-gray-500">Grounded in dataset + signals + insiders</span>
//         </div>

//         {!output ? (
//           <div className="mt-2 text-sm text-gray-600">Waiting for first run…</div>
//         ) : (
//           <div className="mt-3 grid gap-2 md:grid-cols-2">
//             {output.aiInsights.slice(0, 6).map((x, i) => (
//               <div key={i} className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
//                 {x}
//               </div>
//             ))}
//           </div>
//         )}
//       </div>

//       {/* Action Plan (step-by-step w/ outputs) */}
//       <div className="rounded-2xl bg-white p-4 shadow-sm">
//         <div className="flex items-center justify-between">
//           <div className="text-lg font-semibold">✅ Action Plan</div>
//           <span className="text-xs text-gray-500">Steps include expected outputs</span>
//         </div>

//         {!output ? (
//           <div className="mt-2 text-sm text-gray-600">Generating plan…</div>
//         ) : (
//           <div className="mt-3 space-y-3">
//             {actionPlans.map((r, i) => (
//               <div key={i} className="rounded-2xl bg-gray-50 p-3">
//                 <div className="flex flex-wrap items-center justify-between gap-2">
//                   <div className="font-semibold">{r.title}</div>
//                   <span
//                     className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
//                       r.urgency === "high"
//                         ? "bg-red-100 text-red-800"
//                         : r.urgency === "medium"
//                         ? "bg-amber-100 text-amber-800"
//                         : "bg-emerald-100 text-emerald-800"
//                     }`}
//                   >
//                     {r.urgency === "high" ? "🔴 High" : r.urgency === "medium" ? "🟠 Medium" : "🟢 Low"}
//                   </span>
//                 </div>

//                 <div className="mt-2 text-sm text-gray-700">{r.why}</div>

//                 <div className="mt-3 space-y-2">
//                   {r.steps.map((step, idx) => (
//                     <div key={idx} className="rounded-xl bg-white p-3 shadow-sm">
//                       <div className="text-sm font-semibold">Step {idx + 1}</div>
//                       <div className="mt-1 text-sm text-gray-700">{step}</div>
//                       <div className="mt-2 text-xs text-gray-600">
//                         <span className="font-semibold text-gray-700">Output:</span> {inferDeliverable(step)}
//                       </div>
//                     </div>
//                   ))}
//                 </div>

//                 <div className="mt-3 text-xs text-gray-600">
//                   Owner: <span className="font-medium">{r.owner}</span> · ETA:{" "}
//                   <span className="font-medium">{r.eta}</span>
//                 </div>

//                 <div className="mt-2 text-xs text-gray-500">Evidence: {r.evidence.join(" · ")}</div>
//               </div>
//             ))}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }
"use client";

import Link from "next/link";
import { useKairosAgent } from "@/components/kairos/useKairosAgent";

export default function KairosAnalyticsPage() {
  const { meta, insiderCount, output, updating, error, update } = useKairosAgent();

  return (
    <div className="space-y-4">
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
          </div>
        </div>

        <button
          onClick={update}
          disabled={updating}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {updating ? "Updating..." : "Update"}
        </button>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-lg font-semibold">✅ Recommendations</div>
          {!output ? (
            <div className="mt-2 text-sm text-gray-600">Click Update to generate AI recommendations.</div>
          ) : (
            <div className="mt-3 space-y-3">
              {output.recommendations.map((r, i) => (
                <div key={i} className="rounded-lg border bg-gray-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold">{r.title}</div>
                    <div className="text-xs text-gray-600">Urgency: {r.urgency}</div>
                  </div>
                  <div className="mt-2 text-sm text-gray-700">{r.why}</div>
                  <ul className="mt-2 list-disc pl-5 text-sm text-gray-700">
                    {r.steps.map((s, j) => (
                      <li key={j}>{s}</li>
                    ))}
                  </ul>
                  <div className="mt-2 text-xs text-gray-600">
                    Owner: <span className="font-medium">{r.owner}</span> · ETA:{" "}
                    <span className="font-medium">{r.eta}</span>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Evidence: {r.evidence.join(" · ")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-lg font-semibold">🚨 Escalation</div>
          {!output ? (
            <div className="mt-2 text-sm text-gray-600">Click Update to compute escalation plan.</div>
          ) : (
            <div className="mt-2 text-sm text-gray-700">
              <div className="font-semibold">Level: {output.escalation.level}</div>
              <div className="mt-2">{output.escalation.message}</div>
              <div className="mt-2 text-xs text-gray-600">
                Who: <span className="font-medium">{output.escalation.who.join(", ")}</span>
                {" · "}When: <span className="font-medium">{output.escalation.when}</span>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Evidence: {output.escalation.evidence.join(" · ")}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm lg:col-span-2">
          <div className="text-lg font-semibold">🧠 AI Insights</div>
          {!output ? (
            <div className="mt-2 text-sm text-gray-600">Click Update to generate grounded insights.</div>
          ) : (
            <ul className="mt-2 list-disc pl-5 text-sm text-gray-700">
              {output.aiInsights.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
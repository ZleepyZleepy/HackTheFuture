"use client";

import { useState } from "react";

type AgentPayload = {
  eventId: string;
  impact: {
    topPart: string;
    daysOfCover: number;
    estLeadTimeDays: number;
    lineStopInDays: number;
    revenueAtRiskUsd: number;
  };
  actions: { title: string; status: string }[];
  reasoningTrace: string[];
};

export default function RunAgentButton({ eventId }: { eventId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AgentPayload | null>(null);

  async function run() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });

      if (!res.ok) throw new Error(`Request failed (${res.status})`);

      const data = (await res.json()) as AgentPayload;
      setResult(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to run agent");
    } finally {
      setBusy(false);
    }
  }

    return (
    <div className="flex flex-col items-end gap-2">
        <button
        onClick={run}
        disabled={busy}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
        {busy ? "Running..." : "Run agent"}
        </button>

        {error ? <div className="text-xs text-red-600">{error}</div> : null}

        {result ? (
        <div className="w-[320px] rounded-lg border bg-white p-3 text-xs text-gray-700">
            <div className="font-medium">Agent output</div>
            <div className="mt-1 text-gray-600">Top part: {result.impact.topPart}</div>
            <div className="text-gray-600">
            Revenue at risk: ${result.impact.revenueAtRiskUsd.toLocaleString()}
            </div>
        </div>
        ) : null}
    </div>
    );
}
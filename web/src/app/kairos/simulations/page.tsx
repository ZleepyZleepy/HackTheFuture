"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadKairosRuns, type KairosRun } from "@/lib/runs";

export default function Page() {
  const [runs, setRuns] = useState<KairosRun[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    loadKairosRuns(5)
      .then(setRuns)
      .catch((e: any) => setErr(e?.message ?? "Failed to load runs"));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-gray-500">
          <Link href="/kairos" className="hover:underline">
            Dashboard
          </Link>{" "}
          / Run History
        </div>
        <h1 className="text-2xl font-semibold">Run History</h1>
        <p className="text-sm text-gray-600">Last 5 analysis runs saved for this account.</p>
      </div>

      {err ? <div className="text-sm text-red-600">{err}</div> : null}

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        {runs.length ? (
          <div className="space-y-3">
            {runs.map((r) => (
              <div key={r.runId} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{r.runId}</div>
                  <div className="text-xs text-gray-600">{new Date(r.createdAtMs).toLocaleString()}</div>
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Dataset: {r.dataMeta?.sourceFileName ?? "—"} · {r.dataMeta?.rowCount ?? 0} rows
                </div>
                <div className="text-sm mt-2">
                  Score: <span className="font-semibold">{r.result?.scorePct ?? "—"}%</span>{" "}
                  <span className="text-gray-600">· {r.result?.summary ?? ""}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-600">No runs yet. Go to /kairos/analysis and run one.</div>
        )}
      </section>
    </div>
  );
}
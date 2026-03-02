"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";

export type DisruptionEvent = {
  id: string;
  title: string;
  type: "PortDelay" | "SupplierInsolvency" | "LeadTimeSpike";
  region: string;
  severity: "Low" | "Medium" | "High";
  createdAt: string;
  status: "New" | "Investigating" | "Mitigating";
};

type RunSummary = {
  topPart?: string;
  revenueAtRiskUsd?: number;
  ranAt?: Date;
};

function Badge({ text }: { text: string }) {
  return (
    <span className="rounded-full border bg-white px-2 py-0.5 text-xs text-gray-700">
      {text}
    </span>
  );
}

export default function RadarView({ events }: { events: DisruptionEvent[] }) {
  const [summaries, setSummaries] = useState<Record<string, RunSummary>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);

      const pairs = await Promise.all(
        events.map(async (e) => {
          const runsRef = collection(db, "events", e.id, "runs");
          const uid = auth.currentUser?.uid;
          if (!uid) return [e.id, {}] as const;

          const q = query(
            runsRef,
            where("uid", "==", uid),
            orderBy("createdAt", "desc"),
            limit(1)
          );
          const snap = await getDocs(q);

          if (snap.empty) return [e.id, {}] as const;

          const doc = snap.docs[0].data() as any;
          const payload = doc.payload as any;

          const ranAt =
            doc.createdAt && typeof doc.createdAt.toDate === "function"
              ? doc.createdAt.toDate()
              : undefined;

          return [
            e.id,
            {
              topPart: payload?.impact?.topPart,
              revenueAtRiskUsd: payload?.impact?.revenueAtRiskUsd,
              ranAt,
            },
          ] as const;
        })
      );

      if (!alive) return;

      const next: Record<string, RunSummary> = {};
      for (const [id, s] of pairs) next[id] = s;

      setSummaries(next);
      setLoading(false);
    }

    load().catch(() => setLoading(false));

    return () => {
      alive = false;
    };
  }, [events]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Disruption Radar</h1>
          <p className="text-sm text-gray-600">
            Live signals → mapped to suppliers → BOM risk → mitigation plans.
          </p>
          {loading ? (
            <p className="mt-1 text-xs text-gray-500">Loading latest runs…</p>
          ) : null}
        </div>

        <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          Simulate new disruption
        </button>
      </div>

      <div className="grid gap-4">
        {events.map((e) => {
          const s = summaries[e.id] ?? {};
          return (
            <Link
              key={e.id}
              href={`/event/${e.id}`}
              className="rounded-xl border bg-white p-5 shadow-sm hover:shadow"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-sm text-gray-500">{e.id}</div>
                  <div className="text-base font-semibold">{e.title}</div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge text={e.type} />
                    <Badge text={`Region: ${e.region}`} />
                    <Badge text={`Severity: ${e.severity}`} />
                    <Badge text={`Status: ${e.status}`} />
                  </div>

                  <div className="pt-2 text-sm text-gray-600">
                    {s.topPart ? (
                      <>
                        <span className="font-medium">Last run:</span>{" "}
                        {s.topPart}
                        {typeof s.revenueAtRiskUsd === "number" ? (
                          <span className="text-gray-500">
                            {" "}
                            · ${s.revenueAtRiskUsd.toLocaleString()} at risk
                          </span>
                        ) : null}
                        {s.ranAt ? (
                          <span className="text-gray-500">
                            {" "}
                            · {s.ranAt.toLocaleString()}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-gray-500">
                        No agent run yet — open event and click Run agent.
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-sm text-gray-500">{e.createdAt}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
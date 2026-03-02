"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadMemory, MemoryRow } from "@/lib/memory";
import AuthGate from "@/components/AuthGate";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function MemoryView() {
  const [rows, setRows] = useState<MemoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid ?? null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) return;

    setErr(null);
    setLoading(true);

    loadMemory(uid)
      .then((r) => setRows(r))
      .catch((e: any) => setErr(e?.message ?? "Failed to load memory"))
      .finally(() => setLoading(false));
  }, [uid]);

  return (
    <AuthGate>
      <div className="space-y-6">
        <div>
          <div className="text-sm text-gray-500">
            <Link href="/radar" className="hover:underline">
              Radar
            </Link>{" "}
            / Memory
          </div>
          <h1 className="text-2xl font-semibold">Memory</h1>
          <p className="text-sm text-gray-600">
            Your approved alternates across events (audit trail).
          </p>
        </div>

        {err ? (
          <div className="rounded-lg border bg-white p-4 text-sm text-red-600">
            {err}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-lg border bg-white p-4 text-sm text-gray-600">
            Loading…
          </div>
        ) : rows.length ? (
          <div className="overflow-hidden rounded-lg border bg-white">
            <div className="grid grid-cols-12 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-600">
              <div className="col-span-3">Time</div>
              <div className="col-span-2">Event</div>
              <div className="col-span-3">Part</div>
              <div className="col-span-2">Score</div>
              <div className="col-span-2">Open</div>
            </div>

            {rows.map((r) => (
              <div key={r.decisionId} className="grid grid-cols-12 border-t px-4 py-3 text-sm items-center">
                <div className="col-span-3 text-gray-600">
                  {r.createdAt ? r.createdAt.toLocaleString() : "syncing…"}
                </div>
                <div className="col-span-2 font-medium">{r.eventId}</div>
                <div className="col-span-3">{r.part}</div>
                <div className="col-span-2">{Math.round(r.score * 100)}%</div>
                <div className="col-span-2">
                  <Link
                    className="rounded-lg border bg-white px-3 py-1 text-xs hover:bg-gray-50"
                    href={`/event/${r.eventId}`}
                  >
                    View event
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border bg-white p-4 text-sm text-gray-600">
            No approved decisions yet.
          </div>
        )}
      </div>
    </AuthGate>
  );
}
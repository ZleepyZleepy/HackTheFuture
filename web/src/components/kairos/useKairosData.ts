"use client";

import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { loadAgDataFull, type AgDataMeta, type AgDataRow } from "@/lib/agData";

export function useKairosData() {
  const [uid, setUid] = useState<string | null>(null);

  const [meta, setMeta] = useState<AgDataMeta | null>(null);
  const [rows, setRows] = useState<AgDataRow[]>([]);
  const [insiderCount, setInsiderCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { meta, rows } = await loadAgDataFull();
      setMeta(meta ?? null);
      setRows((rows ?? []) as AgDataRow[]);
    } catch (e: any) {
      setMeta(null);
      setRows([]);
      setError(e?.message ?? "Failed to load dataset");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUid(u?.uid ?? null);

      if (!u) {
        setMeta(null);
        setRows([]);
        setInsiderCount(0);
        setLoading(false);
        return;
      }

      // Load dataset
      await reload();

      // Load insider sources count
      try {
        const snap = await getDocs(collection(db, "users", u.uid, "insiderSources"));
        setInsiderCount(snap.size);
      } catch {
        setInsiderCount(0);
      }
    });

    return () => unsub();
  }, [reload]);

  return { uid, meta, rows, insiderCount, loading, error, reload };
}
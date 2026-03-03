"use client";

import AuthGate from "@/components/AuthGate";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { saveBom, loadBomFull, type BomRow as SavedBomRow } from "@/lib/bom";

type BomRow = {
  part: string;
  description: string;
  supplier: string;
  qty: number;
};

function parseSimpleCsv(text: string): BomRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  // Expect header: part,description,supplier,qty (case-insensitive)
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = {
    part: header.indexOf("part"),
    description: header.indexOf("description"),
    supplier: header.indexOf("supplier"),
    qty: header.indexOf("qty"),
  };

  // Fallback if no header
  const start = idx.part === -1 ? 0 : 1;

  const rows: BomRow[] = [];
  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());

    const part = cols[idx.part !== -1 ? idx.part : 0] ?? "";
    const description = cols[idx.description !== -1 ? idx.description : 1] ?? "";
    const supplier = cols[idx.supplier !== -1 ? idx.supplier : 2] ?? "";
    const qtyRaw = cols[idx.qty !== -1 ? idx.qty : 3] ?? "0";
    const qty = Number(qtyRaw) || 0;

    if (!part) continue;
    rows.push({ part, description, supplier, qty });
  }

  return rows;
}

export default function BomView() {
  const [rows, setRows] = useState<BomRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);

  const [loadingSaved, setLoadingSaved] = useState(false);
  const [savedInfo, setSavedInfo] = useState<{
    sourceFileName: string | null;
    count: number | null;
    updatedAt: Date | null;
  } | null>(null);


  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
    });
    return () => unsub();
  }, []);


  useEffect(() => {
    if (!uid) return;

    setErr(null);
    setLoadingSaved(true);

    loadBomFull()
      .then(({ meta, rows }) => {
        setSavedInfo(meta);
        setFileName(meta?.sourceFileName ?? null);
        setRows(rows ?? []);
      })
      .catch((e: any) => setErr(e?.message ?? "Failed to load saved BOM"))
      .finally(() => setLoadingSaved(false));
  }, [uid]);

  const stats = useMemo(() => {
    const suppliers = new Set(rows.map((r) => r.supplier).filter(Boolean));
    return { count: rows.length, suppliers: suppliers.size };
  }, [rows]);

  return (
    <AuthGate>
      <div className="space-y-6">
        <div>
          <div className="text-sm text-gray-500">
            <Link href="/radar" className="hover:underline">
              Radar
            </Link>{" "}
            / BOM
          </div>
          <h1 className="text-2xl font-semibold">BOM Upload</h1>
          <p className="text-sm text-gray-600">
            Upload a CSV so Vast can map disruptions → affected parts → risk → recommended alternates.
          </p>
        </div>

        <section className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
          <div className="text-sm font-medium">Upload CSV</div>
          <div className="text-xs text-gray-600">
            Expected columns: <span className="font-medium">part, description, supplier, qty</span>
          </div>

          <input
            type="file"
            accept=".csv,text/csv"
            className="block w-full text-sm"
            onChange={async (e) => {
              setErr(null);
              const f = e.target.files?.[0];
              if (!f) return;

              setFileName(f.name);

              try {
                const text = await f.text();
                const parsed = parseSimpleCsv(text);

                if (!parsed.length) {
                  setErr("No rows parsed. Check your CSV columns/format.");
                  setRows([]);
                  return;
                }

                // show immediately
                setRows(parsed);

                // persist
                await saveBom(parsed as SavedBomRow[], f.name);

                // re-load from Firestore so meta/updatedAt/count are consistent
                const { meta, rows } = await loadBomFull();
                setSavedInfo(meta);
                setRows(rows ?? []);
                setFileName(meta?.sourceFileName ?? f.name);
              } catch (ex: any) {
                setErr(ex?.message ?? "Failed to read CSV");
                setRows([]);
              }
            }}
          />

          <div className="text-xs text-gray-600">
            {loadingSaved ? (
              <span>Loading saved BOM…</span>
            ) : savedInfo ? (
              <>
                Saved for this account:{" "}
                <span className="font-medium">{savedInfo.sourceFileName ?? "—"}</span> ·{" "}
                <span className="font-medium">{savedInfo.count ?? 0}</span> parts · Last updated:{" "}
                <span className="font-medium">
                  {savedInfo.updatedAt ? savedInfo.updatedAt.toLocaleString() : "syncing…"}
                </span>
              </>
            ) : (
              <span>No BOM uploaded yet.</span>
            )}
          </div>

          {fileName ? (
            <div className="text-xs text-gray-600">
              Loaded: <span className="font-medium">{fileName}</span>
            </div>
          ) : null}

          <div className="text-xs text-gray-600">
            <span className="font-medium">{stats.count}</span> parts ·{" "}
            <span className="font-medium">{stats.suppliers}</span> suppliers
          </div>

          {err ? <div className="text-sm text-red-600">{err}</div> : null}
        </section>

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Preview</h2>

          {rows.length ? (
            <div className="mt-4 overflow-hidden rounded-lg border">
              <div className="grid grid-cols-12 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-600">
                <div className="col-span-3">Part</div>
                <div className="col-span-5">Description</div>
                <div className="col-span-3">Supplier</div>
                <div className="col-span-1 text-right">Qty</div>
              </div>

              {rows.slice(0, 50).map((r) => (

                <div
                  key={`${r.part}__${r.supplier}`}
                  className="grid grid-cols-12 gap-2 border-t px-4 py-3 text-sm"
                >
                  <div className="col-span-3 font-medium">{r.part}</div>
                  <div className="col-span-5 text-gray-700">{r.description}</div>
                  <div className="col-span-3 text-gray-600">{r.supplier}</div>
                  <div className="col-span-1 text-right">{r.qty}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-600">Upload a CSV to see a preview here.</p>
          )}

          {rows.length > 50 ? (
            <div className="mt-2 text-xs text-gray-500">Showing first 50 rows.</div>
          ) : null}
        </section>
      </div>
    </AuthGate>
  );
}
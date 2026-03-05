"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { saveAgData, loadAgDataFull, type AgDataRow as SavedAgRow } from "@/lib/agData";

type AgRow = {
  date: string;
  location: string;
  product: string;
  supplier: string;
  quantity: number;
  unit: string;
  leadTimeDays: number;
  costPerUnit: number;
  routeStart: string;
  routeEnd: string;
  storageDays: number;
};

function parseCsv(text: string): AgRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const hasHeader = header.includes("date") && header.includes("product");
  const start = hasHeader ? 1 : 0;

  const idx = (name: string, fallback: number) => {
    const i = header.indexOf(name);
    return i === -1 ? fallback : i;
  };

  const rows: AgRow[] = [];
  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const get = (name: string, fallback: number) => cols[idx(name, fallback)] ?? "";

    const row: AgRow = {
      date: get("date", 0),
      location: get("location", 1),
      product: get("product", 2),
      supplier: get("supplier", 3),
      quantity: Number(get("quantity", 4)) || 0,
      unit: get("unit", 5),
      leadTimeDays: Number(get("leadtimedays", 6)) || 0,
      costPerUnit: Number(get("costperunit", 7)) || 0,
      routeStart: get("routestart", 8),
      routeEnd: get("routeend", 9),
      storageDays: Number(get("storagedays", 10)) || 0,
    };

    if (!row.date || !row.product) continue;
    rows.push(row);
  }
  return rows;
}

export default function Page() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<AgRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // rehydrate dataset whenever you open this page (including after navigation)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      try {
        const loaded = await loadAgDataFull();
        if (loaded?.meta?.sourceFileName) setFileName(loaded.meta.sourceFileName);
        if (loaded?.rows?.length) setRows(loaded.rows as any);
      } catch {
        // ok if empty
      }
    });
    return () => unsub();
  }, []);

  const stats = useMemo(() => {
    const suppliers = new Set(rows.map((r) => r.supplier).filter(Boolean));
    const products = new Set(rows.map((r) => r.product).filter(Boolean));
    return { count: rows.length, suppliers: suppliers.size, products: products.size };
  }, [rows]);

  async function handleFile(f: File) {
    setErr(null);
    setSaving(true);
    setFileName(f.name);

    try {
      const text = await f.text();
      const parsed = parseCsv(text);
      if (!parsed.length) throw new Error("No rows parsed. Check CSV columns.");

      setRows(parsed);

      await saveAgData(parsed as unknown as SavedAgRow[], f.name);

      const loaded = await loadAgDataFull();
      if (loaded?.meta?.sourceFileName) setFileName(loaded.meta.sourceFileName);
      if (loaded?.rows?.length) setRows(loaded.rows as any);
    } catch (e: any) {
      setErr(e?.message ?? "Upload failed");
      setRows([]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-gray-500">
          <Link href="/kairos" className="hover:underline">
            Dashboard
          </Link>{" "}
          / Data Upload
        </div>
        <h1 className="text-2xl font-semibold">📦 Data Upload</h1>
        <p className="text-sm text-gray-600">
          Upload ops data so Kairos can compute exposure, delays, and stockout risk.
        </p>
      </div>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold">Upload CSV</div>
            <div className="text-xs text-gray-600">
              Columns:{" "}
              <span className="font-medium">
                date, location, product, supplier, quantity, unit, leadTimeDays, costPerUnit, routeStart, routeEnd, storageDays
              </span>
            </div>
          </div>

          <button
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--color-primary)" }}
            onClick={() => inputRef.current?.click()}
            disabled={saving}
          >
            {saving ? "⏳ Uploading..." : "📁 Browse files"}
          </button>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
        </div>

        <div
          className="mt-4 rounded-xl border border-dashed p-6 text-center bg-[rgba(0,0,0,0.02)]"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) void handleFile(f);
          }}
        >
          <div className="text-lg font-semibold">Drag & drop your CSV here</div>
          <div className="text-sm text-gray-600 mt-1">or click “Browse files”</div>

          <div className="mt-3 text-xs text-gray-600">
            📄 Dataset:{" "}
            {fileName ? <span className="font-medium">{fileName}</span> : <span>—</span>} ·{" "}
            <span className="font-medium">{stats.count}</span> rows ·{" "}
            <span className="font-medium">{stats.products}</span> products ·{" "}
            <span className="font-medium">{stats.suppliers}</span> suppliers
          </div>
        </div>

        {err ? <div className="mt-3 text-sm text-red-600">⚠️ {err}</div> : null}
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Preview</h2>

        {!rows.length ? (
          <p className="mt-2 text-sm text-gray-600">Upload a CSV to see a preview here.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border">
            <div className="grid grid-cols-12 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-600">
              <div className="col-span-2">Date</div>
              <div className="col-span-2">Location</div>
              <div className="col-span-2">Product</div>
              <div className="col-span-2">Supplier</div>
              <div className="col-span-2">Qty</div>
              <div className="col-span-2">Route / LT</div>
            </div>

            {rows.slice(0, 20).map((r, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 border-t px-4 py-3 text-sm">
                <div className="col-span-2">{r.date}</div>
                <div className="col-span-2 text-gray-700">{r.location}</div>
                <div className="col-span-2 font-medium">{r.product}</div>
                <div className="col-span-2 text-gray-700">{r.supplier}</div>
                <div className="col-span-2 text-gray-700">
                  {r.quantity} {r.unit}
                </div>
                <div className="col-span-2 text-gray-600">
                  {r.routeStart} → {r.routeEnd} · {r.leadTimeDays}d
                </div>
              </div>
            ))}
          </div>
        )}

        {rows.length > 20 ? <div className="mt-2 text-xs text-gray-500">Showing first 20 rows.</div> : null}
      </section>
    </div>
  );
}
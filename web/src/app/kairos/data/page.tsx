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
  const didInitRef = useRef(false);

  const [rows, setRows] = useState<AgRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [insiderCount, setInsiderCount] = useState<number>(0);

  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const stats = useMemo(() => {
    const suppliers = new Set(rows.map((r) => r.supplier).filter(Boolean));
    const products = new Set(rows.map((r) => r.product).filter(Boolean));
    const locations = new Set(rows.map((r) => r.location).filter(Boolean));
    return {
      count: rows.length,
      suppliers: suppliers.size,
      products: products.size,
      locations: locations.size,
    };
  }, [rows]);

  async function hydrateFromStorageOrSample() {
    const loaded = await loadAgDataFull();

    const loadedRows = (loaded?.rows ?? []) as any[];
    const source = loaded?.meta?.sourceFileName ?? null;

    const rawUpdatedAt = (loaded?.meta as any)?.updatedAt;
    const updated =
      rawUpdatedAt instanceof Date
        ? rawUpdatedAt.toLocaleString()
        : typeof rawUpdatedAt === "string"
          ? new Date(rawUpdatedAt).toLocaleString()
          : null;

    if (source) setFileName(source);
    if (updated) setLastUpdated(updated);

    if (loadedRows.length) {
      setRows(loadedRows as any);
      return;
    }

    // empty -> seed from sample.csv (still happens, just no UI sentence)
    try {
      const res = await fetch("/sample.csv", { cache: "no-store" });
      if (!res.ok) return;
      const text = await res.text();

      const parsed = parseCsv(text);
      if (!parsed.length) return;

      setRows(parsed);
      setFileName("sample.csv");

      await saveAgData(parsed as unknown as SavedAgRow[], "sample.csv");

      const loaded2 = await loadAgDataFull();
      const rawUpdatedAt2 = (loaded2?.meta as any)?.updatedAt;
      const updated2 =
        rawUpdatedAt2 instanceof Date
          ? rawUpdatedAt2.toLocaleString()
          : typeof rawUpdatedAt2 === "string"
            ? new Date(rawUpdatedAt2).toLocaleString()
            : null;

      if (loaded2?.meta?.sourceFileName) setFileName(loaded2.meta.sourceFileName);
      if (updated2) setLastUpdated(updated2);
      if (loaded2?.rows?.length) setRows(loaded2.rows as any);
    } catch {
      // silently ignore
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      if (didInitRef.current) return;
      didInitRef.current = true;

      try {
        await hydrateFromStorageOrSample();

        const raw = window.localStorage.getItem("kairos:insiders_count");
        if (raw && !Number.isNaN(Number(raw))) setInsiderCount(Number(raw));
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load data");
      }
    });

    return () => unsub();
  }, []);

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

      const rawUpdatedAt = (loaded?.meta as any)?.updatedAt;
      const updated =
        rawUpdatedAt instanceof Date
          ? rawUpdatedAt.toLocaleString()
          : typeof rawUpdatedAt === "string"
            ? new Date(rawUpdatedAt).toLocaleString()
            : null;
      setLastUpdated(updated);

      if (loaded?.rows?.length) setRows(loaded.rows as any);

      window.dispatchEvent(new Event("kairos:data_updated"));
    } catch (e: any) {
      setErr(e?.message ?? "Upload failed");
      setRows([]);
      setFileName(null);
      setLastUpdated(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Data Upload</h1>

          <p className="mt-1 text-sm text-gray-600">
            Upload additional Operations Data so Kairos can compute exposure, delays, and stockout risk.
          </p>

          <div className="mt-1 flex flex-wrap gap-6 text-sm text-gray-600">
            {fileName ? (
              <span>
                📄 Dataset: <span className="font-medium">{fileName}</span> ·{" "}
                <span className="font-medium">{stats.count}</span> rows
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
              🕒 Last Updated: <span className="font-medium">{lastUpdated ?? "—"}</span>
            </span>
          </div>
        </div>
      </div>

      {err ? <div className="text-sm text-red-600">⚠️ {err}</div> : null}

      {/* UPLOAD CARD */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div>
          <div className="text-sm font-semibold">Upload CSV</div>
          <div className="text-xs text-gray-600 mt-1">
            Columns:{" "}
            <span className="font-medium">
              Date (YYYY-MM-DD), Location, Product, Supplier, Quantity, Unit, Lead Time in Days, Cost Per Unit, Route Origin, Route Destination, Storage Days
            </span>
          </div>
        </div>

        {/* Dropzone contains the button */}
        <div
          className="mt-4 rounded-2xl p-7 text-center shadow-sm bg-gradient-to-br from-slate-50 to-indigo-50 border-2 border-dashed border-gray-300"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) void handleFile(f);
          }}
        >
          {/* Button replaces ⬆️ */}
          <button
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60 bg-gradient-to-r from-indigo-600 to-blue-600"
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

          <div className="mt-4 text-lg font-semibold">Drag & drop your CSV here</div>
          <div className="text-sm text-gray-600 mt-1">or click “Browse files”</div>

          {/* outlined chips */}
          <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
            <span className="rounded-full border border-gray-300 bg-white px-3 py-1 text-gray-700 shadow-sm">
              🧭 <span className="font-medium">{stats.locations}</span> locations
            </span>
            <span className="rounded-full border border-gray-300 bg-white px-3 py-1 text-gray-700 shadow-sm">
              🏷️ <span className="font-medium">{stats.products}</span> products
            </span>
            <span className="rounded-full border border-gray-300 bg-white px-3 py-1 text-gray-700 shadow-sm">
              🏭 <span className="font-medium">{stats.suppliers}</span> suppliers
            </span>
          </div>
        </div>
      </section>

      {/* PREVIEW */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Preview</h2>

        {!rows.length ? (
          <p className="mt-2 text-sm text-gray-600">Upload a CSV to see a preview here.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-black bg-white">
            <div className="grid grid-cols-12 bg-gradient-to-r from-slate-50 to-indigo-50 px-4 py-2 text-xs font-semibold text-gray-700">
              <div className="col-span-2">Date</div>
              <div className="col-span-2">Location</div>
              <div className="col-span-2">Product</div>
              <div className="col-span-2">Supplier</div>
              <div className="col-span-2">Quantity</div>
              <div className="col-span-2">Route / Lead Time</div>
            </div>

            {rows.slice(0, 20).map((r, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 border-t border-black/10 px-4 py-3 text-sm hover:bg-slate-50/60">
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
      </section>
    </div>
  );
}
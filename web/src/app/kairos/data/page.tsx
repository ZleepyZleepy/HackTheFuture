"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadAgDataFull, saveAgData, type AgDataRow } from "@/lib/agData";

function toNum(v: string): number | undefined {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : undefined;
}

function mergeRoute(row: AgDataRow): string {
  // prefer split fields, fallback to old "route" string
  const a = (row.routeStart ?? "").trim();
  const b = (row.routeEnd ?? "").trim();
  if (a || b) return `${a || "?"} → ${b || "?"}`;

  const legacy = (row.route ?? "").trim();
  return legacy || "—";
}

function parseAgCsv(text: string): AgDataRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);

  const col = {
    date: idx("date"),
    location: idx("location"),
    product: idx("product"),
    supplier: idx("supplier"),
    quantity: idx("quantity"),
    unit: idx("unit"),
    leadTimeDays: idx("leadtimedays"),
    costPerUnit: idx("costperunit"),
    routeStart: idx("routestart"),
    routeEnd: idx("routeend"),
    storageDays: idx("storagedays"),

    // backward compatible (if someone still uploads a single route column)
    route: idx("route"),
  };

  const hasHeader = col.date !== -1 && col.product !== -1 && col.quantity !== -1;
  const start = hasHeader ? 1 : 0;

  const out: AgDataRow[] = [];

  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const get = (i: number, fallback: number) => cols[i !== -1 ? i : fallback] ?? "";

    const date = get(col.date, 0);
    const location = get(col.location, 1);
    const product = get(col.product, 2);
    const supplier = get(col.supplier, 3);
    const quantityRaw = get(col.quantity, 4);
    const unit = get(col.unit, 5);

    if (!date || !product || !supplier) continue;

    const row: AgDataRow = {
      date,
      location,
      product,
      supplier,
      quantity: Number(quantityRaw) || 0,
      unit: unit || "units",
    };

    const ltd = toNum(get(col.leadTimeDays, 6));
    const cpu = toNum(get(col.costPerUnit, 7));
    const rs = get(col.routeStart, 8);
    const re = get(col.routeEnd, 9);
    const sd = toNum(get(col.storageDays, 10));

    if (ltd !== undefined) row.leadTimeDays = ltd;
    if (cpu !== undefined) row.costPerUnit = cpu;
    if (rs) row.routeStart = rs;
    if (re) row.routeEnd = re;
    if (sd !== undefined) row.storageDays = sd;

    // fallback: if upload uses "route" only
    const legacyRoute = get(col.route, -1);
    if (!row.routeStart && !row.routeEnd && legacyRoute) row.route = legacyRoute;

    out.push(row);
  }

  return out;
}

export default function Page() {
  const [rows, setRows] = useState<AgDataRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedInfo, setSavedInfo] = useState<{
    sourceFileName: string | null;
    count: number | null;
    updatedAt: Date | null;
  } | null>(null);

  useEffect(() => {
    setLoadingSaved(true);
    loadAgDataFull()
      .then(({ meta, rows }) => {
        setSavedInfo(meta);
        if (meta?.sourceFileName) setFileName(meta.sourceFileName);
        if (rows?.length) setRows(rows);
      })
      .catch((e: any) => setErr(e?.message ?? "Failed to load saved agriculture data"))
      .finally(() => setLoadingSaved(false));
  }, []);

  const stats = useMemo(() => {
    const suppliers = new Set(rows.map((r) => r.supplier).filter(Boolean));
    const products = new Set(rows.map((r) => r.product).filter(Boolean));
    return { count: rows.length, suppliers: suppliers.size, products: products.size };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-gray-500">
          <Link href="/kairos" className="hover:underline">
            Dashboard
          </Link>{" "}
          / Data Upload
        </div>
        <h1 className="text-2xl font-semibold">Agriculture Data Upload</h1>
        <p className="text-sm text-gray-600">
          Upload internal operational data so Kairos can quantify margin + stockout risk.
        </p>
      </div>

      <section className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
        <div className="text-sm font-medium">Upload CSV</div>
        <div className="text-xs text-gray-600">
          Expected columns:{" "}
          <span className="font-medium">
            date, location, product, supplier, quantity, unit, leadTimeDays, costPerUnit, routeStart, routeEnd,
            storageDays
          </span>
        </div>

        <input
          type="file"
          accept=".csv,text/csv"
          className="block w-full text-sm"
          disabled={saving}
          onChange={async (e) => {
            setErr(null);
            const f = e.target.files?.[0];
            if (!f) return;

            setFileName(f.name);

            try {
              const text = await f.text();
              const parsed = parseAgCsv(text);

              if (!parsed.length) {
                setErr("No rows parsed. Check your CSV columns/format.");
                setRows([]);
                return;
              }

              setRows(parsed);

              setSaving(true);
              await saveAgData(parsed, f.name);

              const { meta, rows } = await loadAgDataFull();
              setSavedInfo(meta);
              setRows(rows);
              setFileName(meta?.sourceFileName ?? f.name);
            } catch (ex: any) {
              setErr(ex?.message ?? "Failed to read/save CSV");
            } finally {
              setSaving(false);
            }
          }}
        />

        {loadingSaved ? <div className="text-xs text-gray-500">Loading saved data…</div> : null}

        {fileName ? (
          <div className="text-xs text-gray-600">
            Loaded: <span className="font-medium">{fileName}</span>{" "}
            {saving ? <span className="text-gray-500">· Saving…</span> : null}
            <div className="mt-1">
              <span className="font-medium">{stats.count}</span> rows ·{" "}
              <span className="font-medium">{stats.products}</span> products ·{" "}
              <span className="font-medium">{stats.suppliers}</span> suppliers
            </div>
          </div>
        ) : null}

        {err ? <div className="text-sm text-red-600">{err}</div> : null}
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Preview</h2>

        {rows.length ? (
          <div className="mt-4 overflow-x-auto rounded-lg border">
            <table className="min-w-[1100px] w-full text-sm">
              <thead className="bg-gray-50 text-xs font-medium text-gray-600">
                <tr>
                  <th className="text-left px-4 py-2">Date</th>
                  <th className="text-left px-4 py-2">Location</th>
                  <th className="text-left px-4 py-2">Product</th>
                  <th className="text-left px-4 py-2">Supplier</th>
                  <th className="text-right px-4 py-2">Qty</th>
                  <th className="text-left px-4 py-2">Unit</th>
                  <th className="text-right px-4 py-2">LT (days)</th>
                  <th className="text-right px-4 py-2">Cost/unit</th>
                  <th className="text-right px-4 py-2">Storage (days)</th>
                  <th className="text-left px-4 py-2">Route</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={`${r.date}-${r.product}-${i}`} className="border-t">
                    <td className="px-4 py-3 font-medium">{r.date}</td>
                    <td className="px-4 py-3 text-gray-700">{r.location}</td>
                    <td className="px-4 py-3 text-gray-800">{r.product}</td>
                    <td className="px-4 py-3 text-gray-600">{r.supplier}</td>
                    <td className="px-4 py-3 text-right">{r.quantity}</td>
                    <td className="px-4 py-3">{r.unit}</td>
                    <td className="px-4 py-3 text-right">{r.leadTimeDays ?? "—"}</td>
                    <td className="px-4 py-3 text-right">{r.costPerUnit ?? "—"}</td>
                    <td className="px-4 py-3 text-right">{r.storageDays ?? "—"}</td>
                    <td className="px-4 py-3">{mergeRoute(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-600">Upload a CSV to see a preview here.</p>
        )}

        {rows.length > 50 ? <div className="mt-2 text-xs text-gray-500">Showing first 50 rows.</div> : null}
      </section>
    </div>
  );
}
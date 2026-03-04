"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { addInsiderSource, deleteInsiderSource, loadInsiderSources, type InsiderSource } from "@/lib/insiderSources";

export default function Page() {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [items, setItems] = useState<InsiderSource[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const list = await loadInsiderSources();
    setItems(list);
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-gray-500">
          <Link href="/kairos" className="hover:underline">
            Dashboard
          </Link>{" "}
          / Insider Sources
        </div>
        <h1 className="text-2xl font-semibold">Insider Sources</h1>
        <p className="text-sm text-gray-600">
          Add internal notes, private supplier emails, contract constraints, or anything non-public that Kairos should consider.
        </p>
      </div>

      <section className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
        <div className="text-sm font-medium">Add a source</div>

        <input
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder="Title (e.g., Supplier says shipment delay likely 10–14 days)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <textarea
          className="w-full min-h-[120px] rounded-md border px-3 py-2 text-sm"
          placeholder="Paste the internal note here…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <button
          disabled={busy || !title.trim() || !text.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white text-sm font-semibold disabled:opacity-60"
          onClick={async () => {
            setErr(null);
            setBusy(true);
            try {
              await addInsiderSource({ title: title.trim(), text: text.trim() });
              setTitle("");
              setText("");
              await refresh();
            } catch (e: any) {
              setErr(e?.message ?? "Failed to add source");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving..." : "Add source"}
        </button>

        {err ? <div className="text-sm text-red-600">{err}</div> : null}
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Saved sources</h2>

        {items.length ? (
          <div className="mt-4 space-y-2">
            {items.map((s) => (
              <div key={s.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{s.title}</div>
                  <button
                    className="text-xs text-red-600 hover:underline"
                    onClick={async () => {
                      await deleteInsiderSource(s.id);
                      await refresh();
                    }}
                  >
                    Delete
                  </button>
                </div>
                <div className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{s.text}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-600">No insider sources yet.</p>
        )}
      </section>
    </div>
  );
} 
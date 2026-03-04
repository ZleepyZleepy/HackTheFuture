import { auth, db } from "@/lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";

export type AgDataRow = {
  date: string; // YYYY-MM-DD (keep as string for easy CSV + filters)
  location: string;
  product: string;
  supplier: string;
  quantity: number;
  unit: string;

  // optional fields (still useful for scoring later)
  leadTimeDays?: number;
  costPerUnit?: number;

  routeStart?: string;
  routeEnd?: string;
  route?: string;
  
  storageDays?: number;
};

export type AgDataMeta = {
  sourceFileName: string | null;
  count: number | null;
  updatedAt: Date | null;
};

function requireUid(): string {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in");
  return u.uid;
}

function normKey(s: unknown): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_\-:.]/g, "");
}

// Deterministic doc id so re-uploading the same file doesn't create duplicates
function rowId(row: AgDataRow, idx: number): string {
  const d = normKey(row.date || "unknown_date");
  const p = normKey(row.product || "unknown_product");
  const s = normKey(row.supplier || "unknown_supplier");
  const l = normKey(row.location || "unknown_location");

  const rs = normKey(row.routeStart || "");
  const re = normKey(row.routeEnd || "");
  const r = normKey(row.route || "");

  return `${d}__${p}__${s}__${l}__${rs}__${re}__${r}__${idx}`.slice(0, 220);
}

async function deleteAllDocsInCollection(pathParts: string[]) {
  const uid = requireUid();
  const colRef = collection(db, "users", uid, ...pathParts);
  const snap = await getDocs(colRef);
  if (snap.empty) return;

  // Firestore batch limit is 500 ops; keep a safety margin
  const CHUNK = 450;
  for (let i = 0; i < snap.docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const d of snap.docs.slice(i, i + CHUNK)) {
      batch.delete(d.ref);
    }
    await batch.commit();
  }
}

export async function saveAgData(rows: AgDataRow[], sourceFileName: string) {
  const uid = requireUid();

  // 1) Replace the current dataset (simple MVP behavior)
  await deleteAllDocsInCollection(["agDataRows"]);

  // 2) Write rows (batched)
  const CHUNK = 450;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = writeBatch(db);
    const slice = rows.slice(i, i + CHUNK);

    for (let j = 0; j < slice.length; j++) {
      const r = slice[j];
      const id = rowId(r, i + j);
      const ref = doc(db, "users", uid, "agDataRows", id);
      batch.set(ref, r, { merge: true });
    }
    await batch.commit();
  }

  // 3) Save "current" meta
  const nowMs = Date.now();
  await setDoc(
    doc(db, "users", uid, "agData", "current"),
    {
      sourceFileName,
      count: rows.length,
      updatedAt: serverTimestamp(),
      updatedAtMs: nowMs, // for consistent ordering even before serverTimestamp resolves
    },
    { merge: true }
  );

  // 4) Append a run meta record (for “last 5” uploads)
  const runRef = doc(collection(db, "users", uid, "agDataRuns"));
  await setDoc(runRef, {
    sourceFileName,
    count: rows.length,
    createdAt: serverTimestamp(),
    createdAtMs: nowMs,
  });

  // 5) Keep only last 5 runs
  const runsSnap = await getDocs(
    query(collection(db, "users", uid, "agDataRuns"), orderBy("createdAtMs", "desc"))
  );

  const extra = runsSnap.docs.slice(5);
  if (extra.length) {
    const batch = writeBatch(db);
    for (const d of extra) batch.delete(d.ref);
    await batch.commit();
  }

  return { runId: runRef.id, count: rows.length };
}

export async function loadAgDataFull(): Promise<{ meta: AgDataMeta; rows: AgDataRow[] }> {
  const uid = requireUid();

  // meta
  const metaSnap = await getDoc(doc(db, "users", uid, "agData", "current"));
  const metaData = metaSnap.exists() ? metaSnap.data() : null;

  const meta: AgDataMeta = {
    sourceFileName: (metaData?.sourceFileName as string) ?? null,
    count: typeof metaData?.count === "number" ? (metaData.count as number) : null,
    updatedAt: metaData?.updatedAt?.toDate ? metaData.updatedAt.toDate() : null,
  };

  // rows
  const rowsSnap = await getDocs(collection(db, "users", uid, "agDataRows"));
  const rows: AgDataRow[] = rowsSnap.docs.map((d) => d.data() as AgDataRow);

  return { meta, rows };
}

export async function clearAgData() {
  const uid = requireUid();

  await deleteAllDocsInCollection(["agDataRows"]);

  // clear meta doc + runs
  await deleteDoc(doc(db, "users", uid, "agData", "current")).catch(() => {});
  const runsSnap = await getDocs(collection(db, "users", uid, "agDataRuns"));
  if (!runsSnap.empty) {
    const batch = writeBatch(db);
    for (const d of runsSnap.docs) batch.delete(d.ref);
    await batch.commit();
  }
}
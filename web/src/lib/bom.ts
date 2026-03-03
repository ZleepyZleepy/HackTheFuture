import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, writeBatch, type Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type BomRow = {
  part: string;
  description: string;
  supplier: string;
  qty: number;
};

export type BomMeta = {
  sourceFileName: string | null;
  count: number | null;
  updatedAt: Date | null;
};

function userRequired() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  return user;
}

// OPTIONAL BUT RECOMMENDED: delete old rows so your BOM doesn’t “accumulate” stale docs
async function deleteAllBomRows(uid: string) {
  const rowsCol = collection(db, "users", uid, "bomRows");
  const snap = await getDocs(rowsCol);

  let batch = writeBatch(db);
  let ops = 0;

  for (const d of snap.docs) {
    batch.delete(d.ref);
    ops++;
    if (ops >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
}

export async function saveBom(rows: BomRow[], sourceFileName?: string | null) {
  const user = userRequired();
  const uid = user.uid;

  // wipe old rows first (prevents stale preview + wrong risk results later)
  await deleteAllBomRows(uid);

  // Write meta
  await setDoc(
    doc(db, "users", uid, "bom", "current"),
    {
      uid,
      sourceFileName: sourceFileName ?? null,
      updatedAt: serverTimestamp(),
      count: rows.length,
    },
    { merge: true }
  );

  // Insert rows
  let batch = writeBatch(db);
  let ops = 0;

  for (const r of rows) {
    const partKey = encodeURIComponent(`${r.part}__${r.supplier || ""}`);
    batch.set(doc(db, "users", uid, "bomRows", partKey), {
      uid,
      ...r,
      updatedAt: serverTimestamp(),
    });

    ops++;
    if (ops >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
}

export async function loadBomFull(): Promise<{ meta: BomMeta | null; rows: BomRow[] }> {
  const user = userRequired();
  const uid = user.uid;

  const metaSnap = await getDoc(doc(db, "users", uid, "bom", "current"));
  const metaData = metaSnap.exists() ? (metaSnap.data() as any) : null;

  const updatedAtTs = metaData?.updatedAt as Timestamp | undefined;
  const meta: BomMeta | null = metaData
    ? {
        sourceFileName: (metaData.sourceFileName ?? null) as string | null,
        count: (metaData.count ?? null) as number | null,
        updatedAt: updatedAtTs?.toDate?.() ?? null,
      }
    : null;

  const rowsSnap = await getDocs(collection(db, "users", uid, "bomRows"));
  const rows = rowsSnap.docs.map((d) => d.data() as BomRow);

  rows.sort(
    (a, b) =>
      a.part.localeCompare(b.part) || (a.supplier || "").localeCompare(b.supplier || "")
  );

  return { meta, rows };
}
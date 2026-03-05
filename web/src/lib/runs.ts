import { collection, deleteDoc, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type KairosRun = {
  runId: string;
  createdAt: any; // serverTimestamp
  createdAtMs: number;
  dataMeta: {
    sourceFileName: string | null;
    rowCount: number;
  };
  result: any; // store full agent output
};

export async function saveKairosRun(run: Omit<KairosRun, "createdAt">) {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in");

  const runRef = doc(db, "users", u.uid, "kairosRuns", run.runId);
  await setDoc(runRef, { ...run, createdAt: serverTimestamp() }, { merge: false });

  // keep last 5: fetch newest 10, delete older ones after 5
  const runsQ = query(
    collection(db, "users", u.uid, "kairosRuns"),
    orderBy("createdAtMs", "desc"),
    limit(10)
  );

  const snap = await getDocs(runsQ);
  const docs = snap.docs;
  const keep = docs.slice(0, 5);
  const drop = docs.slice(5);

  for (const d of drop) {
    await deleteDoc(d.ref);
  }

  return keep.map((d) => d.data()) as KairosRun[];
}

export async function loadKairosRuns(limitN = 5): Promise<KairosRun[]> {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in");

  const runsQ = query(
    collection(db, "users", u.uid, "kairosRuns"),
    orderBy("createdAtMs", "desc"),
    limit(limitN)
  );

  const snap = await getDocs(runsQ);
  return snap.docs.map((d) => d.data() as KairosRun);
}
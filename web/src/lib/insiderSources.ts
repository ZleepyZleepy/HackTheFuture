import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type InsiderSource = {
  id: string;
  title: string;
  text: string;
  createdAtMs: number;
};

export async function addInsiderSource(input: { title: string; text: string }) {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in");

  const ref = await addDoc(collection(db, "users", u.uid, "insiderSources"), {
    title: input.title,
    text: input.text,
    createdAtMs: Date.now(),
    createdAt: serverTimestamp(),
  });

  return ref.id;
}

export async function loadInsiderSources(): Promise<InsiderSource[]> {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in");

  const qy = query(collection(db, "users", u.uid, "insiderSources"), orderBy("createdAtMs", "desc"));
  const snap = await getDocs(qy);

  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  }));
}

export async function deleteInsiderSource(id: string) {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in");
  await deleteDoc(doc(db, "users", u.uid, "insiderSources", id));
}
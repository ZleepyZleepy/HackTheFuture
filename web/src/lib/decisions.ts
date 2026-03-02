import { addDoc, collection, getDocs, limit, query, serverTimestamp, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type Decision = {
  part: string;
  score: number;
  notes: string;
};

export async function saveDecision(eventId: string, decision: Decision, context?: unknown) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  const ref = collection(db, "events", eventId, "decisions");
  const docRef = await addDoc(ref, {
    uid: user.uid,
    isAnonymous: user.isAnonymous,
    decision,
    context: context ?? null,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function listDecisions(eventId: string, uid: string) {
  const ref = collection(db, "events", eventId, "decisions");
  const q = query(ref, where("uid", "==", uid), limit(25));
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data() as any;
    const createdAt =
      data.createdAt && typeof data.createdAt.toDate === "function"
        ? data.createdAt.toDate()
        : undefined;

    return {
      id: d.id,
      createdAt,
      decision: data.decision as Decision,
    };
  });
}
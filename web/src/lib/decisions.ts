import { collection, deleteDoc, doc, getDocs, limit, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

function decisionDocId(uid: string, part: string) {
  return `${uid}__${encodeURIComponent(part)}`;
}

export type Decision = {
  part: string;
  score: number;
  notes: string;
};

export async function saveDecision(eventId: string, decision: Decision, context?: unknown) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  const id = decisionDocId(user.uid, decision.part);

  await setDoc(
    doc(db, "events", eventId, "decisions", id),
    {
      uid: user.uid,
      createdAt: serverTimestamp(),
      decision,
      context,
    },
    { merge: true }
  );

  return id;
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

export async function cancelDecision(eventId: string, part: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  const id = decisionDocId(user.uid, part);
  await deleteDoc(doc(db, "events", eventId, "decisions", id));
}
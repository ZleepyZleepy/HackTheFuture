import { collectionGroup, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type MemoryRow = {
  eventId: string;
  decisionId: string;
  createdAt?: Date;
  part: string;
  score: number;
  notes: string;
};

export async function loadMemory(uid: string) {
  const q = query(
    collectionGroup(db, "decisions"),
    where("uid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(100)
  );

  const snap = await getDocs(q);

  const rows: MemoryRow[] = snap.docs.map((d) => {
    const data = d.data() as any;

    const createdAt =
      data.createdAt && typeof data.createdAt.toDate === "function"
        ? data.createdAt.toDate()
        : undefined;

    const decision = data.decision as any;

    // decisions/{id} parent is "decisions", parent.parent is the event doc ref
    const eventId = d.ref.parent.parent?.id ?? "unknown_event";

    return {
      eventId,
      decisionId: d.id,
      createdAt,
      part: decision?.part ?? "—",
      score: typeof decision?.score === "number" ? decision.score : 0,
      notes: decision?.notes ?? "",
    };
  });

  return rows;
}
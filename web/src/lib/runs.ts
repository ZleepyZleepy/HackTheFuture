import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export async function saveAgentRun(eventId: string, payload: unknown) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  const runsRef = collection(db, "events", eventId, "runs");

  const docRef = await addDoc(runsRef, {
    uid: user.uid,
    isAnonymous: user.isAnonymous,
    payload,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}
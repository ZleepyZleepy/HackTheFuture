"use client";

import { auth } from "@/lib/firebase";
import { logout } from "@/lib/auth";
import { onAuthStateChanged, User } from "firebase/auth";
import { useEffect, useState } from "react";

export default function UserMenu() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  if (!user) return null;

  const label = user.isAnonymous ? "Guest" : user.email ?? "Google User";

  return (
    <div className="flex items-center gap-3">
      <div className="text-xs text-gray-600">
        Signed in as <span className="font-medium text-gray-900">{label}</span>
      </div>
      <button
        onClick={() => logout()}
        className="rounded-lg border bg-white px-3 py-1.5 text-xs hover:bg-gray-50"
      >
        Sign out
      </button>
    </div>
  );
}
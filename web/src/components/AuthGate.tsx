"use client";

import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setChecking(false);
      if (!u) router.replace("/");
    });
    return () => unsub();
  }, [router]);

  if (checking) {
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm text-sm text-gray-600">
        Checking mk…
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}
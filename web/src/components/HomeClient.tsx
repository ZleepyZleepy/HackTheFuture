"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { logout, signInAsGuest, signInWithGoogle, signInWithEmail, signUpWithEmail} from "@/lib/auth";

export default function HomeClient() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleEmailSignIn() {
  setError(null);
  setBusy(true);
  try {
    await signInWithEmail(email.trim(), password);
  } catch (e: any) {
    setError(e?.message ?? "Email sign-in failed");
  } finally {
    setBusy(false);
  }
}

async function handleEmailSignUp() {
  setError(null);
  setBusy(true);
  try {
    await signUpWithEmail(email.trim(), password);
  } catch (e: any) {
    setError(e?.message ?? "Email sign-up failed");
  } finally {
    setBusy(false);
  }
}

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">AltPart AI</h1>
        <p className="mt-2 text-sm text-gray-600">
          Prevent line-stops by mapping disruptions → BOM risk → approved alternates → actions.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={async () => {
              setError(null);
              setBusy(true);
              try {
              await signInWithGoogle();
              } catch (e: any) {
              const code = e?.code as string | undefined;

              if (code === "auth/popup-closed-by-user") {
                setError("Sign-in cancelled.");
              } else if (code === "auth/popup-blocked") {
                setError("Popup blocked. Allow popups for localhost:3000, then try again.");
              } else {
                setError(e?.message ?? "Google sign-in failed");
              }
              } finally {
              setBusy(false);
              }
              }}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            disabled={loading || busy}
          >
            Continue with Google
          </button>

          <button
            onClick={() => signInAsGuest()}
            className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50"
            disabled={loading || busy}
          >
            Continue as Guest
          </button>
        </div>

        <div className="mt-5 text-sm text-gray-600">
          {loading ? (
            <span>Checking session…</span>
          ) : user ? (
            <div className="space-y-2">
              <div>
                Signed in as{" "}
                <span className="font-medium">
                  {user.isAnonymous ? "Guest" : user.email ?? "Google User"}
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/radar"
                  className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Go to Radar
                </Link>
                <button
                  onClick={() => logout()}
                  className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <span>Not signed in.</span>
          )}
        </div>

        <div className="mt-6 rounded-lg border bg-gray-50 p-4">
          <div className="text-sm font-medium">Email</div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <input
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={handleEmailSignIn}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              disabled={loading || busy}
            >
              Sign in
            </button>
            <button
              onClick={handleEmailSignUp}
              className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50"
              disabled={loading || busy}
            >
              Sign up
            </button>
          </div>

          {error ? <div className="mt-2 text-sm text-red-600">{error}</div> : null}
        </div>

      </div>
    </div>
  );
}
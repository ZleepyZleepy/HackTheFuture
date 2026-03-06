"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  signInAsGuest,
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
} from "@/lib/auth";

function GoogleGIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.216 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.848 1.154 7.969 3.031l5.657-5.657C34.053 6.053 29.281 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.848 1.154 7.969 3.031l5.657-5.657C34.053 6.053 29.281 4 24 4c-7.682 0-14.347 4.337-17.694 10.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.178 0 9.868-1.977 13.409-5.197l-6.19-5.238C29.141 35.091 26.715 36 24 36c-5.196 0-9.625-3.328-11.287-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.084 5.565l.003-.002 6.19 5.238C36.974 39.199 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

export default function HomeClient() {
  const router = useRouter();

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

  async function handleGoogleSignIn() {
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
  }

  async function handleGuestSignIn() {
    setError(null);
    setBusy(true);
    try {
      await signInAsGuest();
      router.push("/kairos");
    } catch (e: any) {
      setError(e?.message ?? "Guest sign-in failed");
      setBusy(false);
    }
  }

  function handleContinue() {
    router.push("/kairos");
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      setBusy(false);
    });

    return () => unsub();
  }, []);

  const disabled = loading || busy;

  return (
    <div className="min-h-[calc(100dvh-5rem)] w-full overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(246,118,92,0.16),_transparent_25%),radial-gradient(circle_at_top_right,_rgba(111,127,242,0.16),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(133,206,104,0.16),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(249,214,92,0.14),_transparent_28%),linear-gradient(135deg,_#f7f7fb_0%,_#f3f5ff_45%,_#f7fbff_100%)]">
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-6xl flex-col justify-center gap-8 px-4 py-6 sm:px-6 lg:px-8 xl:flex-row xl:items-center xl:gap-12">
        <section className="w-full min-w-0 flex-1">
          <div className="flex flex-col justify-center">
            <div className="-mt-6 flex justify-center xl:-mt-10 xl:justify-start">
              <div className="relative aspect-square w-full max-w-[260px] sm:max-w-[320px] lg:max-w-[380px] xl:max-w-[430px]">
                <Image
                  src="/kairos-logo.png"
                  alt="Kairos logo"
                  fill
                  className="object-contain drop-shadow-[0_16px_34px_rgba(99,102,241,0.16)]"
                  priority
                  sizes="(max-width: 640px) 260px, (max-width: 1024px) 320px, (max-width: 1280px) 380px, 430px"
                />
              </div>
            </div>

            <p className="mx-auto mt-3 max-w-2xl text-center text-base leading-7 text-slate-600 sm:text-lg sm:leading-8 xl:mx-0 xl:mt-2 xl:text-left">
              Agriculture supply chain intelligence for disruption monitoring, operational planning,
              and smarter financial decisions.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:-ml-4 xl:mt-4 xl:grid-cols-3">
              <div className="min-w-0 rounded-2xl border border-white/70 bg-white/60 p-4 shadow-sm backdrop-blur-sm">
                <div className="text-sm font-semibold text-slate-900">Signal monitoring</div>
                <div className="mt-1 text-sm text-slate-600">
                  Track weather, geopolitics, logistics, and insider signals in one place.
                </div>
              </div>

              <div className="min-w-0 rounded-2xl border border-white/70 bg-white/60 p-4 shadow-sm backdrop-blur-sm">
                <div className="text-sm font-semibold text-slate-900">Profitability focus</div>
                <div className="mt-1 text-sm text-slate-600">
                  Surface savings opportunities, avoided loss, and added value.
                </div>
              </div>

              <div className="min-w-0 rounded-2xl border border-white/70 bg-white/60 p-4 shadow-sm backdrop-blur-sm sm:col-span-2 xl:col-span-1">
                <div className="text-sm font-semibold text-slate-900">Action-ready plans</div>
                <div className="mt-1 text-sm text-slate-600">
                  Turn signals into strategies, forecasts, and clear next steps.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full min-w-0 xl:max-w-[440px] xl:flex-none">
          <div className="mx-auto w-full max-w-[440px] rounded-3xl border border-white/70 bg-white/72 p-5 shadow-[0_16px_50px_rgba(99,102,241,0.12)] backdrop-blur-md sm:p-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Log in to Kairos
              </h2>
              <p className="mt-2 text-sm text-slate-500 sm:text-base">
                Welcome back. Enter your details to access your dashboard.
              </p>
            </div>

            <div className="mt-8 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">Email</label>
                <input
                  className="w-full rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <label className="block text-sm font-semibold text-slate-900">Password</label>
                  <button
                    type="button"
                    className="text-sm text-indigo-600 hover:text-indigo-700"
                    onClick={() => setError("Forgot password flow not implemented yet.")}
                  >
                    Forgot password
                  </button>
                </div>

                <input
                  className="w-full rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
                  placeholder="Enter your password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <label className="flex items-center gap-2 text-slate-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span>Remember for 30 days</span>
                </label>

                {loading ? <span className="text-slate-400">Checking session...</span> : null}
              </div>

              <button
                onClick={handleEmailSignIn}
                disabled={disabled}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Signing in..." : "Sign in"}
              </button>

              <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="shrink-0">or</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <button
                onClick={handleGoogleSignIn}
                disabled={disabled}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200/90 bg-white/85 px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <GoogleGIcon />
                <span className="truncate">Continue with Google</span>
              </button>

              <button
                onClick={handleGuestSignIn}
                disabled={disabled}
                className="w-full rounded-xl bg-gradient-to-r from-violet-600 via-indigo-500 to-sky-500 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Continue as Guest
              </button>

              <button
                onClick={handleEmailSignUp}
                disabled={disabled}
                className="w-full rounded-xl border border-slate-200/90 bg-white/85 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Create account
              </button>

              {error ? (
                <div className="break-words rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              {user ? (
                <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
                  <div className="space-y-3">
                    <div className="break-words text-sm text-slate-600">
                      Signed in as{" "}
                      <span className="font-semibold text-slate-900">
                        {user.isAnonymous ? "Guest" : user.email ?? "Google User"}
                      </span>
                    </div>

                    <button
                      onClick={handleContinue}
                      className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:opacity-90"
                    >
                      Continue to dashboard
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { pb } from "@/lib/pocketbase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleEmailLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await pb.collection("users").authWithPassword(email, password);
      router.push("/chat");
    } catch (err) {
      setError("Login failed. Check your PocketBase auth user or create a new account.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");

    try {
      await pb.collection("users").authWithOAuth2({ provider: "google" });
      router.push("/chat");
    } catch (err) {
      setError("Google sign-in could not start. Enable Google Auth in PocketBase.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-50">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-indigo-500/10">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.3em] text-indigo-400">TalkVibe</p>
          <h1 className="mt-3 text-3xl font-semibold">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-400">Sign in with your PocketBase account to continue.</p>
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2.5 outline-none ring-0 placeholder:text-slate-500"
              placeholder="you@example.com"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2.5 outline-none placeholder:text-slate-500"
              placeholder="••••••••"
            />
          </label>

          {error ? <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-700" />
          <span className="text-xs uppercase tracking-[0.25em] text-slate-500">or</span>
          <div className="h-px flex-1 bg-slate-700" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-medium text-slate-100 transition hover:border-indigo-500/50 hover:bg-slate-800/90"
        >
          Continue with Google
        </button>

        <p className="mt-5 text-center text-sm text-slate-400">
          New to TalkVibe? <Link href="/register" className="text-indigo-400 underline">Create an account</Link>
        </p>
      </div>
    </main>
  );
}

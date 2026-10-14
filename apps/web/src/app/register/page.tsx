"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientResponseError } from "pocketbase";
import { pb } from "@/lib/pocketbase";

const idAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function createTalkVibeId() {
  const randomBytes = crypto.getRandomValues(new Uint8Array(6));
  const suffix = Array.from(randomBytes, (byte) => idAlphabet[byte % idAlphabet.length]).join("");
  return `TV-${suffix}`;
}

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const trimmedName = displayName.trim();
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setError("Display name bharna zaroori hai.");
      return;
    }
    if (!/^[a-z0-9_]{3,32}$/.test(normalizedUsername)) {
      setError("Username 3–32 characters ka ho: sirf letters, numbers aur underscore.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Valid email address enter karein.");
      return;
    }
    if (password.length < 8) {
      setError("Password kam se kam 8 characters ka hona chahiye.");
      return;
    }

    setLoading(true);
    let createdAccount = false;

    try {
      const usernameCheck = await pb.collection("profiles").getFullList({
        filter: `username = "${normalizedUsername}"`,
        requestKey: null,
      });
      if (usernameCheck.length > 0) {
        setError("Yeh username already use ho chuka hai. Alag username choose karein.");
        return;
      }

      const account = await pb.collection("users").create({
        email: normalizedEmail,
        name: trimmedName,
        password,
        passwordConfirm: password,
      });
      createdAccount = true;

      await pb.collection("users").authWithPassword(normalizedEmail, password);
      await pb.collection("profiles").create({
        user: account.id,
        display_name: trimmedName,
        username: normalizedUsername,
        talkvibe_id: createTalkVibeId(),
        status: "offline",
      });

      router.replace("/chat");
    } catch (cause) {
      const status =
        typeof cause === "object" && cause !== null && "status" in cause && typeof cause.status === "number"
          ? cause.status
          : undefined;
      const fieldErrors =
        cause instanceof ClientResponseError &&
        typeof cause.response.data === "object" &&
        cause.response.data !== null
          ? (cause.response.data as Record<string, { message?: string; code?: string }>)
          : {};
      const emailError = fieldErrors.email;
      const usernameError = fieldErrors.username;
      const emailIsUnique =
        emailError?.code === "validation_not_unique" ||
        emailError?.message?.toLowerCase().includes("unique");
      if (status === 400 && emailIsUnique) {
        setError("Yeh email pehle se registered hai. Sign in karein ya alag email use karein.");
        return;
      }

      if (!(cause instanceof ClientResponseError && cause.status === 400)) {
        console.error(cause);
      }
      const fallback =
        status === 0
          ? "TalkVibe server se connection nahi ho pa raha. PocketBase server start karke dobara try karein."
          : createdAccount
          ? "Account ban gaya, lekin profile setup poora nahi hua. Admin dashboard par profiles collection check karke dobara sign in karein."
          : "Account create nahi ho paya. Email aur details check karke phir try karein.";
      setError(emailError?.message || usernameError?.message || fallback);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-slate-50">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-indigo-500/10">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.3em] text-indigo-400">TalkVibe</p>
          <h1 className="mt-3 text-3xl font-semibold">Create your account</h1>
          <p className="mt-2 text-sm text-slate-400">Aapka unique TalkVibe ID signup ke waqt banega.</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Display name</span>
            <input
              required
              maxLength={80}
              autoComplete="name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2.5 outline-none placeholder:text-slate-500"
              placeholder="Your name"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Username</span>
            <input
              required
              minLength={3}
              maxLength={32}
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2.5 outline-none placeholder:text-slate-500"
              placeholder="e.g. aisha_m"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Email</span>
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2.5 outline-none placeholder:text-slate-500"
              placeholder="you@example.com"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Password</span>
            <input
              required
              minLength={8}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2.5 outline-none placeholder:text-slate-500"
              placeholder="At least 8 characters"
            />
          </label>

          {error ? (
            <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-400">
          Already have an account? <Link href="/login" className="text-indigo-400 underline">Sign in</Link>
        </p>
      </div>
    </main>
  );
}

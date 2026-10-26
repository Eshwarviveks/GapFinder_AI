
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    if (isSignup) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      if (data.session) {
        window.location.href = "/";
        return;
      }

      setMessage(
        "Account created. Check your email if confirmation is required."
      );
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    window.location.href = "/";
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="flex min-h-screen items-center justify-center px-6 py-12">

        <div className="w-full max-w-md">

          {/* Brand */}
          <div className="mb-10 text-center">
            <button
              onClick={() => {
                window.location.href = "/";
              }}
              className="mx-auto flex items-center gap-3"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold">
                G
              </div>

              <span className="text-xl font-bold tracking-tight">
                GapFinder AI
              </span>
            </button>

            <p className="mt-3 text-sm text-slate-500">
              Find what you don&apos;t know.
            </p>
          </div>

          {/* Login card */}
          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm md:p-8">

            <div className="mb-7">
              <h1 className="text-2xl font-bold tracking-tight">
                {isSignup ? "Create your account" : "Welcome back"}
              </h1>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                {isSignup
                  ? "Create an account to start your learning diagnosis."
                  : "Log in to continue to your learning dashboard."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Email
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Password
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                {loading
                  ? "Please wait..."
                  : isSignup
                    ? "Create account"
                    : "Log in"}
              </button>
            </form>

            {message && (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                {message}
              </div>
            )}

            <div className="mt-7 border-t border-slate-100 pt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignup(!isSignup);
                  setMessage("");
                }}
                className="text-sm font-medium text-slate-600 underline underline-offset-4 hover:text-black"
              >
                {isSignup
                  ? "Already have an account? Log in"
                  : "Don't have an account? Create one"}
              </button>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            Your account keeps your learning materials private.
          </p>

        </div>
      </div>
    </main>
  );
}

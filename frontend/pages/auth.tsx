/**
 * Authentication page styled to mirror the provided reference.
 * Provides email/password sign-in and sign-up backed by Supabase.
 */
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { Eye, EyeSlash, LockSimple, PaperPlaneTilt, SignIn } from "phosphor-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ensureSupabaseClient } from "../lib/supabaseClient";

type Mode = "signin" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    const supabase = ensureSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/dashboard");
      }
    });
  }, [router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const supabase = ensureSupabaseClient();
      if (mode === "signup") {
        const { error: signUpError, data } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setInfo("Check your email to confirm your account, then sign in.");
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Unable to authenticate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>ShortPulse · {mode === "signin" ? "Sign in" : "Sign up"}</title>
      </Head>
      <main className="auth-shell">
        <div className="auth-overlay" />
        <form className="auth-card" onSubmit={onSubmit}>
          <h1 className="auth-title">ShortPulse</h1>
          <p className="auth-subtitle">Reel Performance Analytics</p>

          <label className="auth-label" htmlFor="email">
            Email
          </label>
          <div className="auth-input">
            <PaperPlaneTilt size={18} weight="bold" />
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <label className="auth-label" htmlFor="password">
            Password
          </label>
          <div className="auth-input">
            <LockSimple size={18} weight="bold" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="auth-eye"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeSlash size={18} weight="bold" /> : <Eye size={18} weight="bold" />}
            </button>
          </div>

          {error ? <div className="auth-error">{error}</div> : null}
          {info ? <div className="auth-info">{info}</div> : null}

          <button className="auth-submit" type="submit" disabled={loading}>
            <SignIn size={18} weight="bold" />
            {loading ? "Loading..." : mode === "signin" ? "Sign In" : "Sign Up"}
          </button>

          <div className="auth-divider" />
          <p className="auth-switch">
            {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </form>

      </main>
    </>
  );
}

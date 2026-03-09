"use client";

import { useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type AuthMode = "signup" | "signin";

function getFriendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials")) return "Wrong email or password.";
  if (m.includes("already registered") || m.includes("already exists")) return "That email is already registered — try signing in.";
  if (m.includes("password") && (m.includes("weak") || m.includes("short") || m.includes("least"))) return "Password must be at least 6 characters.";
  if (m.includes("email not confirmed")) return "Check your inbox to verify your email first.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts — wait a moment.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Connection issue — check your internet.";
  return msg;
}

export default function AuthCard({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<AuthMode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!configured) { setError("Auth not configured — set Supabase env vars."); return; }
    setLoading(true); setError(null);
    const supabase = createClient();
    try {
      if (mode === "signup") {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?source=landing` },
        });
        if (signUpErr) { setError(getFriendlyError(signUpErr.message)); return; }
        if (data.user?.identities?.length === 0) { setError("That email is already registered — try signing in."); return; }
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) { setError("Check your email to verify your account, then come back!"); return; }
        onSuccess();
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) { setError(getFriendlyError(signInErr.message)); return; }
        onSuccess();
      }
    } finally { setLoading(false); }
  }

  async function handleOAuth(provider: "google" | "github") {
    if (!configured) { setError("Auth not configured."); return; }
    setOauthLoading(provider); setError(null);
    const supabase = createClient();
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?source=landing` },
    });
    if (oauthErr) { setError(getFriendlyError(oauthErr.message)); setOauthLoading(null); }
  }

  return (
    <div className="border border-[rgba(58,58,56,0.2)] bg-white p-5">
      <div className="space-y-2 mb-4">
        <button onClick={() => handleOAuth("google")} disabled={!!oauthLoading || loading}
          className="w-full flex items-center gap-3 px-4 py-2.5 border border-[rgba(58,58,56,0.15)] bg-white hover:bg-paper transition-colors disabled:opacity-50">
          <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2045c0-.638-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9086c1.7018-1.5668 2.6836-3.874 2.6836-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.4673-.8059 5.9564-2.1805l-2.9086-2.2581c-.8059.54-1.8368.8591-3.0477.8591-2.3441 0-4.3282-1.5832-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1022-1.17.2822-1.71V4.9582H.9573A8.9961 8.9961 0 0 0 0 9c0 1.4523.3477 2.8268.9573 4.0418L3.964 10.71z" fill="#FBBC05"/>
            <path d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5813C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.6559 3.5795 9 3.5795z" fill="#EA4335"/>
          </svg>
          <span className="font-mono text-[11px] text-forest">{oauthLoading === "google" ? "Redirecting..." : "Continue with Google"}</span>
        </button>
        <button onClick={() => handleOAuth("github")} disabled={!!oauthLoading || loading}
          className="w-full flex items-center gap-3 px-4 py-2.5 border border-[rgba(58,58,56,0.15)] bg-white hover:bg-paper transition-colors disabled:opacity-50">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" className="text-forest">
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
          </svg>
          <span className="font-mono text-[11px] text-forest">{oauthLoading === "github" ? "Redirecting..." : "Continue with GitHub"}</span>
        </button>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-[rgba(58,58,56,0.12)]" />
        <span className="font-mono text-[10px] text-grid/40 uppercase tracking-wide">or</span>
        <div className="flex-1 h-px bg-[rgba(58,58,56,0.12)]" />
      </div>
      <form onSubmit={handleEmail} className="space-y-3">
        <input type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading || !!oauthLoading}
          className="w-full px-3 py-2 border border-[rgba(58,58,56,0.15)] bg-paper font-mono text-[11px] text-forest placeholder:text-grid/35 focus:outline-none focus:border-forest transition-colors disabled:opacity-50" />
        <input type="password" placeholder="password (min 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} disabled={loading || !!oauthLoading}
          className="w-full px-3 py-2 border border-[rgba(58,58,56,0.15)] bg-paper font-mono text-[11px] text-forest placeholder:text-grid/35 focus:outline-none focus:border-forest transition-colors disabled:opacity-50" />
        {error && <p className="font-mono text-[10px] text-coral">{error}</p>}
        <button type="submit" disabled={loading || !!oauthLoading}
          className="w-full px-4 py-2.5 bg-forest text-white font-mono text-[11px] uppercase tracking-wide hover:bg-forest/90 transition-colors disabled:opacity-50">
          {loading ? "Working..." : mode === "signup" ? "Create Account" : "Sign In"}
        </button>
      </form>
      <button type="button" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(null); }}
        className="mt-3 font-mono text-[9px] text-grid/40 hover:text-forest uppercase tracking-wide transition-colors block w-full text-center">
        {mode === "signup" ? "Already have an account? Sign in →" : "← Back to sign up"}
      </button>
    </div>
  );
}

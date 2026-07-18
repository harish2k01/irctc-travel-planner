"use client";

import { Lock, Mail, TrainFront, UserRound } from "lucide-react";
import { useState } from "react";

type AuthMode = "firstSignup" | "login" | "resetPassword" | "tokenPassword" | "missingDatabase";

function errorMessage(payload: unknown) {
  const value = payload as { error?: string | { message?: string }; data?: { message?: string } };
  return typeof value.error === "string" ? value.error : value.error?.message ?? "The request could not be completed.";
}

export function AuthScreen({ mode, allowSignups, token, tokenType }: { mode: AuthMode; allowSignups: boolean; token?: string; tokenType?: "invitation" | "reset" }) {
  const [view, setView] = useState<"login" | "signup" | "reset" | "forgot">(
    mode === "firstSignup" ? "signup" : mode === "resetPassword" || mode === "tokenPassword" ? "reset" : "login",
  );
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(endpoint: string, payload: Record<string, unknown>) {
    setBusy(true);
    setMessage(undefined);
    setError(undefined);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorMessage(data));
      window.location.assign("/");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The request could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  async function submitForgot(formData: FormData) {
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(formData)) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorMessage(payload));
      setMessage(payload.data?.message ?? "If that account exists, a reset link has been sent.");
      setView("login");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The request could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "missingDatabase") {
    return <AuthShell><div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">The database is not configured. Contact the administrator.</div></AuthShell>;
  }

  return (
    <AuthShell>
      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {message && <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}

      {view === "login" && (
        <form action={(form) => submit("/api/auth/login", Object.fromEntries(form))} className="grid gap-3">
          <Field icon={Mail} name="email" type="email" label="Email" autoComplete="email" />
          <Field icon={Lock} name="password" type="password" label="Password" autoComplete="current-password" />
          <Primary busy={busy}>Sign in</Primary>
          <div className="flex items-center justify-between text-sm">
            <button type="button" onClick={() => setView("forgot")} className="font-medium text-blue-700 hover:text-blue-900">Forgot password?</button>
            {allowSignups && <button type="button" onClick={() => setView("signup")} className="font-medium text-blue-700 hover:text-blue-900">Create account</button>}
          </div>
        </form>
      )}

      {view === "forgot" && (
        <form action={submitForgot} className="grid gap-3">
          <p className="text-sm text-slate-600">Enter your email to receive a one-time reset link.</p>
          <Field icon={Mail} name="email" type="email" label="Email" autoComplete="email" />
          <Primary busy={busy}>Send reset link</Primary>
          <button type="button" onClick={() => setView("login")} className="text-sm font-medium text-blue-700">Back to sign in</button>
        </form>
      )}

      {view === "signup" && (
        <form action={(form) => submit("/api/auth/signup", Object.fromEntries(form))} className="grid gap-3">
          <Field icon={UserRound} name="name" label="Name" autoComplete="name" />
          <Field icon={Mail} name="email" type="email" label="Email" autoComplete="email" />
          <Field icon={Lock} name="password" type="password" label="Password" autoComplete="new-password" />
          <p className="text-xs leading-5 text-slate-500">Use at least 12 characters with uppercase, lowercase, number, and symbol.</p>
          <Primary busy={busy}>{mode === "firstSignup" ? "Create administrator" : "Create account"}</Primary>
          {mode !== "firstSignup" && <button type="button" onClick={() => setView("login")} className="text-sm font-medium text-blue-700">Back to sign in</button>}
        </form>
      )}

      {view === "reset" && (
        <form action={(form) => submit("/api/auth/reset-password", { ...Object.fromEntries(form), token, type: tokenType })} className="grid gap-3">
          {!token && mode === "tokenPassword" && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">This password link is incomplete.</div>}
          <Field icon={Lock} name="password" type="password" label="New password" autoComplete="new-password" />
          <p className="text-xs leading-5 text-slate-500">Use at least 12 characters with uppercase, lowercase, number, and symbol.</p>
          <Primary busy={busy} disabled={mode === "tokenPassword" && !token}>Set password</Primary>
        </form>
      )}
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-8">
      <section className="w-full max-w-sm rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-md bg-slate-950 text-white"><TrainFront className="h-5 w-5" /></div><div><h1 className="text-lg font-semibold">IRCTC Travel Planner</h1><p className="text-sm text-slate-500">Ticket tracker</p></div></div>
        <div className="grid gap-3">{children}</div>
        <p className="mt-5 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">Independent ticket planning tool. Not affiliated with or endorsed by IRCTC or Indian Railways.</p>
      </section>
    </main>
  );
}

function Field({ icon: Icon, label, ...input }: { icon: React.ComponentType<{ className?: string }>; label: string; name: string; type?: string; autoComplete?: string }) {
  return <label className="grid gap-1.5 text-sm font-medium text-slate-700">{label}<span className="flex h-10 items-center gap-2 rounded-md border border-slate-300 px-3 focus-within:border-slate-500 focus-within:ring-2 focus-within:ring-slate-200"><Icon className="h-4 w-4 text-slate-400" /><input required {...input} className="min-w-0 flex-1 bg-transparent outline-none" /></span></label>;
}

function Primary({ busy, disabled, children }: { busy: boolean; disabled?: boolean; children: React.ReactNode }) {
  return <button disabled={busy || disabled} className="mt-1 h-10 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">{busy ? "Please wait..." : children}</button>;
}

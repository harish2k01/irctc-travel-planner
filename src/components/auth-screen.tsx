"use client";

import { Lock, Mail, Save, UserPlus } from "lucide-react";
import { useState } from "react";

type AuthMode = "firstSignup" | "login" | "resetPassword" | "missingDatabase";

export function AuthScreen({ mode, allowSignups }: { mode: AuthMode; allowSignups: boolean }) {
  const [view, setView] = useState<"login" | "signup" | "reset">(
    mode === "firstSignup" ? "signup" : mode === "resetPassword" ? "reset" : "login",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(endpoint: string, formData: FormData) {
    setBusy(true);
    setMessage(null);

    const payload = Object.fromEntries(formData.entries());
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
      setMessage(data.error ?? "Request failed.");
      return;
    }

    window.location.reload();
  }

  if (mode === "missingDatabase") {
    return (
      <AuthShell title="IRCTC Travel Planner">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
          DATABASE_URL is required before authentication can be used.
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="IRCTC Travel Planner">
      {message && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
          {message}
        </div>
      )}

      {view === "login" && (
        <form action={(formData) => submit("/api/auth/login", formData)} className="grid gap-4">
          <AuthInput icon={Mail} name="email" type="email" label="Email" />
          <AuthInput icon={Lock} name="password" type="password" label="Password" />
          <button disabled={busy} className="inline-flex h-11 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white">
            Sign in
          </button>
          {allowSignups && (
            <button type="button" onClick={() => setView("signup")} className="text-sm font-semibold text-slate-700">
              Create an account
            </button>
          )}
        </form>
      )}

      {view === "signup" && (
        <form action={(formData) => submit("/api/auth/signup", formData)} className="grid gap-4">
          <AuthInput icon={UserPlus} name="name" label="Name" />
          <AuthInput icon={Mail} name="email" type="email" label="Email" />
          <AuthInput icon={Lock} name="password" type="password" label="Password" />
          <button disabled={busy} className="inline-flex h-11 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white">
            {mode === "firstSignup" ? "Create first admin" : "Sign up"}
          </button>
          {mode !== "firstSignup" && (
            <button type="button" onClick={() => setView("login")} className="text-sm font-semibold text-slate-700">
              Back to sign in
            </button>
          )}
        </form>
      )}

      {view === "reset" && (
        <form action={(formData) => submit("/api/auth/reset-password", formData)} className="grid gap-4">
          <AuthInput icon={Lock} name="password" type="password" label="New password" />
          <button disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white">
            <Save className="h-4 w-4" aria-hidden />
            Set new password
          </button>
        </form>
      )}
    </AuthShell>
  );
}

function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f8f5] px-4 py-8 text-slate-950">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
        <div className="mt-6 grid gap-4">{children}</div>
      </section>
    </main>
  );
}

function AuthInput({
  icon: Icon,
  name,
  label,
  type = "text",
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  name: string;
  label: string;
  type?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      {label}
      <span className="flex h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-slate-950">
        <Icon className="h-4 w-4 text-slate-500" aria-hidden />
        <input required name={name} type={type} className="min-w-0 flex-1 bg-transparent outline-none" />
      </span>
    </label>
  );
}

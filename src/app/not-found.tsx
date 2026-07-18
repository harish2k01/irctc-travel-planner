import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-4">
      <section className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase text-slate-500">404</p>
        <h1 className="mt-2 text-xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-slate-600">The requested IRCTC Travel Planner page does not exist.</p>
        <Link href="/" className="mt-5 inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Return to the app
        </Link>
      </section>
    </main>
  );
}

import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, BarChart3 } from "lucide-react";
import { DashboardClient } from "./components/DashboardClient";

export const dynamic = "force-dynamic"; // siempre re-renderiza con search params

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
          >
            <ChevronLeft className="h-4 w-4" /> Inicio
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-900">
            <BarChart3 className="h-6 w-6 text-brand-600" />
            Dashboard de Revenue
          </h1>
          <p className="text-sm text-slate-500">
            Bora Bora · Métricas de pickup, ocupación y mix de canales.
          </p>
        </div>
      </header>

      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="skeleton h-20 w-full" />
            <div className="skeleton h-32 w-full" />
            <div className="skeleton h-80 w-full" />
          </div>
        }
      >
        <DashboardClient />
      </Suspense>
    </main>
  );
}

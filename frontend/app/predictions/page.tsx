"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ChevronLeft, Sparkles, Filter, Loader2 } from "lucide-react";

import { swrFetcher } from "@/lib/api";
import type { Prediction } from "@/lib/types";
import { formatCOP, formatInt, formatPct } from "@/lib/format";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const ANIOS = [2024, 2025, 2026, 2027, 2028];
const ESCENARIO_COLORS: Record<string, string> = {
  OPTIMIST: "bg-emerald-500",
  BASE: "bg-brand-500",
  PESSIMIST: "bg-rose-500",
};
const ESCENARIO_LABELS: Record<string, string> = {
  OPTIMIST: "Optimista",
  BASE: "Base",
  PESSIMIST: "Pesimista",
};

export default function PredictionsPage() {
  const [year, setYear] = useState<number>(2026);
  const [activeScenarios, setActiveScenarios] = useState<Set<string>>(new Set(["OPTIMIST", "BASE", "PESSIMIST"]));

  const scenariosStr = Array.from(activeScenarios).join(",");
  const qs = `?year=${year}${scenariosStr ? `&scenarios=${scenariosStr}` : ""}`;
  const { data: rows = [], isLoading } = useSWR<Prediction[]>(
    `${API_BASE}/api/predictions${qs}`,
    swrFetcher<Prediction[]>,
    { revalidateOnFocus: false }
  );

  const toggleScenario = (s: string) => {
    const next = new Set(activeScenarios);
    if (next.has(s)) next.delete(s); else next.add(s);
    setActiveScenarios(next);
  };

  // Totales por escenario
  const totals = (() => {
    const t: Record<string, { rn: number; rev: number; occ: number; count: number }> = {};
    for (const r of rows) {
      if (!t[r.scenario]) t[r.scenario] = { rn: 0, rev: 0, occ: 0, count: 0 };
      t[r.scenario].rn += r.rn;
      t[r.scenario].rev += r.rev;
      t[r.scenario].occ += r.occ_pct;
      t[r.scenario].count += 1;
    }
    return t;
  })();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ChevronLeft className="h-4 w-4" /> Inicio
      </Link>
      <div className="mt-1 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Predicciones — Proyecciones anuales</h1>
          <p className="text-sm text-slate-500">
            Generadas algorítmicamente desde pickup_weekly + channel_sales_month. <strong>No se cargan del Excel</strong>.
          </p>
        </div>
        <Sparkles className="h-7 w-7 text-brand-600" />
      </div>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Filter className="h-4 w-4" /> Filtros
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Año objetivo">
            <select value={year} onChange={(e) => setYear(+e.target.value)} className="input">
              {ANIOS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Field>
          <Field label="Escenarios a mostrar">
            <div className="flex flex-wrap gap-2">
              {(["OPTIMIST", "BASE", "PESSIMIST"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleScenario(s)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    activeScenarios.has(s)
                      ? "border-transparent text-white " + ESCENARIO_COLORS[s]
                      : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${activeScenarios.has(s) ? "bg-white" : ESCENARIO_COLORS[s]}`} />
                  {ESCENARIO_LABELS[s]}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </section>

      {/* Totales por escenario */}
      {Object.keys(totals).length > 0 && (
        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          {(["OPTIMIST", "BASE", "PESSIMIST"] as const).map((s) => totals[s] ? (
            <div key={s} className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${ESCENARIO_COLORS[s]}`} />
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{ESCENARIO_LABELS[s]}</p>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{formatCOP(totals[s].rev)}</p>
              <p className="mt-1 text-xs text-slate-500">
                {formatInt(totals[s].rn)} RN · {formatPct(totals[s].occ / totals[s].count, 1)} OCC promedio
              </p>
            </div>
          ) : null)}
        </section>
      )}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-900">Predicciones mensuales ({rows.length})</h2>
          <p className="text-xs text-slate-500">Derivadas del último reporte de pickup y la tendencia histórica de los 2 años previos</p>
        </div>
        <div className="max-h-[600px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2">Mes</th>
                <th className="px-4 py-2">Escenario</th>
                <th className="px-4 py-2 text-right">OCC %</th>
                <th className="px-4 py-2 text-right">ADR</th>
                <th className="px-4 py-2 text-right">RN</th>
                <th className="px-4 py-2 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td></tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Activa al menos un escenario.
                </td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={`${r.mes}-${r.scenario}-${i}`} className="hover:bg-slate-50">
                  <td className="px-4 py-1.5 font-medium text-slate-800">{r.mes}</td>
                  <td className="px-4 py-1.5">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white ${ESCENARIO_COLORS[r.scenario]}`}>
                      {ESCENARIO_LABELS[r.scenario]}
                    </span>
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{formatPct(r.occ_pct, 1)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{formatCOP(r.adr)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{formatInt(r.rn)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums font-medium">{formatCOP(r.rev)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <style jsx>{`
        :global(.input) {
          @apply w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500;
        }
      `}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-700">{label}</span>
      {children}
    </label>
  );
}

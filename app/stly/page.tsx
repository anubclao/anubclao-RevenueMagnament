"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ChevronLeft, History, Filter, Loader2 } from "lucide-react";

import { fetchStly, swrFetcher } from "@/lib/api";
import type { Channel, StlySale } from "@/lib/types";
import { formatCOP, formatInt } from "@/lib/format";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const MESES = [
  "Enero 2024", "Febrero 2024", "Marzo 2024", "Abril 2024", "Mayo 2024", "Junio 2024",
  "Julio 2024", "Agosto 2024", "Septiembre 2024", "Octubre 2024", "Noviembre 2024", "Diciembre 2024",
  "Enero 2025", "Febrero 2025", "Marzo 2025", "Abril 2025", "Mayo 2025", "Junio 2025",
  "Julio 2025", "Agosto 2025", "Septiembre 2025", "Octubre 2025", "Noviembre 2025", "Diciembre 2025",
  "Enero 2026", "Febrero 2026", "Marzo 2026", "Abril 2026", "Mayo 2026", "Junio 2026",
  "Julio 2026", "Agosto 2026", "Septiembre 2026", "Octubre 2026", "Noviembre 2026", "Diciembre 2026",
];
const ANIOS = [2024, 2025, 2026];

export default function StlyPage() {
  const [year, setYear] = useState<number>(2026);
  const [mes, setMes] = useState<string>("");
  const [channelId, setChannelId] = useState<number | null>(null);

  const qs = `?year=${year}&limit=2000${mes ? `&mes=${encodeURIComponent(mes)}` : ""}${channelId ? `&channel_id=${channelId}` : ""}`;
  const { data: rows = [], isLoading } = useSWR<StlySale[]>(
    `${API_BASE}/api/stly${qs}`,
    swrFetcher<StlySale[]>,
    { revalidateOnFocus: false }
  );
  const { data: channels = [] } = useSWR<Channel[]>(`${API_BASE}/api/channels`, swrFetcher<Channel[]>, { revalidateOnFocus: false });

  // KPIs agregados
  const stats = (() => {
    if (!rows.length) return null;
    const totalRn = rows.reduce((acc, r) => acc + (r.rn || 0), 0);
    const totalRev = rows.reduce((acc, r) => acc + Number(r.rev || 0), 0);
    const aniosMeses = new Set(rows.map((r) => `${r.anio_mes}-${r.mes}`));
    return {
      totalRn,
      totalRev,
      avgAdr: totalRn > 0 ? Number(rows.reduce((a, r) => a + Number(r.adr || 0), 0)) / rows.length : 0,
      periodos: aniosMeses.size,
      weeks: new Set(rows.map((r) => r.fecha_semana)).size,
    };
  })();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ChevronLeft className="h-4 w-4" /> Inicio
      </Link>
      <div className="mt-1 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">STLY — Ventas históricas por canal</h1>
          <p className="text-sm text-slate-500">
            {rows.length} registros · {year}{mes ? ` · ${mes}` : ""}{channelId ? ` · canal #${channelId}` : ""}
          </p>
        </div>
        <History className="h-7 w-7 text-brand-600" />
      </div>

      {stats && (
        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total RN" value={formatInt(stats.totalRn)} />
          <Stat label="Total Revenue" value={formatCOP(stats.totalRev)} />
          <Stat label="ADR promedio" value={formatCOP(stats.avgAdr)} />
          <Stat label="Períodos" value={`${stats.periodos} meses / ${stats.weeks} semanas`} />
        </section>
      )}

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Filter className="h-4 w-4" /> Filtros
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Año">
            <select value={year} onChange={(e) => setYear(+e.target.value)} className="input">
              {ANIOS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Field>
          <Field label="Mes">
            <select value={mes} onChange={(e) => setMes(e.target.value)} className="input">
              <option value="">— Todos —</option>
              {MESES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Canal">
            <select
              value={channelId ?? ""}
              onChange={(e) => setChannelId(e.target.value ? +e.target.value : null)}
              className="input"
            >
              <option value="">— Todos —</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>{c.display_name}</option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-900">Datos cargados</h2>
          <p className="text-xs text-slate-500">Mostrando los primeros {Math.min(rows.length, 2000)} registros</p>
        </div>
        <div className="max-h-[600px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2">Sem #</th>
                <th className="px-4 py-2">Fecha semana</th>
                <th className="px-4 py-2">Mes objetivo</th>
                <th className="px-4 py-2">Año</th>
                <th className="px-4 py-2">Canal</th>
                <th className="px-4 py-2 text-right">RN</th>
                <th className="px-4 py-2 text-right">ADR</th>
                <th className="px-4 py-2 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td></tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  Sin registros para los filtros actuales.
                </td></tr>
              )}
              {rows.slice(0, 2000).map((r) => {
                const ch = channels.find((c) => c.id === r.channel_id);
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-1.5 text-slate-600 tabular-nums">{r.semana_num}</td>
                    <td className="px-4 py-1.5 text-slate-600">{r.fecha_semana}</td>
                    <td className="px-4 py-1.5 font-medium text-slate-800">{r.mes}</td>
                    <td className="px-4 py-1.5 text-slate-600">{r.anio_mes}</td>
                    <td className="px-4 py-1.5 text-slate-600">{ch?.display_name ?? `Canal #${r.channel_id ?? "—"}`}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">{formatInt(r.rn)}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">{formatCOP(r.adr)}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums font-medium">{formatCOP(r.rev)}</td>
                  </tr>
                );
              })}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900 tabular-nums">{value}</p>
    </div>
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

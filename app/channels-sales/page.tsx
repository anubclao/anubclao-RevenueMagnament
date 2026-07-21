"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ChevronLeft, ShoppingBag, Filter, Loader2 } from "lucide-react";

import { swrFetcher } from "@/lib/api";
import type { Channel, ChannelSale } from "@/lib/types";
import { formatCOP, formatInt } from "@/lib/format";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const ANIOS = [2023, 2024, 2025, 2026];
const CATEGORIAS_COLORS: Record<string, string> = {
  DIRECT: "bg-emerald-100 text-emerald-800",
  OTA: "bg-amber-100 text-amber-800",
  WHOLESALER: "bg-violet-100 text-violet-800",
  CORPORATE: "bg-sky-100 text-sky-800",
  OTHER: "bg-slate-100 text-slate-600",
};

export default function ChannelSalesPage() {
  const [year, setYear] = useState<number>(2026);
  const [mes, setMes] = useState<string>("");
  const [channelId, setChannelId] = useState<number | null>(null);

  const qs = `?year=${year}&limit=2000${mes ? `&mes=${encodeURIComponent(mes)}` : ""}${channelId ? `&channel_id=${channelId}` : ""}`;
  const { data: rows = [], isLoading } = useSWR<ChannelSale[]>(
    `${API_BASE}/api/channel-sales${qs}`,
    swrFetcher<ChannelSale[]>,
    { revalidateOnFocus: false }
  );
  const { data: channels = [] } = useSWR<Channel[]>(`${API_BASE}/api/channels`, swrFetcher<Channel[]>, { revalidateOnFocus: false });

  // Totales
  const stats = (() => {
    if (!rows.length) return null;
    const totalRn = rows.reduce((acc, r) => acc + (r.rn_total || 0), 0);
    const totalRev = rows.reduce((acc, r) => acc + Number(r.revenue_total || 0), 0);
    const adrValues = rows.filter((r) => r.adr_promedio != null).map((r) => Number(r.adr_promedio));
    return {
      totalRn,
      totalRev,
      avgAdr: adrValues.length ? adrValues.reduce((a, b) => a + b, 0) / adrValues.length : 0,
      canalesCount: new Set(rows.map((r) => r.channel_id)).size,
    };
  })();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ChevronLeft className="h-4 w-4" /> Inicio
      </Link>
      <div className="mt-1 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Venta por canal (mensual)</h1>
          <p className="text-sm text-slate-500">
            {rows.length} registros · {year}{mes ? ` · ${mes}` : ""}{channelId ? ` · canal #${channelId}` : ""}
          </p>
        </div>
        <ShoppingBag className="h-7 w-7 text-brand-600" />
      </div>

      {stats && (
        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Canales con datos" value={formatInt(stats.canalesCount)} />
          <Stat label="Total RN" value={formatInt(stats.totalRn)} />
          <Stat label="Total Revenue" value={formatCOP(stats.totalRev)} />
          <Stat label="ADR promedio" value={formatCOP(stats.avgAdr)} />
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
                <th className="px-4 py-2">Año</th>
                <th className="px-4 py-2">Mes</th>
                <th className="px-4 py-2">Canal</th>
                <th className="px-4 py-2">Categoría</th>
                <th className="px-4 py-2 text-right">RN Total</th>
                <th className="px-4 py-2 text-right">ADR Promedio</th>
                <th className="px-4 py-2 text-right">Revenue Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td></tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Sin registros para los filtros actuales.
                </td></tr>
              )}
              {rows.slice(0, 2000).map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-1.5 text-slate-600">{r.anio}</td>
                  <td className="px-4 py-1.5 font-medium text-slate-800">{r.mes}</td>
                  <td className="px-4 py-1.5 text-slate-700">{r.channel_name ?? `Canal #${r.channel_id}`}</td>
                  <td className="px-4 py-1.5">
                    {r.channel_category && (
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CATEGORIAS_COLORS[r.channel_category] ?? "bg-slate-100 text-slate-600"}`}>
                        {r.channel_category}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{formatInt(r.rn_total)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{r.adr_promedio != null ? formatCOP(r.adr_promedio) : "—"}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums font-medium">{formatCOP(r.revenue_total)}</td>
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

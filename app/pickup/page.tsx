"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  ChevronLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  TrendingUp,
  Filter,
  X,
} from "lucide-react";

import { swrFetcher } from "@/lib/api";
import type { PickupWeekly } from "@/lib/types";
import { formatCOP, formatPct, formatInt, formatNumber } from "@/lib/format";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const ANIOS = [2023, 2024, 2025, 2026];

type IngestLog = {
  id: number;
  source_file: string;
  sheet_name: string;
  rows_inserted: number;
  rows_skipped: number;
  uploaded_at: string;
};

interface Filters {
  anio: number;
  mes: string; // "" = todos
  fecha_reporte: string; // fecha EXACTA del snapshot (no rango)
  solo_con_pickup: boolean;
}

export default function PickupPage() {
  const [filters, setFilters] = useState<Filters>({
    anio: 2026,
    mes: "",
    fecha_reporte: "",
    solo_con_pickup: false,
  });

  const [form, setForm] = useState({
    mes: "Enero",
    anio: 2026,
    fecha_reporte: "",
    occ_base_pct: 0,
    rn_base: 0,
    ingresos: 0,
    adr_base: 0,
    occ_pickup_pp: 0,
    rn_pickup: 0,
    adr_pickup: 0,
    revenue_pickup: 0,
  });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: true } | { ok: false; msg: string } | null>(null);

  // SWR key cambia cuando cambian año/mes → recarga automáticamente del backend
  const apiUrl = useMemo(() => {
    const qp = new URLSearchParams();
    qp.append("limit", "2000");
    if (filters.anio) qp.append("year", String(filters.anio));
    if (filters.mes) qp.append("mes", filters.mes);
    return `${API_BASE}/api/pickup?${qp.toString()}`;
  }, [filters.anio, filters.mes]);

  const { data: rawRows = [], isLoading, mutate } = useSWR<PickupWeekly[]>(
    apiUrl,
    swrFetcher<PickupWeekly[]>,
    { revalidateOnFocus: false }
  );

  // Filtros locales (fecha_reporte exacta + solo_pickup) — sobre el subset que devolvió el backend
  const rows = useMemo(() => {
    return rawRows.filter((r) => {
      if (filters.fecha_reporte && r.fecha_reporte !== filters.fecha_reporte) return false;
      if (filters.solo_con_pickup) {
        const occDelta = Number(r.occ_pickup_pp ?? 0);
        const revDelta = Number(r.revenue_pickup ?? 0);
        if (r.rn_pickup === 0 && occDelta === 0 && revDelta === 0) return false;
      }
      return true;
    });
  }, [rawRows, filters.fecha_reporte, filters.solo_con_pickup]);

  // Audit log del último upload
  const { data: logs = [] } = useSWR<IngestLog[]>(
    `${API_BASE}/api/ingest-log?limit=5`,
    swrFetcher<IngestLog[]>,
    { revalidateOnFocus: false }
  );

  // KPIs agregados sobre los datos YA FILTRADOS.
  // Importante: cada fila es un SNAPSHOT de un mes (mismo mes aparece N veces
  // con distinta fecha_reporte). Por eso NO sumamos ingresos directamente —
  // sería contar el mismo mes múltiples veces. En su lugar, para cada mes
  // tomamos el ÚLTIMO snapshot (fecha_reporte más reciente) y esos son los
  // ingresos del periodo. El "Ingresos último mes" usa el último snapshot
  // del último mes disponible.
  const stats = useMemo(() => {
    if (!rows.length) return null;

    // Agrupar por mes y quedarnos con el snapshot más reciente de cada uno
    const byMes = new Map<string, PickupWeekly>();
    for (const r of rows) {
      const prev = byMes.get(r.mes);
      if (!prev || r.fecha_reporte > prev.fecha_reporte) {
        byMes.set(r.mes, r);
      }
    }

    const lastSnapshotGlobal = rows[0]; // ya está ordenado por fecha_reporte DESC
    const lastDate = lastSnapshotGlobal?.fecha_reporte ?? "—";
    const months = byMes.size;

    // Suma de los últimos snapshots de cada mes (ingreso del periodo filtrado)
    const totalIngresos = Array.from(byMes.values()).reduce(
      (acc, r) => acc + Number(r.ingresos ?? 0),
      0
    );

    // Último snapshot del último mes con datos
    const lastMonthEntries = Array.from(byMes.values()).sort((a, b) =>
      a.fecha_reporte < b.fecha_reporte ? 1 : -1
    );
    const ultimoMes = lastMonthEntries[0];
    const ingresosUltimoMes = ultimoMes ? Number(ultimoMes.ingresos ?? 0) : 0;
    const labelUltimoMes = ultimoMes ? `${ultimoMes.mes} ${ultimoMes.anio}` : "";

    // RN pickup y revenue pickup del último snapshot global
    const totalRnPickup = lastSnapshotGlobal?.rn_pickup ?? 0;
    const totalRevenuePickup = Number(lastSnapshotGlobal?.revenue_pickup ?? 0);

    return {
      totalRows: rows.length,
      lastDate,
      months,
      totalIngresos,
      ingresosUltimoMes,
      labelUltimoMes,
      totalRnPickup,
      totalRevenuePickup,
    };
  }, [rows]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/pickup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Error ${res.status}: ${body}`);
      }
      setResult({ ok: true });
      setForm({ ...form, fecha_reporte: "" });
      mutate();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setResult({ ok: false, msg });
    } finally {
      setSaving(false);
    }
  };

  const limpiarFiltros = () =>
    setFilters({ anio: 2026, mes: "", fecha_reporte: "", solo_con_pickup: false });

  const filtrosActivos =
    filters.mes !== "" ||
    filters.fecha_reporte !== "" ||
    filters.solo_con_pickup;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
      >
        <ChevronLeft className="h-4 w-4" /> Inicio
      </Link>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">Pickup semanal</h1>
      <p className="text-sm text-slate-500">
        Reportes semanales de pickup. Los datos cargados del Excel se listan abajo;
        usa los filtros para acotar y el form para añadir registros manuales (UPSERT por año+mes+fecha).
      </p>

      {/* Resumen de datos cargados (sobre el subset filtrado) */}
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Total registros"
          value={stats ? formatInt(stats.totalRows) : "—"}
          hint={stats ? `${formatInt(rawRows.length)} sin filtrar` : undefined}
        />
        <Stat
          label="Última fecha de reporte"
          value={stats?.lastDate ?? "—"}
          hint={stats ? `${stats.months} meses con datos` : undefined}
        />
        <Stat
          label="Ingresos (último mes)"
          value={stats ? formatCOP(stats.ingresosUltimoMes) : "—"}
          hint={stats?.labelUltimoMes ? `Snapshot de ${stats.labelUltimoMes}` : undefined}
        />
        <Stat
          label="Ingresos (periodo filtrado)"
          value={stats ? formatCOP(stats.totalIngresos) : "—"}
          hint={stats ? `Último snapshot de cada mes (×${stats.months})` : undefined}
        />
      </section>

      {/* Audit log del último upload */}
      {logs.length > 0 && (
        <section className="mt-4 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <FileSpreadsheet className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Último upload del Excel</p>
            <p className="text-xs text-emerald-800">
              {logs[0].source_file} → hojas: <span className="font-mono">{logs[0].sheet_name}</span> ·{" "}
              {formatInt(logs[0].rows_inserted)} filas insertadas ·{" "}
              {new Date(logs[0].uploaded_at).toLocaleString("es-CO")}
            </p>
          </div>
        </section>
      )}

      {/* FILTROS */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">Filtros</h2>
            {filtrosActivos && (
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                {filtrosActivos ? "activo" : ""}
              </span>
            )}
          </div>
          {filtrosActivos && (
            <button
              onClick={limpiarFiltros}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
            >
              <X className="h-3.5 w-3.5" /> Limpiar
            </button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterField label="Año">
            <select
              value={filters.anio}
              onChange={(e) => setFilters({ ...filters, anio: +e.target.value })}
              className="input"
            >
              {ANIOS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Mes">
            <select
              value={filters.mes}
              onChange={(e) => setFilters({ ...filters, mes: e.target.value })}
              className="input"
            >
              <option value="">Todos</option>
              {MESES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Fecha reporte (exacto)">
            <input
              type="date"
              value={filters.fecha_reporte}
              onChange={(e) => setFilters({ ...filters, fecha_reporte: e.target.value })}
              className="input"
            />
          </FilterField>
          <FilterField label=" ">
            <label className="flex h-10 items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters.solo_con_pickup}
                onChange={(e) => setFilters({ ...filters, solo_con_pickup: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              Solo con pickup (Δ ≠ 0)
            </label>
          </FilterField>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_2fr]">
        {/* FORM (entrada manual) */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-base font-semibold text-slate-900">Ingreso manual</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Mes">
              <select
                value={form.mes}
                onChange={(e) => setForm({ ...form, mes: e.target.value })}
                className="input"
              >
                {MESES.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Año">
              <input
                type="number"
                min={2020}
                max={2100}
                value={form.anio}
                onChange={(e) => setForm({ ...form, anio: +e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Fecha Reporte *" required>
              <input
                type="date"
                required
                value={form.fecha_reporte}
                onChange={(e) => setForm({ ...form, fecha_reporte: e.target.value })}
                className="input"
              />
            </Field>
          </div>

          <Section title="Base (snapshot inicial)">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="OCC Base (%)">
                <input
                  type="number" step="0.01" min={0} max={100}
                  value={form.occ_base_pct}
                  onChange={(e) => setForm({ ...form, occ_base_pct: +e.target.value })}
                  className="input"
                />
              </Field>
              <Field label="RN Base">
                <input
                  type="number" min={0}
                  value={form.rn_base}
                  onChange={(e) => setForm({ ...form, rn_base: +e.target.value })}
                  className="input"
                />
              </Field>
              <Field label="Ingresos (COP)">
                <input
                  type="number" step="0.01" min={0}
                  value={form.ingresos}
                  onChange={(e) => setForm({ ...form, ingresos: +e.target.value })}
                  className="input"
                />
              </Field>
              <Field label="ADR Base (COP)">
                <input
                  type="number" step="0.01" min={0}
                  value={form.adr_base}
                  onChange={(e) => setForm({ ...form, adr_base: +e.target.value })}
                  className="input"
                />
              </Field>
            </div>
          </Section>

          <Section title="Pickup (delta vs base)">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="OCC Pickup (pp)">
                <input
                  type="number" step="0.01"
                  value={form.occ_pickup_pp}
                  onChange={(e) => setForm({ ...form, occ_pickup_pp: +e.target.value })}
                  className="input"
                />
              </Field>
              <Field label="RN Pickup">
                <input
                  type="number"
                  value={form.rn_pickup}
                  onChange={(e) => setForm({ ...form, rn_pickup: +e.target.value })}
                  className="input"
                />
              </Field>
              <Field label="ADR Pickup (COP)">
                <input
                  type="number" step="0.01"
                  value={form.adr_pickup}
                  onChange={(e) => setForm({ ...form, adr_pickup: +e.target.value })}
                  className="input"
                />
              </Field>
              <Field label="Revenue Pickup (COP)">
                <input
                  type="number" step="0.01"
                  value={form.revenue_pickup}
                  onChange={(e) => setForm({ ...form, revenue_pickup: +e.target.value })}
                  className="input"
                />
              </Field>
            </div>
          </Section>

          <button
            type="submit"
            disabled={saving || !form.fecha_reporte}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
            ) : (
              <><Save className="h-4 w-4" /> Guardar reporte</>
            )}
          </button>

          {result?.ok && (
            <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <CheckCircle2 className="h-5 w-5" /> Reporte guardado correctamente.
            </div>
          )}
          {result && !result.ok && (
            <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <AlertCircle className="h-5 w-5" /> {result.msg}
            </div>
          )}
        </form>

        {/* LISTA DE DATOS CARGADOS — 11 columnas (Base + Pickup) */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Datos cargados</h2>
              <p className="text-xs text-slate-500">
                {isLoading
                  ? "Cargando…"
                  : `${rows.length} reportes${filtrosActivos ? ` (de ${rawRows.length} totales)` : ""} · ordenados por fecha_reporte DESC`}
              </p>
            </div>
            <TrendingUp className="h-5 w-5 text-slate-400" />
          </div>
          <div className="max-h-[640px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th colSpan={7} className="border-b border-slate-200 px-3 py-1.5 text-center text-[10px] text-slate-600">
                    Base (snapshot inicial)
                  </th>
                  <th colSpan={4} className="border-b border-slate-200 px-3 py-1.5 text-center text-[10px] text-amber-700 bg-amber-50/50">
                    Pickup (delta vs base)
                  </th>
                </tr>
                <tr>
                  <th className="px-3 py-2">Mes</th>
                  <th className="px-3 py-2">Año</th>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2 text-right">OCC%</th>
                  <th className="px-3 py-2 text-right">RN base</th>
                  <th className="px-3 py-2 text-right">Ingresos</th>
                  <th className="px-3 py-2 text-right">ADR base</th>
                  <th className="px-3 py-2 text-right bg-amber-50/50">ΔOCC pp</th>
                  <th className="px-3 py-2 text-right bg-amber-50/50">ΔRN</th>
                  <th className="px-3 py-2 text-right bg-amber-50/50">ΔADR</th>
                  <th className="px-3 py-2 text-right bg-amber-50/50">ΔRev</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading && (
                  <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td></tr>
                )}
                {!isLoading && rows.length === 0 && (
                  <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                    {rawRows.length === 0
                      ? "No hay reportes. Carga el Excel o añade uno con el form."
                      : "Ningún reporte coincide con los filtros activos."}
                  </td></tr>
                )}
                {rows.map((r) => {
                  const occDelta = Number(r.occ_pickup_pp ?? 0);
                  const rnDelta = r.rn_pickup ?? 0;
                  const adrDelta = Number(r.adr_pickup ?? 0);
                  const revDelta = Number(r.revenue_pickup ?? 0);
                  const hasPickup = occDelta !== 0 || rnDelta !== 0 || adrDelta !== 0 || revDelta !== 0;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-3 py-1.5 font-medium text-slate-800">{r.mes}</td>
                      <td className="px-3 py-1.5 text-slate-600 tabular-nums">{r.anio}</td>
                      <td className="px-3 py-1.5 text-slate-600 tabular-nums">{r.fecha_reporte}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatPct(r.occ_base_pct)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatInt(r.rn_base)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatCOP(r.ingresos)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatCOP(r.adr_base)}</td>
                      <td className={`px-3 py-1.5 text-right tabular-nums bg-amber-50/30 ${deltaColor(occDelta)}`}>
                        {formatNumber(occDelta)}
                      </td>
                      <td className={`px-3 py-1.5 text-right tabular-nums bg-amber-50/30 ${deltaColor(rnDelta)}`}>
                        {rnDelta > 0 ? "+" : ""}{formatInt(rnDelta)}
                      </td>
                      <td className={`px-3 py-1.5 text-right tabular-nums bg-amber-50/30 ${deltaColor(adrDelta)}`}>
                        {formatCOP(adrDelta)}
                      </td>
                      <td className={`px-3 py-1.5 text-right tabular-nums bg-amber-50/30 ${deltaColor(revDelta)}`}>
                        {formatCOP(revDelta)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style jsx>{`
        :global(.input) {
          @apply w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500;
        }
      `}</style>
    </main>
  );
}

function deltaColor(n: number): string {
  if (n > 0) return "text-emerald-600";
  if (n < 0) return "text-rose-600";
  return "text-slate-400";
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900 tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-700">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      {label.trim() && <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>}
      {children}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-100 pt-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
      {children}
    </div>
  );
}

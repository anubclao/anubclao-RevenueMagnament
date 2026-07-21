"use client";

/**
 * PickupChart — Análisis de pickup por Fecha Reporte.
 *
 * Modo 1 (con pickup_weekly, ej. 2026):
 *   Barras agrupadas: RN Pickup (izq) + Revenue Pickup (der) por fecha de reporte.
 *
 * Modo 2 (sin pickup, ej. 2023-2025):
 *   Comparativo Anual de Ingresos y RN por mes, una línea por año (2023..año actual).
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PickupPoint } from "@/lib/types";
import { formatCompactCOP, formatCOP, formatDateShort, formatNumber, formatPercent } from "@/lib/format";

interface PickupAnualPoint {
  fecha_reporte: string;
  anio: number;
  mes: string;
  mes_num: number;
  rev: number;
  rn: number;
  occ: number;
}

interface Props {
  data: (PickupPoint | PickupAnualPoint)[];
  isLoading: boolean;
}

function isAnualMode(data: Props["data"]): data is PickupAnualPoint[] {
  if (data.length === 0) return false;
  const first = data[0] as Partial<PickupAnualPoint> & Partial<PickupPoint>;
  return "anio" in first && first.anio !== undefined;
}

const MESES_CORTOS: Record<string, string> = {
  Enero: "Ene", Febrero: "Feb", Marzo: "Mar", Abril: "Abr",
  Mayo: "May", Junio: "Jun", Julio: "Jul", Agosto: "Ago",
  Septiembre: "Sep", Octubre: "Oct", Noviembre: "Nov", Diciembre: "Dic",
};

const ANIO_COLORS: Record<number, string> = {
  2023: "#94a3b8",
  2024: "#1aa6bd",
  2025: "#0c8395",
  2026: "#1f7a72",
};

export function PickupChart({ data, isLoading }: Props) {
  const anual = isAnualMode(data);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-3">
        <h3 className="text-base font-semibold text-slate-900">
          {anual ? "Comparativo Anual de Ingresos y RN" : "Análisis de Pickup Semanal"}
        </h3>
        <p className="text-xs text-slate-500">
          {anual
            ? "Evolución mensual por año, según dashboard de Excel."
            : "Variación de RN e Ingresos por cada Fecha Reporte."}
        </p>
      </header>
      <div className="h-72">
        {isLoading || data.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400">
            Sin datos para el período seleccionado.
          </div>
        ) : anual ? (
          <ComparativoAnual data={data} />
        ) : (
          <PickupSemanal data={data as PickupPoint[]} />
        )}
      </div>
    </div>
  );
}

function PickupSemanal({ data }: { data: PickupPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="fecha_reporte"
          tickFormatter={(v) => formatDateShort(v)}
          tick={{ fontSize: 11, fill: "#64748b" }}
          interval="preserveStartEnd"
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickFormatter={(v) => formatNumber(v)}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11, fill: "#0c8395" }}
          tickFormatter={(v) => formatCompactCOP(v)}
        />
        <Tooltip content={<PickupSemanalTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          yAxisId="left"
          dataKey="rn_pickup"
          name="RN Pickup"
          fill="#1f7a72"
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
        <Bar
          yAxisId="right"
          dataKey="revenue_pickup"
          name="Revenue Pickup"
          fill="#1aa6bd"
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function PickupSemanalTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as PickupPoint;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-slate-900">Reporte: {formatDateShort(label)}</p>
      <ul className="mt-1 space-y-0.5 text-slate-600">
        <li>RN Pickup: <span className="font-medium text-slate-900">{formatNumber(p.rn_pickup)}</span></li>
        <li>Revenue Pickup: <span className="font-medium text-slate-900">{formatCompactCOP(p.revenue_pickup)}</span></li>
        <li>OCC Pickup: <span className="font-medium text-slate-900">{p.occ_pickup_pp.toFixed(2)} pp</span></li>
      </ul>
    </div>
  );
}

function ComparativoAnual({ data }: { data: PickupAnualPoint[] }) {
  // Agrupar por mes_num (eje X) y un serie por año
  const byMes = new Map<number, Record<string, number | string>>();
  const anios = Array.from(new Set(data.map((d) => d.anio))).sort();
  const mesNumeros = Array.from(new Set(data.map((d) => d.mes_num))).sort((a, b) => a - b);
  const mesNumToName = new Map<number, string>();
  for (const d of data) mesNumToName.set(d.mes_num, d.mes);

  for (const d of data) {
    const m = d.mes_num;
    if (!byMes.has(m)) byMes.set(m, { mes_num: m });
    const row = byMes.get(m)!;
    row[`rev_${d.anio}`] = d.rev;
    row[`rn_${d.anio}`] = d.rn;
  }

  const ordered = Array.from(byMes.values()).sort(
    (a, b) => Number(a.mes_num) - Number(b.mes_num)
  );
  const anioMax = Math.max(...anios);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={ordered} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="mes_num"
          type="number"
          domain={[1, 12]}
          ticks={mesNumeros}
          tickFormatter={(n) => MESES_CORTOS[mesNumToName.get(Number(n)) ?? ""] ?? `${n}`}
          tick={{ fontSize: 11, fill: "#64748b" }}
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickFormatter={(v) => formatCompactCOP(v)}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11, fill: "#0c8395" }}
          tickFormatter={(v) => formatNumber(v)}
        />
        <Tooltip content={<ComparativoAnualTooltip anios={anios} mesNumToName={mesNumToName} />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {anios.map((a) => (
          <Line
            key={`rev-${a}`}
            yAxisId="left"
            type="monotone"
            dataKey={`rev_${a}`}
            name={`Ingresos ${a}`}
            stroke={ANIO_COLORS[a] ?? "#64748b"}
            strokeWidth={a === anioMax ? 3 : 1.5}
            strokeDasharray={a === anioMax ? undefined : "4 4"}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        ))}
        {anios.map((a) => (
          <Line
            key={`rn-${a}`}
            yAxisId="right"
            type="monotone"
            dataKey={`rn_${a}`}
            name={`RN ${a}`}
            stroke={ANIO_COLORS[a] ?? "#64748b"}
            strokeWidth={1}
            strokeOpacity={0.4}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function ComparativoAnualTooltip({ active, payload, label, anios, mesNumToName }: any) {
  if (!active || !payload?.length) return null;
  const mesNombre = mesNumToName?.get(Number(label)) ?? label;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-slate-900">{mesNombre}</p>
      <ul className="mt-1 space-y-0.5 text-slate-600">
        {anios.map((a: number) => {
          const rev = payload.find((p: any) => p.dataKey === `rev_${a}`)?.value;
          const rn = payload.find((p: any) => p.dataKey === `rn_${a}`)?.value;
          return (
            <li key={a}>
              <span className="font-medium text-slate-900">{a}:</span>{" "}
              {rev !== undefined ? formatCOP(rev) : "—"}
              {rn !== undefined ? ` · ${formatNumber(rn)} RN` : ""}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

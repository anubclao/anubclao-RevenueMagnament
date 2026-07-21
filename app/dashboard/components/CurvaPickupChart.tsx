"use client";

/**
 * CurvaPickupChart — Comparativa temporal de revenue.
 *
 * Modo 1 (con pickup_weekly, ej. 2026):
 *   Curva semanal: año actual (línea) vs STLY (área de fondo) vs delta % (línea punteada).
 *
 * Modo 2 (sin pickup, ej. 2023-2025):
 *   Comparativa Interanual: Ingresos del año actual vs año anterior, por mes.
 *   Eje X = mes, dos líneas: año actual y año previo.
 */
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CurvaPickupPoint } from "@/lib/types";
import { formatCOP, formatNumber } from "@/lib/format";

interface Props {
  data: CurvaPickupPoint[];
  isLoading: boolean;
}

const MESES_CORTOS: Record<number, string> = {
  1: "Ene", 2: "Feb", 3: "Mar", 4: "Abr", 5: "May", 6: "Jun",
  7: "Jul", 8: "Ago", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dic",
};

function isModoMensual(data: CurvaPickupPoint[]): boolean {
  if (data.length === 0) return false;
  // Modo mensual: semana_num 1..12 (mes del año)
  return data.every((d) => d.semana_num >= 1 && d.semana_num <= 12);
}

export function CurvaPickupChart({ data, isLoading }: Props) {
  const mensual = isModoMensual(data);
  const anioActual = mensual && data.length > 0
    ? Number(data[0].fecha_semana.slice(0, 4))
    : null;
  const anioComparado = mensual && data.length > 0
    ? (data[0] as CurvaPickupPoint & { anio_comparado: number | null }).anio_comparado
    : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-3">
        <h3 className="text-base font-semibold text-slate-900">
          {mensual
            ? anioComparado
              ? `Comparativa Interanual — ${anioComparado} vs ${anioActual}`
              : `Ingresos Mensuales ${anioActual}`
            : "Curva de Pickup vs STLY"}
        </h3>
        <p className="text-xs text-slate-500">
          {mensual
            ? anioComparado
              ? "Ingresos por mes, año actual vs año de comparación."
              : "No hay año previo con datos para comparar."
            : "Ritmo de reserva actual comparado con el mismo período del año anterior."}
        </p>
      </header>
      <div className="h-72">
        {isLoading || data.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400">
            Sin datos para el período seleccionado.
          </div>
        ) : mensual ? (
          <ComparativaMensual
            data={data}
            anioActual={anioActual!}
            anioComparado={anioComparado}
          />
        ) : (
          <CurvaSemanal data={data} />
        )}
      </div>
    </div>
  );
}

function CurvaSemanal({ data }: { data: CurvaPickupPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1f7a72" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#1f7a72" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="semana_num"
          tickFormatter={(v) => `S${v}`}
          tick={{ fontSize: 11, fill: "#64748b" }}
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickFormatter={(v) => formatNumber(v)}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11, fill: "#1aa6bd" }}
          tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}%`}
          domain={["auto", "auto"]}
        />
        <Tooltip content={<CurvaSemanalTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <ReferenceLine yAxisId="right" y={0} stroke="#cbd5e1" strokeDasharray="2 2" />

        <Area
          yAxisId="left"
          type="monotone"
          dataKey="rn_stly"
          name="STLY (año anterior)"
          fill="#cbd5e1"
          stroke="#94a3b8"
          strokeWidth={1.5}
          fillOpacity={0.4}
          isAnimationActive={false}
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="rn_actual"
          name="Año actual"
          stroke="#1f7a72"
          strokeWidth={3}
          dot={{ r: 3, fill: "#1f7a72" }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="delta_pct"
          name="Δ % vs STLY"
          stroke="#1aa6bd"
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function CurvaSemanalTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as CurvaPickupPoint;
  const delta = p.delta_pct;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-slate-900">Semana {label}</p>
      <ul className="mt-1 space-y-0.5 text-slate-600">
        <li>Actual: <span className="font-medium text-slate-900">{formatNumber(p.rn_actual)} RN</span></li>
        <li>STLY: <span className="font-medium text-slate-900">{formatNumber(p.rn_stly)} RN</span></li>
        <li>
          Δ:{" "}
          <span
            className={
              delta > 0
                ? "font-medium text-emerald-700"
                : delta < 0
                ? "font-medium text-rose-700"
                : "font-medium text-slate-700"
            }
          >
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1)}%
          </span>
        </li>
      </ul>
    </div>
  );
}

function ComparativaMensual({
  data,
  anioActual,
  anioComparado,
}: {
  data: CurvaPickupPoint[];
  anioActual: number;
  anioComparado: number | null;
}) {
  const hayComparacion = anioComparado !== null && data.some((d) => d.rn_stly > 0);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="prevGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="semana_num"
          type="number"
          domain={[1, 12]}
          tickFormatter={(v) => MESES_CORTOS[Number(v)] ?? `${v}`}
          tick={{ fontSize: 11, fill: "#64748b" }}
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickFormatter={(v) => {
            const n = Number(v);
            if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
            if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
            return `$${n.toFixed(0)}`;
          }}
        />
        {hayComparacion && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fill: "#1aa6bd" }}
            tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}%`}
            domain={["auto", "auto"]}
          />
        )}
        <Tooltip content={<ComparativaMensualTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {hayComparacion && (
          <ReferenceLine yAxisId="right" y={0} stroke="#cbd5e1" strokeDasharray="2 2" />
        )}

        {hayComparacion && anioComparado !== null && (
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="rn_stly"
            name={`Ingresos ${anioComparado}`}
            fill="url(#prevGradient)"
            stroke="#94a3b8"
            strokeWidth={1.5}
            fillOpacity={0.4}
            connectNulls
            isAnimationActive={false}
          />
        )}
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="rn_actual"
          name={`Ingresos ${anioActual}`}
          stroke="#1f7a72"
          strokeWidth={3}
          dot={{ r: 4, fill: "#1f7a72" }}
          activeDot={{ r: 6 }}
          connectNulls
          isAnimationActive={false}
        />
        {hayComparacion && (
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="delta_pct"
            name={`Δ % vs ${anioComparado}`}
            stroke="#1aa6bd"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function ComparativaMensualTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as CurvaPickupPoint;
  const delta = p.delta_pct;
  const anioComparado = (p as CurvaPickupPoint & { anio_comparado: number | null }).anio_comparado;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-slate-900">
        {MESES_CORTOS[Number(label)] ?? label} {p.fecha_semana.slice(0, 4)}
      </p>
      <ul className="mt-1 space-y-0.5 text-slate-600">
        <li>
          Actual: <span className="font-medium text-slate-900">{formatCOP(p.rn_actual)}</span>
        </li>
        {anioComparado !== null && (
          <li>
            {anioComparado}: <span className="font-medium text-slate-900">{formatCOP(p.rn_stly)}</span>
          </li>
        )}
        {anioComparado !== null && (
          <li>
            Δ:{" "}
            <span
              className={
                delta > 0
                  ? "font-medium text-emerald-700"
                  : delta < 0
                  ? "font-medium text-rose-700"
                  : "font-medium text-slate-700"
              }
            >
              {delta > 0 ? "+" : ""}
              {delta.toFixed(1)}%
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}

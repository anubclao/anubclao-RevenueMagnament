"use client";

/**
 * OccAdrChart — Gráfico combinado (barras OCC/RN + línea ADR secundario).
 * Es el chart "estrella" del dashboard. Cumple el requerimiento (1) del brief.
 */
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OccAdrPoint } from "@/lib/types";
import { formatCompactCOP, formatPercent } from "@/lib/format";

interface Props {
  data: OccAdrPoint[];
  isLoading: boolean;
}

export function OccAdrChart({ data, isLoading }: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-3">
        <h3 className="text-base font-semibold text-slate-900">
          Evolución de Ocupación vs. ADR
        </h3>
        <p className="text-xs text-slate-500">
          Barras: % ocupación. Línea: ADR (eje secundario, COP por noche).
        </p>
      </header>
      <div className="h-72">
        {isLoading || data.length === 0 ? (
          <div className="skeleton h-full w-full" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#64748b" }} />
              {/* Eje Y izquierdo: OCC en % */}
              <YAxis
                yAxisId="left"
                domain={[0, 100]}
                tick={{ fontSize: 12, fill: "#64748b" }}
                tickFormatter={(v) => `${v}%`}
              />
              {/* Eje Y derecho: ADR en COP compacto */}
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12, fill: "#0c8395" }}
                tickFormatter={(v) => formatCompactCOP(v)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                yAxisId="left"
                dataKey="occ_pct"
                name="% Ocupación"
                fill="#1f7a72"
                radius={[6, 6, 0, 0]}
                maxBarSize={48}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="adr"
                name="ADR"
                stroke="#1aa6bd"
                strokeWidth={3}
                dot={{ r: 4, fill: "#1aa6bd" }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as OccAdrPoint | undefined;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-slate-900">{label}</p>
      {point && (
        <ul className="mt-1 space-y-0.5 text-slate-600">
          <li>Ocupación: <span className="font-medium text-slate-900">{formatPercent(point.occ_pct)}</span></li>
          <li>ADR: <span className="font-medium text-slate-900">{formatCompactCOP(point.adr)}</span></li>
          <li>RN: <span className="font-medium text-slate-900">{point.rn.toLocaleString("es-CO")}</span></li>
          <li>Ingresos: <span className="font-medium text-slate-900">{formatCompactCOP(point.ingresos)}</span></li>
        </ul>
      )}
    </div>
  );
}

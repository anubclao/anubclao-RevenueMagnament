"use client";

/**
 * TendenciaMensualTable — Tabla comparativa 2023 vs 2024 vs 2025 vs 2026
 * (idéntica a la pestaña "Dashboard" del Excel "BORA_BORA_INFORME_EJECUTIVO").
 *
 *  Mes | OCC 23 | OCC 24 | OCC 25 | OCC 26 | ADR 23 | ADR 24 | ADR 25 | ADR 26
 *       | REV 23 | REV 24 | REV 25 | REV 26
 *
 *  - Cuando el usuario filtra un mes, ese mes se resalta.
 *  - Si no filtra nada, muestra los 12 meses (default).
 *  - Los NULL (años sin data) se renderizan con "—".
 *  - Los valores COP se muestran COMPLETOS (sin redondear), en estilo contable.
 */
import { formatCOP, formatPercent } from "@/lib/format";
import { TrendingUp } from "lucide-react";

export interface TendenciaMes {
  mes: string;
  occ: Record<number, number | null>;
  adr: Record<number, number | null>;
  rev: Record<number, number | null>;
}

interface Props {
  anios: number[];
  data: TendenciaMes[];
  highlightMes?: string | null;
  isLoading?: boolean;
}

/** OCC: 73.7% (sin redondear a 73% ni a 73.70%) */
function formatOCC(v: number): string {
  return `${v.toFixed(1)}%`;
}

export function TendenciaMensualTable({ anios, data, highlightMes, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="skeleton h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <TrendingUp className="h-5 w-5 text-brand-600" />
            Tendencia Mensual — Comparativo {anios.join(" vs ")}
          </h3>
          <p className="text-xs text-slate-500">
            OCC, ADR e Ingresos por mes. Datos directos de la pestaña Dashboard del Excel.
          </p>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-700">
                Mes
              </th>
              {anios.map((a) => (
                <th
                  key={`occ-${a}`}
                  colSpan={1}
                  className="px-2 py-2 text-center font-semibold text-slate-700"
                >
                  OCC {String(a).slice(-2)}
                </th>
              ))}
              {anios.map((a) => (
                <th
                  key={`adr-${a}`}
                  className="px-2 py-2 text-center font-semibold text-slate-700"
                >
                  ADR {String(a).slice(-2)}
                </th>
              ))}
              {anios.map((a) => (
                <th
                  key={`rev-${a}`}
                  className="px-2 py-2 text-center font-semibold text-slate-700"
                >
                  REV {String(a).slice(-2)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const isHighlighted = highlightMes && row.mes === highlightMes;
              return (
                <tr
                  key={row.mes}
                  className={
                    isHighlighted
                      ? "border-b border-amber-200 bg-amber-50"
                      : "border-b border-slate-100 hover:bg-slate-50"
                  }
                >
                  <td
                    className={
                      isHighlighted
                        ? "sticky left-0 z-10 bg-amber-50 px-3 py-2 font-semibold text-amber-900"
                        : "sticky left-0 z-10 bg-white px-3 py-2 font-medium text-slate-700"
                    }
                  >
                    {row.mes}
                    {isHighlighted && (
                      <span className="ml-2 inline-flex rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                        filtro
                      </span>
                    )}
                  </td>
                  {anios.map((a) => (
                    <td
                      key={`occ-${a}-${row.mes}`}
                      className="px-2 py-2 text-center text-slate-700"
                    >
                      {row.occ[a] !== null ? formatOCC(row.occ[a]!) : "—"}
                    </td>
                  ))}
                  {anios.map((a) => (
                    <td
                      key={`adr-${a}-${row.mes}`}
                      className="px-2 py-2 text-center text-slate-700 tabular-nums"
                    >
                      {row.adr[a] !== null ? formatCOP(row.adr[a]!) : "—"}
                    </td>
                  ))}
                  {anios.map((a) => (
                    <td
                      key={`rev-${a}-${row.mes}`}
                      className="px-2 py-2 text-right font-medium text-slate-900 tabular-nums"
                    >
                      {row.rev[a] !== null ? formatCOP(row.rev[a]!) : "—"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

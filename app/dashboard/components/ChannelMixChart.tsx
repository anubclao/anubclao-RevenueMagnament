"use client";

/**
 * ChannelMixChart — Mix de distribución de canales (donut) + barras participación.
 * Dos vistas en tabs.
 */
import { useState } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import type { ChannelMixSlice } from "@/lib/types";
import { formatCompactCOP, formatPercent } from "@/lib/format";
import { clsx } from "clsx";

interface Props {
  data: ChannelMixSlice[];
  isLoading: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  DIRECT: "#1f7a72",
  OTA: "#1aa6bd",
  WHOLESALER: "#ff6f61",
  CORPORATE: "#4cb3a8",
  OTHER: "#94a3b8",
};

export function ChannelMixChart({ data, isLoading }: Props) {
  const [view, setView] = useState<"donut" | "bars">("donut");

  // Top 8 + "Otros" si hay más
  const top = data.slice(0, 8);
  const rest = data.slice(8);
  const chartData = rest.length
    ? [
        ...top,
        {
          canal: `Otros (${rest.length})`,
          categoria: "OTHER",
          rn: rest.reduce((a, b) => a + b.rn, 0),
          revenue: rest.reduce((a, b) => a + b.revenue, 0),
          participacion_pct: rest.reduce((a, b) => a + b.participacion_pct, 0),
        },
      ]
    : top;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Mix de Distribución por Canal
          </h3>
          <p className="text-xs text-slate-500">
            Participación en revenue, segmentada por categoría.
          </p>
        </div>
        <div className="flex rounded-md border border-slate-200 p-0.5 text-xs">
          <TabBtn active={view === "donut"} onClick={() => setView("donut")}>
            Donut
          </TabBtn>
          <TabBtn active={view === "bars"} onClick={() => setView("bars")}>
            Barras
          </TabBtn>
        </div>
      </header>

      <div className="h-72">
        {isLoading || data.length === 0 ? (
          <div className="skeleton h-full w-full" />
        ) : view === "donut" ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="revenue"
                nameKey="canal"
                innerRadius="55%"
                outerRadius="85%"
                paddingAngle={2}
                stroke="#fff"
                strokeWidth={2}
              >
                {chartData.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={CATEGORY_COLORS[entry.categoria] ?? "#94a3b8"}
                  />
                ))}
              </Pie>
              <Tooltip content={<DonutTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                layout="vertical"
                align="right"
                verticalAlign="middle"
                formatter={(value, entry) => {
                  const e = entry as { payload?: ChannelMixSlice };
                  return `${value} ${e.payload ? `(${e.payload.participacion_pct.toFixed(1)}%)` : ""}`;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={(v) => formatCompactCOP(v)}
                tick={{ fontSize: 11, fill: "#64748b" }}
              />
              <YAxis
                type="category"
                dataKey="canal"
                width={140}
                tick={{ fontSize: 10, fill: "#475569" }}
              />
              <Tooltip content={<BarsTooltip />} />
              <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={CATEGORY_COLORS[entry.categoria] ?? "#94a3b8"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "rounded-md px-3 py-1 transition",
        active ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
}

function DonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as ChannelMixSlice;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-slate-900">{p.canal}</p>
      <p className="text-slate-500">Categoría: {p.categoria}</p>
      <ul className="mt-1 space-y-0.5 text-slate-600">
        <li>Revenue: <span className="font-medium text-slate-900">{formatCompactCOP(p.revenue)}</span></li>
        <li>Participación: <span className="font-medium text-slate-900">{formatPercent(p.participacion_pct)}</span></li>
        <li>RN: <span className="font-medium text-slate-900">{p.rn.toLocaleString("es-CO")}</span></li>
      </ul>
    </div>
  );
}

function BarsTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as ChannelMixSlice;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-slate-900">{label}</p>
      <ul className="mt-1 space-y-0.5 text-slate-600">
        <li>Revenue: <span className="font-medium text-slate-900">{formatCompactCOP(p.revenue)}</span></li>
        <li>Participación: <span className="font-medium text-slate-900">{formatPercent(p.participacion_pct)}</span></li>
      </ul>
    </div>
  );
}

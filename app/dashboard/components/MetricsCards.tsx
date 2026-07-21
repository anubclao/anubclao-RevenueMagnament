"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { KpiSummary } from "@/lib/types";
import {
  formatCOP,
  formatNumber,
  formatPercent,
} from "@/lib/format";

interface Props {
  data: KpiSummary | undefined;
  isLoading: boolean;
}

interface CardProps {
  label: string;
  value: string;
  hint?: string;
  trend?: "up" | "down" | "flat" | null;
  trendLabel?: string;
  accent?: "brand" | "sea" | "coral" | "neutral";
  /** Reduce el font-size del value (útil para COP largos en cards angostas) */
  compact?: boolean;
}

function Card({ label, value, hint, trend, trendLabel, accent = "neutral", compact = false }: CardProps) {
  const accentMap = {
    brand: "border-brand-200 bg-brand-50/40",
    sea: "border-sea-400/30 bg-sea-400/5",
    coral: "border-coral-500/30 bg-coral-500/5",
    neutral: "border-slate-200 bg-white",
  } as const;

  return (
    <div
      className={`rounded-2xl border ${accentMap[accent]} p-5 shadow-sm transition hover:shadow-md animate-fade-in`}
    >
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className={
          compact
            ? "mt-2 text-lg font-bold text-slate-900 tabular-nums break-all"
            : "mt-2 text-2xl font-bold text-slate-900 tabular-nums break-all"
        }
        title={value}
      >
        {value}
      </p>
      <div className="mt-2 flex items-center gap-2">
        {trend === "up" && <TrendingUp className="h-4 w-4 text-emerald-600" />}
        {trend === "down" && <TrendingDown className="h-4 w-4 text-rose-600" />}
        {trend === "flat" && <Minus className="h-4 w-4 text-slate-400" />}
        {trendLabel && (
          <span
            className={
              trend === "up"
                ? "text-sm font-medium text-emerald-700"
                : trend === "down"
                ? "text-sm font-medium text-rose-700"
                : "text-sm font-medium text-slate-500"
            }
          >
            {trendLabel}
          </span>
        )}
        {hint && !trendLabel && <span className="text-xs text-slate-500">{hint}</span>}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="skeleton h-3 w-24" />
      <div className="skeleton mt-3 h-8 w-32" />
      <div className="skeleton mt-3 h-3 w-20" />
    </div>
  );
}

export function MetricsCards({ data, isLoading }: Props) {
  if (isLoading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const variacion = data.variacion_anual_pct;
  const trend: "up" | "down" | "flat" | null =
    variacion === null || variacion === undefined
      ? null
      : Number(variacion) > 0.5
      ? "up"
      : Number(variacion) < -0.5
      ? "down"
      : "flat";
  const trendLabel =
    variacion !== null && variacion !== undefined
      ? `${Number(variacion) > 0 ? "+" : ""}${Number(variacion).toFixed(1)}% vs año anterior`
      : undefined;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card
        label="Ingresos totales"
        value={formatCOP(data.total_ingresos)}
        trend={trend}
        trendLabel={trendLabel}
        accent="brand"
        compact
      />
      <Card
        label="ADR promedio"
        value={formatCOP(data.adr_promedio)}
        hint="por noche ocupada"
        accent="sea"
      />
      <Card
        label="Ocupación media"
        value={formatPercent(data.ocupacion_media_pct)}
        hint="promedio del período"
        accent="neutral"
      />
      <Card
        label="RN totales"
        value={formatNumber(data.rn_totales)}
        hint={`+${formatNumber(data.rn_pickup_total)} pickup`}
        accent="coral"
      />
    </div>
  );
}

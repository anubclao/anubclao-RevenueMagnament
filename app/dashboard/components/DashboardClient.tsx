"use client";

/**
 * DashboardClient — Componente principal del dashboard.
 *
 * Es el orquestador:
 *  - Lee filtros de la URL (useFilters).
 *  - Hace 2 fetches SWR: /metrics y /charts.
 *  - Distribuye los datos a los 4 charts + KPIs.
 *  - Maneja loading/error global y skeletons.
 *
 * Este archivo cumple el requerimiento (3) del brief:
 *  "el componente principal del Dashboard en Next.js utilizando React Hooks
 *   para controlar los segmentadores y renderizar un gráfico clave de Recharts."
 */
import useSWR from "swr";
import { Suspense } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

import { useFilters } from "@/lib/useFilters";
import { chartsKey, fetchCharts, metricsKey, fetchMetrics, swrFetcher, tendenciaKey, fetchTendenciaMensual } from "@/lib/api";
import { buildQueryString } from "@/lib/api";
import { FiltersBar } from "./FiltersBar";
import { MetricsCards } from "./MetricsCards";
import { OccAdrChart } from "./OccAdrChart";
import { PickupChart } from "./PickupChart";
import { ChannelMixChart } from "./ChannelMixChart";
import { CurvaPickupChart } from "./CurvaPickupChart";
import { TendenciaMensualTable } from "./TendenciaMensualTable";

export function DashboardClient() {
  // 1) Filtros sincronizados con la URL
  const { filters } = useFilters();

  // 2) Fetch KPIs
  const {
    data: kpi,
    error: kpiError,
    isLoading: kpiLoading,
    mutate: refreshKpi,
  } = useSWR(metricsKey(filters), () => fetchMetrics(filters), {
    revalidateOnFocus: true,
    revalidateIfStale: true,
    dedupingInterval: 2000,
  });

  // 3) Fetch charts (todos los datos de gráficos en 1 request)
  const {
    data: charts,
    error: chartsError,
    isLoading: chartsLoading,
    mutate: refreshCharts,
  } = useSWR(chartsKey(filters), () => fetchCharts(filters), {
    revalidateOnFocus: true,
    revalidateIfStale: true,
    dedupingInterval: 2000,
  });

  // 3b) Fetch tabla comparativa 2023..2026 por mes (TENDENCIA MENSUAL del Excel)
  const {
    data: tendencia,
    isLoading: tendenciaLoading,
  } = useSWR(tendenciaKey(filters), () => fetchTendenciaMensual(filters), {
    revalidateOnFocus: true,
    revalidateIfStale: true,
    dedupingInterval: 2000,
  });

  // 4) Health check (URL relativa, mismo origen)
  const { data: health } = useSWR<{ db_ok: boolean; status: string }>(
    "/api/health",
    (url: string) => swrFetcher<{ db_ok: boolean; status: string }>(url),
    {
      revalidateOnFocus: false,
      refreshInterval: 30000,
    }
  );

  const handleRefresh = () => {
    refreshKpi();
    refreshCharts();
  };

  // Mes destacado (cuando el usuario filtra un solo mes)
  const highlightMes =
    filters.months && filters.months.length === 1 ? filters.months[0] : null;

  return (
    <div className="space-y-6">
      <FiltersBar />

      {(kpiError || chartsError) && (
        <ErrorBanner
          message={
            health?.db_ok === false
              ? "Backend conectado pero la base de datos no responde. Revisa hPanel → MySQL."
              : "No se pudieron cargar los datos. Verifica que el backend esté corriendo."
          }
          onRetry={handleRefresh}
        />
      )}

      {/* KPIs */}
      <MetricsCards data={kpi} isLoading={kpiLoading} />

      {/* Charts en grid responsive */}
      <div className="grid gap-6 lg:grid-cols-2">
        <OccAdrChart
          data={charts?.occ_adr_series ?? []}
          isLoading={chartsLoading}
        />
        <PickupChart
          data={charts?.pickup_series ?? []}
          isLoading={chartsLoading}
        />
        <ChannelMixChart
          data={charts?.channel_mix ?? []}
          isLoading={chartsLoading}
        />
        <CurvaPickupChart
          data={charts?.curva_pickup ?? []}
          isLoading={chartsLoading}
        />
      </div>

      {/* Tabla comparativa TENDENCIA MENSUAL — idéntica a la pestaña Dashboard del Excel */}
      {tendencia && (
        <TendenciaMensualTable
          anios={tendencia.anios}
          data={tendencia.data}
          highlightMes={highlightMes}
          isLoading={tendenciaLoading}
        />
      )}

      <div className="text-center text-xs text-slate-400">
        {kpi?.filtros_aplicados && (
          <span>
            Filtros activos:{" "}
            {Object.entries(kpi.filtros_aplicados)
              .filter(([, v]) => v !== null && v !== undefined && (Array.isArray(v) ? v.length > 0 : true))
              .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(",") : v}`)
              .join(" · ")}
          </span>
        )}
      </div>
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      <AlertCircle className="h-5 w-5 flex-shrink-0" />
      <p className="flex-1">{message}</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-rose-100"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Reintentar
      </button>
    </div>
  );
}

/**
 * api.ts — Cliente HTTP para los API Routes de Next.js (mismo origen).
 *
 * Las URLs son RELATIVAS ("/api/...") — el frontend y el backend viven en
 * el mismo host tanto en dev (localhost:3000) como en prod (Hostinger).
 * Ya no hay FastAPI separado.
 */
import type { ChannelSale, DashboardCharts, DashboardFilters, KpiSummary, PickupWeekly, Prediction, StlySale } from "./types";

// Vacío: usa rutas relativas del mismo origen
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

/** Construye query string desde filtros. Omite valores null/undefined/vacíos. */
export function buildQueryString(filters: DashboardFilters): string {
  const params = new URLSearchParams();
  if (filters.year) params.append("year", String(filters.year));
  if (filters.months?.length) {
    for (const m of filters.months) params.append("months", m);
  }
  if (filters.start_date) params.append("start_date", filters.start_date);
  if (filters.end_date) params.append("end_date", filters.end_date);
  if (filters.channels?.length) {
    for (const c of filters.channels) params.append("channels", c);
  }
  if (filters.scenario) params.append("scenario", filters.scenario);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

async function httpJson<T>(url: string): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function fetchMetrics(filters: DashboardFilters): Promise<KpiSummary> {
  return httpJson<KpiSummary>(`/api/dashboard/metrics${buildQueryString(filters)}`);
}

export async function fetchCharts(filters: DashboardFilters): Promise<DashboardCharts> {
  return httpJson<DashboardCharts>(`/api/dashboard/charts${buildQueryString(filters)}`);
}

/** SWR key estable por filtros. */
export function metricsKey(filters: DashboardFilters) {
  return ["metrics", filters.year, filters.months, filters.start_date, filters.end_date, filters.channels, filters.scenario];
}

export function chartsKey(filters: DashboardFilters) {
  return ["charts", filters.year, filters.months, filters.start_date, filters.end_date, filters.channels, filters.scenario];
}

export function tendenciaKey(filters: DashboardFilters) {
  // La tabla comparativa SIEMPRE muestra los 4 años (2023..2026).
  // Solo depende del filtro de MES para resaltar.
  return ["tendencia", filters.months];
}

export interface TendenciaMensualResponse {
  anios: number[];
  data: Array<{
    mes: string;
    occ: Record<number, number | null>;
    adr: Record<number, number | null>;
    rev: Record<number, number | null>;
  }>;
  totales_por_anio: Record<number, { rev: number; adr: number; occ: number; meses: number }>;
  filtros_aplicados: DashboardFilters;
  fuente: string;
}

export async function fetchTendenciaMensual(
  filters: DashboardFilters
): Promise<TendenciaMensualResponse> {
  return httpJson<TendenciaMensualResponse>(
    `/api/dashboard/tendencia-mensual${buildQueryString(filters)}`
  );
}

export async function fetchPickupWeekly(params: { year?: number; mes?: string; limit?: number } = {}): Promise<PickupWeekly[]> {
  const qp = new URLSearchParams();
  if (params.year) qp.append("year", String(params.year));
  if (params.mes) qp.append("mes", params.mes);
  if (params.limit) qp.append("limit", String(params.limit));
  const qs = qp.toString();
  return httpJson<PickupWeekly[]>(`/api/pickup${qs ? `?${qs}` : ""}`);
}

export async function fetchStly(params: { year?: number; mes?: string; channel_id?: number; limit?: number } = {}): Promise<StlySale[]> {
  const qp = new URLSearchParams();
  if (params.year) qp.append("year", String(params.year));
  if (params.mes) qp.append("mes", params.mes);
  if (params.channel_id) qp.append("channel_id", String(params.channel_id));
  if (params.limit) qp.append("limit", String(params.limit));
  const qs = qp.toString();
  return httpJson<StlySale[]>(`/api/stly${qs ? `?${qs}` : ""}`);
}

export async function fetchChannelSales(params: { year?: number; mes?: string; channel_id?: number; limit?: number } = {}): Promise<ChannelSale[]> {
  const qp = new URLSearchParams();
  if (params.year) qp.append("year", String(params.year));
  if (params.mes) qp.append("mes", params.mes);
  if (params.channel_id) qp.append("channel_id", String(params.channel_id));
  if (params.limit) qp.append("limit", String(params.limit));
  const qs = qp.toString();
  return httpJson<ChannelSale[]>(`/api/channel-sales${qs ? `?${qs}` : ""}`);
}

export async function fetchPredictions(params: { year?: number; scenarios?: string } = {}): Promise<Prediction[]> {
  const qp = new URLSearchParams();
  if (params.year) qp.append("year", String(params.year));
  if (params.scenarios) qp.append("scenarios", params.scenarios);
  const qs = qp.toString();
  return httpJson<Prediction[]>(`/api/predictions${qs ? `?${qs}` : ""}`);
}

/** Fetcher genérico para useSWR. */
export const swrFetcher = async <T>(url: string): Promise<T> => {
  return httpJson<T>(url);
};

/** Upload del Excel via FormData. */
export async function uploadExcel(file: File): Promise<{
  source_file: string;
  total_rows_inserted: number;
  total_rows_updated: number;
  total_rows_skipped: number;
  errors: string[];
  duration_seconds: number;
}> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/api/upload-excel`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Error ${res.status}: ${body}`);
  }
  return res.json();
}

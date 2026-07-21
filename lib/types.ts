/**
 * Tipos compartidos con el backend FastAPI.
 * Mantener sincronizados con backend/app/schemas.py.
 */

export interface Channel {
  id: number;
  name: string;
  display_name: string;
  category: "DIRECT" | "OTA" | "WHOLESALER" | "CORPORATE" | "OTHER";
  is_active: boolean;
  sort_order: number;
}

export interface DashboardFilters {
  year?: number;
  months?: string[];
  start_date?: string;
  end_date?: string;
  channels?: string[];
  scenario?: "OPTIMIST" | "BASE" | "PESSIMIST";
}

export interface KpiSummary {
  total_ingresos: number | string;
  adr_promedio: number | string;
  ocupacion_media_pct: number | string;
  rn_totales: number;
  rn_pickup_total: number;
  revenue_pickup_total: number | string;
  variacion_anual_pct: number | string | null;
  filtros_aplicados: DashboardFilters;
}

export interface OccAdrPoint {
  mes: string;
  occ_pct: number;
  adr: number;
  ingresos: number;
  rn: number;
}

export interface PickupPoint {
  fecha_reporte: string; // ISO date
  rn_pickup: number;
  revenue_pickup: number;
  occ_pickup_pp: number;
}

export interface ChannelMixSlice {
  canal: string;
  categoria: string;
  rn: number;
  revenue: number;
  participacion_pct: number;
}

export interface CurvaPickupPoint {
  semana_num: number;
  fecha_semana: string;
  rn_actual: number;
  rn_stly: number;
  delta_pct: number;
}

export interface DashboardCharts {
  occ_adr_series: OccAdrPoint[];
  pickup_series: PickupPoint[];
  channel_mix: ChannelMixSlice[];
  curva_pickup: CurvaPickupPoint[];
  filtros_aplicados: DashboardFilters;
}

export interface PickupWeekly {
  id: number;
  mes: string;
  anio: number;
  fecha_reporte: string;
  occ_base_pct: number | string;
  rn_base: number;
  ingresos: number | string;
  adr_base: number | string;
  occ_pickup_pp: number | string;
  rn_pickup: number;
  adr_pickup: number | string;
  revenue_pickup: number | string;
  source_file?: string | null;
}

export interface StlySale {
  id: number;
  semana_num: number;
  fecha_semana: string;
  mes: string;
  anio_mes: number;
  channel_id: number | null;
  rn: number;
  adr: number | string;
  rev: number | string;
  source_file?: string | null;
}

export interface ChannelSale {
  id: number;
  anio: number;
  mes: string;
  channel_id: number;
  rn_total: number;
  adr_promedio: number | string | null;
  revenue_total: number | string;
  channel_name?: string | null;
  channel_category?: string | null;
}

export interface Prediction {
  mes: string;
  anio: number;
  scenario: "OPTIMIST" | "BASE" | "PESSIMIST";
  occ_pct: number;
  adr: number;
  rn: number;
  rev: number;
}

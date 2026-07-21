"use client";

import { useState } from "react";
import { useFilters } from "@/lib/useFilters";
import { Calendar, Filter, X } from "lucide-react";
import { clsx } from "clsx";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const CANALES = [
  "Sitio web o motor de reservas",
  "Booking.com", "Expedia", "Airbnb (API)", "TripAdvisor - Eliminar",
  "OTA", "OTA Predeterminada",
  "Agencia de viajes", "Agencia de viajes por defecto",
  "Mayorista", "Mayorista por defecto",
  "Cliente corporativo", "Cliente corporativo predeterminado",
  "Muelle Bora Bora", "Friends & Family", "Sin reserva previa",
  "Instagram", "BotMaker", "BotMaker/ Instagram",
  "Correo Electrónico", "Teléfono", "Crisp desde abril",
  "Zenvia", "Zenvia/ Crisp desde abril",
];

const YEARS = [2023, 2024, 2025, 2026, 2027];

export function FiltersBar() {
  const { filters, setFilter, toggleArrayValue, reset } = useFilters();
  const [openMonth, setOpenMonth] = useState(false);
  const [openChannel, setOpenChannel] = useState(false);

  const hasFilters =
    !!filters.year ||
    !!filters.months?.length ||
    !!filters.start_date ||
    !!filters.end_date ||
    !!filters.channels?.length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Filter className="h-4 w-4" />
          Filtros
        </div>

        {/* Año */}
        <Select
          label="Año"
          value={filters.year?.toString() ?? ""}
          onChange={(v) => setFilter("year", v ? Number(v) : undefined)}
          options={YEARS.map((y) => ({ value: String(y), label: String(y) }))}
          placeholder="Todos"
        />

        {/* Meses (multi) */}
        <MultiSelect
          label="Meses"
          options={MESES}
          selected={filters.months ?? []}
          onToggle={(v) => toggleArrayValue("months", v)}
          open={openMonth}
          setOpen={setOpenMonth}
        />

        {/* Canales (multi) */}
        <MultiSelect
          label="Canales"
          options={CANALES}
          selected={filters.channels ?? []}
          onToggle={(v) => toggleArrayValue("channels", v)}
          open={openChannel}
          setOpen={setOpenChannel}
        />

        {/* Rango fechas */}
        <DateInput
          label="Desde"
          value={filters.start_date}
          onChange={(v) => setFilter("start_date", v)}
        />
        <DateInput
          label="Hasta"
          value={filters.end_date}
          onChange={(v) => setFilter("end_date", v)}
        />

        {hasFilters && (
          <button
            onClick={reset}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            <X className="h-4 w-4" /> Limpiar
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Subcomponentes
// =============================================================================

function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function MultiSelect({
  label,
  options,
  selected,
  onToggle,
  open,
  setOpen,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  open: boolean;
  setOpen: (b: boolean) => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={clsx(
          "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm transition",
          selected.length > 0
            ? "border-brand-500 bg-brand-50 text-brand-700"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
        )}
      >
        {label}
        {selected.length > 0 && (
          <span className="ml-1 rounded-full bg-brand-600 px-2 text-xs font-semibold text-white">
            {selected.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 max-h-72 w-64 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
            {options.map((opt) => {
              const isSelected = selected.includes(opt);
              return (
                <label
                  key={opt}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(opt)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className={clsx(isSelected && "font-medium text-brand-700")}>
                    {opt}
                  </span>
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Calendar className="h-4 w-4 text-slate-400" />
      <span className="text-slate-500">{label}:</span>
      <input
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </label>
  );
}

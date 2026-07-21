"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { DashboardFilters } from "./types";

/**
 * useFilters — sincroniza los filtros del dashboard con la URL (search params).
 *
 * Beneficios:
 *  - El estado sobrevive a F5.
 *  - El link del dashboard es compartible ("mándame la URL con Ene-Feb 2026").
 *  - El componente es declarativo: deriva el state desde la URL.
 */
export function useFilters(): {
  filters: DashboardFilters;
  setFilter: <K extends keyof DashboardFilters>(
    key: K,
    value: DashboardFilters[K]
  ) => void;
  toggleArrayValue: (key: "months" | "channels", value: string) => void;
  reset: () => void;
} {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters: DashboardFilters = useMemo(() => {
    const year = searchParams.get("year");
    const months = searchParams.getAll("months");
    const start = searchParams.get("start_date");
    const end = searchParams.get("end_date");
    const channels = searchParams.getAll("channels");
    const scenario = searchParams.get("scenario");
    return {
      year: year ? Number(year) : undefined,
      months: months.length ? months : undefined,
      start_date: start || undefined,
      end_date: end || undefined,
      channels: channels.length ? channels : undefined,
      scenario:
        scenario === "OPTIMIST" || scenario === "BASE" || scenario === "PESSIMIST"
          ? scenario
          : undefined,
    };
  }, [searchParams]);

  const setFilter = useCallback(
    <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
        params.delete(key as string);
        if (key === "year" || key === "start_date" || key === "end_date" || key === "scenario") {
          params.delete(key as string);
        } else {
          params.delete(key as string);
        }
      } else if (Array.isArray(value)) {
        params.delete(key as string);
        for (const v of value) params.append(key as string, String(v));
      } else {
        params.set(key as string, String(value));
      }
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const toggleArrayValue = useCallback(
    (key: "months" | "channels", value: string) => {
      const current = filters[key] ?? [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      setFilter(key, next as DashboardFilters[typeof key]);
    },
    [filters, setFilter]
  );

  const reset = useCallback(() => {
    router.replace("?", { scroll: false });
  }, [router]);

  return { filters, setFilter, toggleArrayValue, reset };
}

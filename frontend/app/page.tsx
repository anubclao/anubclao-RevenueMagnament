import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Upload,
  FileSpreadsheet,
  History,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

const TILES = [
  {
    href: "/dashboard",
    title: "Dashboard",
    desc: "KPIs, gráficos sincronizados con filtros segmentadores.",
    icon: BarChart3,
    iconColor: "text-brand-600",
    hoverBorder: "hover:border-brand-400",
    cta: "text-brand-700",
  },
  {
    href: "/upload",
    title: "Cargar Excel",
    desc: "Sube el informe mensual (.xlsx). Procesamiento automático con Pandas.",
    icon: Upload,
    iconColor: "text-sea-600",
    hoverBorder: "hover:border-sea-400",
    cta: "text-sea-600",
  },
  {
    href: "/pickup",
    title: "DB_PU_WEEK",
    desc: "Pickup semanal: 12 meses × 25 semanas con OCC base, RN base, ADR y delta de pickup.",
    icon: FileSpreadsheet,
    iconColor: "text-coral-500",
    hoverBorder: "hover:border-coral-500",
    cta: "text-coral-600",
  },
  {
    href: "/stly",
    title: "STLY",
    desc: "Ventas históricas (2024-2026) por canal y semana. Compara año actual vs histórico.",
    icon: History,
    iconColor: "text-violet-600",
    hoverBorder: "hover:border-violet-400",
    cta: "text-violet-700",
  },
  {
    href: "/channels-sales",
    title: "Venta por canal",
    desc: "Mix mensual por canal (Booking, Sitio web, OTAs, etc.) con RN, ADR promedio y revenue.",
    icon: ShoppingBag,
    iconColor: "text-emerald-600",
    hoverBorder: "hover:border-emerald-400",
    cta: "text-emerald-700",
  },
  {
    href: "/predictions",
    title: "Predicciones",
    desc: "Proyecciones anuales (derivadas de los datos, no del Excel) con escenarios Optimista / Base / Pesimista.",
    icon: Sparkles,
    iconColor: "text-amber-600",
    hoverBorder: "hover:border-amber-400",
    cta: "text-amber-700",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <header className="mb-12">
        <p className="text-sm uppercase tracking-widest text-brand-600 font-semibold">
          Hotel Bora Bora
        </p>
        <h1 className="mt-2 text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
          Revenue Management
        </h1>
        <p className="mt-4 text-lg text-slate-600 max-w-2xl">
          Plataforma de análisis de pickup semanal, comparativa STLY y mix de
          canales para el hotel. Datos en tiempo real desde MySQL.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {TILES.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`group rounded-2xl border border-slate-200 bg-white p-6 transition ${t.hoverBorder} hover:shadow-md`}
          >
            <t.icon className={`h-8 w-8 ${t.iconColor}`} />
            <h2 className="mt-4 text-xl font-semibold">{t.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{t.desc}</p>
            <span className={`mt-4 inline-flex items-center text-sm font-medium ${t.cta} group-hover:gap-2 transition-all`}>
              Entrar <ArrowRight className="ml-1 h-4 w-4" />
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}

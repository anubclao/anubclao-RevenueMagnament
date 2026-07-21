"use client";

import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.name.endsWith(".xlsx")) {
      setFile(dropped);
      setError(null);
    } else {
      setError("Solo se aceptan archivos .xlsx");
    }
  }, []);

  const onSubmit = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("uploaded_by", "admin");
      const res = await fetch(`${API_BASE}/api/upload-excel`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Error ${res.status}: ${body}`);
      }
      setResult(await res.json());
    } catch (e: any) {
      setError(e.message ?? "Error desconocido");
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ChevronLeft className="h-4 w-4" /> Inicio
      </Link>
      <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-900">
        <Upload className="h-6 w-6 text-sea-600" /> Cargar Informe Excel
      </h1>
      <p className="text-sm text-slate-500">
        Sube el archivo .xlsx del informe mensual. El sistema procesa automáticamente
        las hojas <code>DB_PU_WEEK</code>, <code>STLY</code> y <code>Venta por canal</code>.
      </p>

      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        className={`mt-8 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 text-center transition ${
          dragOver ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-white"
        }`}
      >
        <FileSpreadsheet className="h-12 w-12 text-slate-400" />
        <p className="mt-3 text-sm text-slate-600">
          Arrastra y suelta el archivo aquí, o
        </p>
        <label className="mt-2 inline-flex cursor-pointer rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Seleccionar archivo
          <input
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setFile(f);
                setError(null);
              }
            }}
          />
        </label>
        {file && (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-700">
            <FileSpreadsheet className="h-4 w-4" />
            {file.name} <span className="text-slate-400">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
          </div>
        )}
      </div>

      {file && (
        <button
          onClick={onSubmit}
          disabled={uploading}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-sea-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sea-500 disabled:opacity-50"
        >
          {uploading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Procesando...</>
          ) : (
            <><Upload className="h-4 w-4" /> Subir y procesar</>
          )}
        </button>
      )}

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="h-5 w-5" /> {error}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-5 w-5" />
            Procesamiento completo en {result.duration_seconds}s
          </div>
          <ul className="mt-2 space-y-1 text-xs">
            <li>Hojas procesadas: <strong>{result.sheets_processed.join(", ")}</strong></li>
            <li>Filas insertadas: <strong>{result.total_rows_inserted.toLocaleString("es-CO")}</strong></li>
            <li>Filas actualizadas: <strong>{result.total_rows_updated.toLocaleString("es-CO")}</strong></li>
            <li>Filas omitidas: <strong>{result.total_rows_skipped.toLocaleString("es-CO")}</strong></li>
          </ul>
        </div>
      )}
    </main>
  );
}

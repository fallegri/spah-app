"use client";

import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

type UploadType = "catalogo" | "espacios" | "habilitacion" | "disponibilidad";

interface UploadResult {
  ok: boolean;
  total?: number;
  errores?: string[];
  advertencias?: string[];
  resultados?: any[];
  docentesCreados?: number;
  habilitaciones?: number;
}

export default function CargaPage() {
  const [loading, setLoading] = useState<UploadType | null>(null);
  const [results, setResults] = useState<Record<string, UploadResult>>({});
  const [gestion, setGestion] = useState("2026-II");

  const handleUpload = async (type: UploadType, files: FileList | null) => {
    if (!files || files.length === 0) return;

    setLoading(type);
    const formData = new FormData();
    formData.append("type", type);
    formData.append("gestion", gestion);

    if (type === "disponibilidad") {
      for (const file of Array.from(files)) {
        formData.append("files", file);
      }
    } else {
      formData.append("file", files[0]);
    }

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      setResults((prev) => ({ ...prev, [type]: data }));
    } catch (error: any) {
      setResults((prev) => ({
        ...prev,
        [type]: { ok: false, errores: [error.message] },
      }));
    } finally {
      setLoading(null);
    }
  };

  const cards: { type: UploadType; title: string; desc: string; multi?: boolean }[] = [
    { type: "catalogo", title: "Catalogo de materias", desc: "Oferta academica de la gestion (Excel)" },
    { type: "espacios", title: "Espacios y aforo", desc: "Aulas, talleres y laboratorios (Excel)" },
    { type: "habilitacion", title: "Materias habilitadas", desc: "Consolidado CI + materia + carrera" },
    { type: "disponibilidad", title: "Disponibilidad docente", desc: "Un archivo por docente (multiples)", multi: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Carga de datos</h1>
          <p className="text-gray-400 mt-1">Sube los archivos Excel para la gestion actual</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">Gestion:</label>
          <input
            type="text"
            value={gestion}
            onChange={(e) => setGestion(e.target.value)}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white w-24"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((card) => (
          <UploadCard
            key={card.type}
            type={card.type}
            title={card.title}
            description={card.desc}
            multiple={card.multi}
            loading={loading === card.type}
            result={results[card.type]}
            onUpload={(files) => handleUpload(card.type, files)}
          />
        ))}
      </div>
    </div>
  );
}

function UploadCard({
  type,
  title,
  description,
  multiple,
  loading,
  result,
  onUpload,
}: {
  type: string;
  title: string;
  description: string;
  multiple?: boolean;
  loading: boolean;
  result?: UploadResult;
  onUpload: (files: FileList | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 bg-blue-600/10 rounded-lg flex items-center justify-center shrink-0">
          <FileSpreadsheet className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="font-medium text-white">{title}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        multiple={multiple}
        className="hidden"
        onChange={(e) => onUpload(e.target.files)}
      />

      <button
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="w-full py-3 border-2 border-dashed border-gray-700 rounded-lg text-sm text-gray-400 hover:border-blue-500 hover:text-blue-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
        ) : (
          <><Upload className="w-4 h-4" /> Seleccionar archivo{multiple ? "s" : ""}</>
        )}
      </button>

      {/* Result */}
      {result && (
        <div className={`mt-3 p-3 rounded-lg text-xs ${result.ok ? "bg-emerald-900/20 border border-emerald-800" : "bg-red-900/20 border border-red-800"}`}>
          <div className="flex items-center gap-1.5">
            {result.ok ? (
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-red-400" />
            )}
            <span className={result.ok ? "text-emerald-300" : "text-red-300"}>
              {result.ok
                ? `Cargado: ${result.total || result.habilitaciones || result.resultados?.length || 0} registros`
                : `Error: ${result.errores?.[0] || "Desconocido"}`}
            </span>
          </div>
          {result.advertencias && result.advertencias.length > 0 && (
            <details className="mt-2">
              <summary className="text-amber-400 cursor-pointer">
                {result.advertencias.length} advertencias
              </summary>
              <ul className="mt-1 space-y-0.5 text-gray-400 max-h-32 overflow-y-auto">
                {result.advertencias.map((a, i) => (
                  <li key={i}>- {a}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { X, Eye } from "lucide-react";

interface DocenteRow {
  id: number;
  ci: string;
  nombre: string;
  profesion: string;
  telefono: string;
  slots: number;
  habs: number;
}

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const SLOTS = ["07:45","08:30","09:15","10:00","10:45","11:30","12:15","13:00","13:45","14:30","15:15","16:00","16:45","17:30","18:15","19:00","19:45","20:30","21:15","22:00"];

export function DocentesClient({ docentes }: { docentes: DocenteRow[] }) {
  const [selectedDocente, setSelectedDocente] = useState<DocenteRow | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Docentes</h1>
          <p className="text-gray-400 mt-1">{docentes.length} docentes registrados</p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">CI</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Profesion</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Telefono</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Slots disponibles</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Materias</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Estado</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {docentes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No hay docentes cargados. Sube los archivos de disponibilidad y habilitacion.
                  </td>
                </tr>
              ) : (
                docentes.map((doc) => {
                  const estado = doc.slots > 0 && doc.habs > 0 ? "completo" : doc.slots > 0 ? "sin habilitacion" : doc.habs > 0 ? "sin disponibilidad" : "incompleto";

                  return (
                    <tr key={doc.id} className="hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-gray-300 font-mono text-xs">{doc.ci}</td>
                      <td className="px-4 py-3 text-white">{doc.nombre}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{doc.profesion || "\u2014"}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{doc.telefono || "\u2014"}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-semibold ${doc.slots > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {doc.slots}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-semibold ${doc.habs > 0 ? "text-blue-400" : "text-red-400"}`}>
                          {doc.habs}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          estado === "completo"
                            ? "bg-emerald-900/30 text-emerald-400"
                            : estado === "incompleto"
                            ? "bg-red-900/30 text-red-400"
                            : "bg-amber-900/30 text-amber-400"
                        }`}>
                          {estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setSelectedDocente(doc)}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-800/50 text-blue-400 rounded text-xs transition-colors"
                        >
                          <Eye className="w-3 h-3" /> Ver disponibilidad
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de disponibilidad */}
      {selectedDocente && (
        <DisponibilidadModal docente={selectedDocente} onClose={() => setSelectedDocente(null)} />
      )}
    </div>
  );
}

// ─── MODAL DE DISPONIBILIDAD ────────────────────────────────────────────────

function DisponibilidadModal({ docente, onClose }: { docente: DocenteRow; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [disponibilidad, setDisponibilidad] = useState<{ dia: string; slot: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/docentes/disponibilidad?id=${docente.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setDisponibilidad(data.disponibilidad || []);
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [docente.id]);

  const isAvailable = (dia: string, slot: string) =>
    disponibilidad.some((d) => d.dia === dia && d.slot === slot);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-5xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <h3 className="text-base font-bold text-white">{docente.nombre}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              CI: {docente.ci} &middot; {docente.slots} slots disponibles &middot; {docente.habs} materias habilitadas
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Grid */}
        <div className="p-5">
          {loading && <p className="text-center text-gray-400 py-8">Cargando disponibilidad...</p>}
          {error && <p className="text-center text-red-400 py-8">{error}</p>}
          {!loading && !error && (
            <>
              <div className="flex items-center gap-4 mb-4 text-xs text-gray-400">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-emerald-600/60 border border-emerald-500/30" />
                  <span>Disponible</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-gray-800 border border-gray-700" />
                  <span>No disponible</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="px-2 py-2 text-xs text-gray-500 font-medium w-16 text-left">Hora</th>
                      {DIAS.map((d) => (
                        <th key={d} className="px-1 py-2 text-xs text-gray-400 font-medium text-center min-w-[70px]">{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SLOTS.map((slot) => (
                      <tr key={slot}>
                        <td className="px-2 py-0.5 text-[11px] text-gray-600 font-mono">{slot}</td>
                        {DIAS.map((dia) => (
                          <td key={`${dia}|${slot}`} className="px-0.5 py-0.5 text-center">
                            <div className={`w-full h-5 rounded transition-colors ${
                              isAvailable(dia, slot)
                                ? "bg-emerald-600/60 border border-emerald-500/30"
                                : "bg-gray-800 border border-gray-700/50"
                            }`} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {disponibilidad.length === 0 && (
                <p className="text-center text-amber-400 mt-4 text-sm">
                  Este docente no tiene disponibilidad cargada.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

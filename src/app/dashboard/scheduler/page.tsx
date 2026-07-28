"use client";

import { useState } from "react";
import { Play, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import type { SchedulerConfig } from "@/types/scheduler";
import { DEFAULT_CONFIG } from "@/types/scheduler";

export default function SchedulerPage() {
  const [config, setConfig] = useState<SchedulerConfig>(DEFAULT_CONFIG);
  const [gestion, setGestion] = useState("2026-II");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const handleRun = async () => {
    setRunning(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/scheduler/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, gestion }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data.resultado);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Ejecutar Scheduler</h1>
        <p className="text-gray-400 mt-1">Configura y ejecuta el algoritmo de asignacion</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config Panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4">Parametros del algoritmo</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Gestion</label>
                <input
                  type="text"
                  value={gestion}
                  onChange={(e) => setGestion(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Max backtracking</label>
                <input
                  type="number"
                  value={config.maxBacktrack}
                  onChange={(e) => setConfig({ ...config, maxBacktrack: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Max periodos/sesion Taller</label>
                <select
                  value={config.maxPerSesionTaller}
                  onChange={(e) => setConfig({ ...config, maxPerSesionTaller: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                >
                  {[4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>{n} periodos ({(n * 45 / 60).toFixed(0)}h{(n * 45) % 60 > 0 ? (n * 45) % 60 : ""})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Max periodos/sesion Lab</label>
                <select
                  value={config.maxPerSesionLab}
                  onChange={(e) => setConfig({ ...config, maxPerSesionLab: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                >
                  {[4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>{n} periodos</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.permitirAIR}
                  onChange={(e) => setConfig({ ...config, permitirAIR: e.target.checked })}
                  className="rounded border-gray-600 bg-gray-800 text-blue-500"
                />
                <span className="text-sm text-gray-300">Usar AIR si no hay espacio</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.permitirSinDocente}
                  onChange={(e) => setConfig({ ...config, permitirSinDocente: e.target.checked })}
                  className="rounded border-gray-600 bg-gray-800 text-blue-500"
                />
                <span className="text-sm text-gray-300">Usar "Sin Docente"</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.distribucionNoContigua}
                  onChange={(e) => setConfig({ ...config, distribucionNoContigua: e.target.checked })}
                  className="rounded border-gray-600 bg-gray-800 text-blue-500"
                />
                <span className="text-sm text-gray-300">Distribucion no contigua</span>
              </label>
            </div>

            <div className="mt-4">
              <p className="text-xs text-gray-400 mb-2">Sabado habilitado:</p>
              <div className="flex gap-4">
                {(["sabadoManana", "sabadoTarde", "sabadoNoche"] as const).map((key) => (
                  <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config[key]}
                      onChange={(e) => setConfig({ ...config, [key]: e.target.checked })}
                      className="rounded border-gray-600 bg-gray-800 text-blue-500"
                    />
                    <span className="text-xs text-gray-300">
                      {key.replace("sabado", "")}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Run Button */}
          <button
            onClick={handleRun}
            disabled={running}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-lg"
          >
            {running ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Ejecutando algoritmo...</>
            ) : (
              <><Play className="w-5 h-5" /> Ejecutar Scheduler</>
            )}
          </button>
        </div>

        {/* Results Panel */}
        <div className="space-y-4">
          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">Error</span>
              </div>
              <p className="text-xs text-red-300 mt-2">{error}</p>
            </div>
          )}

          {result && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold text-white">Ejecucion completada</h3>
              </div>

              <div className="space-y-3">
                <StatRow label="Asignadas" value={result.totalAsignadas} color="text-emerald-400" />
                <StatRow label="Conflictos" value={result.totalConflictos} color="text-red-400" />
                <StatRow label="AIR (sin espacio)" value={result.totalAIR} color="text-amber-400" />
                <StatRow label="Sin docente" value={result.totalSinDocente} color="text-orange-400" />
                <StatRow label="Duracion" value={`${result.duracionMs}ms`} color="text-gray-300" />
              </div>

              <a
                href="/dashboard/resultados"
                className="mt-4 block text-center py-2 bg-gray-800 rounded-lg text-sm text-blue-400 hover:bg-gray-750"
              >
                Ver resultados completos
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-800">
      <span className="text-sm text-gray-400">{label}</span>
      <span className={`text-sm font-semibold ${color}`}>{value}</span>
    </div>
  );
}

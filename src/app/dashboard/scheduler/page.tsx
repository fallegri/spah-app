"use client";

import { useState } from "react";
import { Play, Loader2, CheckCircle, AlertTriangle, Cpu, Zap, Dna } from "lucide-react";
import type { SchedulerConfig, AlgoritmoScheduler } from "@/types/scheduler";
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

  const algoritmos: { value: AlgoritmoScheduler; label: string; desc: string; icon: typeof Cpu }[] = [
    { value: "iterativo", label: "Iterativo", desc: "Primer match valido con fallbacks en cascada", icon: Cpu },
    { value: "greedy", label: "Greedy con Scoring", desc: "Evalua todas las opciones y elige la mejor puntuada", icon: Zap },
    { value: "genetico", label: "Genetico", desc: "Genera poblaciones, cruza y muta para optimizar", icon: Dna },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Ejecutar Scheduler</h1>
        <p className="text-gray-400 mt-1">Configura y ejecuta el algoritmo de asignacion</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Algorithm Selector */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4">Algoritmo de asignacion</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {algoritmos.map(({ value, label, desc, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setConfig({ ...config, algoritmo: value })}
                  className={`flex flex-col items-start gap-2 p-4 rounded-lg border transition-all text-left ${
                    config.algoritmo === value
                      ? "border-blue-500 bg-blue-900/20 ring-1 ring-blue-500/50"
                      : "border-gray-700 bg-gray-800 hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${config.algoritmo === value ? "text-blue-400" : "text-gray-400"}`} />
                    <span className={`text-sm font-medium ${config.algoritmo === value ? "text-blue-300" : "text-gray-200"}`}>
                      {label}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-tight">{desc}</p>
                </button>
              ))}
            </div>

            {/* Genetic algorithm params - only shown when genetico is selected */}
            {config.algoritmo === "genetico" && (
              <div className="mt-4 p-4 bg-gray-800/50 border border-gray-700 rounded-lg space-y-4">
                <h3 className="text-sm font-medium text-purple-300">Parametros del algoritmo genetico</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Poblacion: <span className="text-white font-medium">{config.genetico_poblacion}</span>
                    </label>
                    <input
                      type="range"
                      min={20}
                      max={200}
                      step={10}
                      value={config.genetico_poblacion}
                      onChange={(e) => setConfig({ ...config, genetico_poblacion: parseInt(e.target.value) })}
                      className="w-full accent-purple-500"
                    />
                    <div className="flex justify-between text-[10px] text-gray-600">
                      <span>20</span><span>200</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Generaciones: <span className="text-white font-medium">{config.genetico_generaciones}</span>
                    </label>
                    <input
                      type="range"
                      min={50}
                      max={500}
                      step={25}
                      value={config.genetico_generaciones}
                      onChange={(e) => setConfig({ ...config, genetico_generaciones: parseInt(e.target.value) })}
                      className="w-full accent-purple-500"
                    />
                    <div className="flex justify-between text-[10px] text-gray-600">
                      <span>50</span><span>500</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Tasa de mutacion: <span className="text-white font-medium">{config.genetico_mutacion.toFixed(2)}</span>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={50}
                      step={1}
                      value={Math.round(config.genetico_mutacion * 100)}
                      onChange={(e) => setConfig({ ...config, genetico_mutacion: parseInt(e.target.value) / 100 })}
                      className="w-full accent-purple-500"
                    />
                    <div className="flex justify-between text-[10px] text-gray-600">
                      <span>0.01</span><span>0.50</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4">Parametros generales</h2>

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

"use client";

import { useState } from "react";
import { Download, Calendar, AlertTriangle, Users, Filter } from "lucide-react";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const SLOTS = ["07:45","08:30","09:15","10:00","10:45","11:30","12:15","13:00","13:45","14:30","15:15","16:00","16:45","17:30","18:15","19:00","19:45","20:30","21:15","22:00","22:45"];

interface Asig {
  id: number; materiaCodigo: string; materiaNombre: string; grupoCodigo: string;
  carrera: string; semestre: string; docenteNombre: string; espacioCodigo: string;
  dia: string; slots: string[]; turno: string; tipoEspacio: string | null;
  esAIR: boolean; esSinDocente: boolean;
}

interface Props {
  data: {
    ejecucion: { id: number; gestion: string; totalAsignadas: number; totalConflictos: number; totalAIR: number; totalSinDocente: number; duracionMs: number; createdAt: string };
    asignaciones: Asig[];
    conflictos: { id: number; materiaCodigo: string; materiaNombre: string; grupoCodigo: string; carrera: string; semestre: string; motivo: string }[];
  };
}

export function ResultsClient({ data }: Props) {
  const { ejecucion, asignaciones, conflictos } = data;
  const [filterCarrera, setFilterCarrera] = useState("todas");
  const [filterTurno, setFilterTurno] = useState("todos");
  const [tab, setTab] = useState<"grilla" | "lista" | "conflictos">("grilla");

  const carreras = [...new Set(asignaciones.map((a) => a.carrera))].sort();
  const filtered = asignaciones.filter((a) => {
    if (filterCarrera !== "todas" && a.carrera !== filterCarrera) return false;
    if (filterTurno !== "todos" && a.turno !== filterTurno) return false;
    return true;
  });

  const handleExport = () => {
    window.open(`/api/export?id=${ejecucion.id}`, "_blank");
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Horario Generado</h1>
          <p className="text-gray-400 text-sm mt-1">
            Ejecucion #{ejecucion.id} · {new Date(ejecucion.createdAt).toLocaleString("es")} · {ejecucion.gestion}
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm text-white"
        >
          <Download className="w-4 h-4" /> Descargar Excel
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        <Stat label="Asignadas" value={ejecucion.totalAsignadas} color="emerald" />
        <Stat label="Conflictos" value={ejecucion.totalConflictos} color="red" />
        <Stat label="AIR" value={ejecucion.totalAIR} color="amber" />
        <Stat label="Sin docente" value={ejecucion.totalSinDocente} color="orange" />
        <Stat label="Duracion" value={`${ejecucion.duracionMs}ms`} color="blue" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-800 pb-0">
        {([["grilla", "Grilla horaria", Calendar], ["lista", "Lista completa", Users], ["conflictos", "Conflictos", AlertTriangle]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 transition-colors ${
              tab === key ? "border-blue-500 text-blue-400" : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
            {key === "conflictos" && conflictos.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-red-600 text-white text-[10px] rounded-full">{conflictos.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      {tab !== "conflictos" && (
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <select value={filterCarrera} onChange={(e) => setFilterCarrera(e.target.value)} className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white">
            <option value="todas">Todas las carreras</option>
            {carreras.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterTurno} onChange={(e) => setFilterTurno(e.target.value)} className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white">
            <option value="todos">Todos los turnos</option>
            <option value="Mañana">Mañana</option>
            <option value="Tarde">Tarde</option>
            <option value="Noche">Noche</option>
          </select>
          <span className="text-xs text-gray-500">{filtered.length} sesiones</span>
        </div>
      )}

      {/* Content */}
      {tab === "grilla" && <GridView asignaciones={filtered} />}
      {tab === "lista" && <ListView asignaciones={filtered} />}
      {tab === "conflictos" && <ConflictosView conflictos={conflictos} />}
    </div>
  );
}

function GridView({ asignaciones }: { asignaciones: Asig[] }) {
  const getAsigAt = (dia: string, slot: string) =>
    asignaciones.filter((a) => a.dia === dia && a.slots.includes(slot));

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="px-2 py-2 text-left text-gray-500 font-medium w-16">Hora</th>
            {DIAS.map((d) => <th key={d} className="px-2 py-2 text-center text-gray-400 font-medium">{d.slice(0, 3)}</th>)}
          </tr>
        </thead>
        <tbody>
          {SLOTS.map((slot, idx) => (
            <tr key={slot} className={idx === 7 || idx === 14 ? "border-t-2 border-gray-700" : ""}>
              <td className="px-2 py-1 text-gray-600 font-mono text-[10px] align-top">{slot}</td>
              {DIAS.map((dia) => {
                const cells = getAsigAt(dia, slot);
                return (
                  <td key={`${dia}-${slot}`} className="px-0.5 py-0.5 align-top">
                    {cells.map((a) => (
                      <div
                        key={a.id}
                        className={`px-1.5 py-1 rounded text-[10px] leading-tight mb-0.5 ${
                          a.esAIR ? "bg-amber-900/30 border border-amber-700 text-amber-300" :
                          a.esSinDocente ? "bg-orange-900/30 border border-orange-700 text-orange-300" :
                          a.tipoEspacio === "LABORATORIO" ? "bg-blue-900/30 border border-blue-800 text-blue-300" :
                          a.tipoEspacio === "TALLER" ? "bg-purple-900/30 border border-purple-800 text-purple-300" :
                          "bg-gray-800 border border-gray-700 text-gray-300"
                        }`}
                        title={`${a.materiaNombre}\n${a.docenteNombre}\n${a.espacioCodigo}`}
                      >
                        <div className="font-semibold truncate">{a.materiaCodigo}</div>
                        <div className="text-[9px] opacity-75 truncate">{a.espacioCodigo}</div>
                      </div>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListView({ asignaciones }: { asignaciones: Asig[] }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-800/50 border-b border-gray-800">
            <th className="px-3 py-2.5 text-left text-gray-400">Codigo</th>
            <th className="px-3 py-2.5 text-left text-gray-400">Materia</th>
            <th className="px-3 py-2.5 text-left text-gray-400">Grupo</th>
            <th className="px-3 py-2.5 text-left text-gray-400">Docente</th>
            <th className="px-3 py-2.5 text-left text-gray-400">Espacio</th>
            <th className="px-3 py-2.5 text-left text-gray-400">Dia</th>
            <th className="px-3 py-2.5 text-left text-gray-400">Horario</th>
            <th className="px-3 py-2.5 text-left text-gray-400">Notas</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {asignaciones.map((a) => (
            <tr key={a.id} className="hover:bg-gray-800/50">
              <td className="px-3 py-2 font-mono text-blue-400">{a.materiaCodigo}</td>
              <td className="px-3 py-2 text-white max-w-[180px] truncate">{a.materiaNombre}</td>
              <td className="px-3 py-2 text-gray-300">{a.grupoCodigo}</td>
              <td className="px-3 py-2 text-gray-300 max-w-[150px] truncate">{a.docenteNombre}</td>
              <td className="px-3 py-2 text-gray-400 font-mono">{a.espacioCodigo}</td>
              <td className="px-3 py-2 text-gray-300">{a.dia}</td>
              <td className="px-3 py-2 text-gray-400 font-mono">{a.slots[0]}-{a.slots[a.slots.length - 1]}</td>
              <td className="px-3 py-2">
                {a.esAIR && <span className="px-1.5 py-0.5 bg-amber-900/30 text-amber-400 rounded text-[10px]">AIR</span>}
                {a.esSinDocente && <span className="px-1.5 py-0.5 bg-orange-900/30 text-orange-400 rounded text-[10px] ml-1">Sin Doc</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConflictosView({ conflictos }: { conflictos: Props["data"]["conflictos"] }) {
  if (conflictos.length === 0) {
    return (
      <div className="bg-emerald-900/10 border border-emerald-800 rounded-xl p-8 text-center">
        <p className="text-emerald-400 font-medium">Sin conflictos</p>
        <p className="text-sm text-gray-400 mt-1">Todas las sesiones fueron asignadas exitosamente.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-red-900/10 border-b border-gray-800">
            <th className="px-3 py-2.5 text-left text-gray-400">Codigo</th>
            <th className="px-3 py-2.5 text-left text-gray-400">Materia</th>
            <th className="px-3 py-2.5 text-left text-gray-400">Grupo</th>
            <th className="px-3 py-2.5 text-left text-gray-400">Carrera</th>
            <th className="px-3 py-2.5 text-left text-gray-400">Motivo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {conflictos.map((c) => (
            <tr key={c.id} className="hover:bg-gray-800/50">
              <td className="px-3 py-2 font-mono text-red-400">{c.materiaCodigo}</td>
              <td className="px-3 py-2 text-white">{c.materiaNombre}</td>
              <td className="px-3 py-2 text-gray-300">{c.grupoCodigo}</td>
              <td className="px-3 py-2 text-gray-400 max-w-[150px] truncate">{c.carrera}</td>
              <td className="px-3 py-2 text-red-300">{c.motivo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: any; color: string }) {
  const colors: Record<string, string> = {
    emerald: "text-emerald-400 bg-emerald-900/10",
    red: "text-red-400 bg-red-900/10",
    amber: "text-amber-400 bg-amber-900/10",
    orange: "text-orange-400 bg-orange-900/10",
    blue: "text-blue-400 bg-blue-900/10",
  };
  const [textColor, bgColor] = (colors[color] || colors.blue).split(" ");
  return (
    <div className={`${bgColor} border border-gray-800 rounded-xl p-3`}>
      <p className="text-[10px] text-gray-400 uppercase">{label}</p>
      <p className={`text-lg font-bold ${textColor}`}>{value}</p>
    </div>
  );
}

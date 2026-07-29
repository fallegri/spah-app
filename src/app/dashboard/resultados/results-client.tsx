"use client";

import { useState, useEffect } from "react";
import { Download, Calendar, AlertTriangle, Building, GraduationCap, Filter, List, X } from "lucide-react";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const SLOTS = ["07:45","08:30","09:15","10:00","10:45","11:30","12:15","13:00","13:45","14:30","15:15","16:00","16:45","17:30","18:15","19:00","19:45","20:30","21:15","22:00","22:45"];

// Calculate end time: adds 45 minutes to a slot start time
function calcEndTime(slotStart: string): string {
  const [h, m] = slotStart.split(":").map(Number);
  const totalMin = h * 60 + m + 45;
  const eh = Math.floor(totalMin / 60);
  const em = totalMin % 60;
  return `${eh.toString().padStart(2, "0")}:${em.toString().padStart(2, "0")}`;
}

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
  const [tab, setTab] = useState<"semestre" | "espacio" | "lista" | "conflictos">("semestre");
  const [selectedCarrera, setSelectedCarrera] = useState("todas");
  const [selectedSemestre, setSelectedSemestre] = useState("todos");
  const [selectedEspacio, setSelectedEspacio] = useState("todos");
  const [docenteModal, setDocenteModal] = useState<string | null>(null);

  const carreras = [...new Set(asignaciones.map((a) => a.carrera))].sort();
  const semestres = [...new Set(asignaciones.map((a) => a.semestre))].sort();
  const espaciosUsados = [...new Set(asignaciones.map((a) => a.espacioCodigo))].sort();

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
        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm text-white">
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
      <div className="flex items-center gap-1 border-b border-gray-800">
        {([
          ["semestre", "Por Semestre", GraduationCap],
          ["espacio", "Por Espacio", Building],
          ["lista", "Lista completa", List],
          ["conflictos", "Conflictos", AlertTriangle],
        ] as const).map(([key, label, Icon]) => (
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

      {/* Tab Content */}
      {tab === "semestre" && (
        <SemestreView
          asignaciones={asignaciones}
          carreras={carreras}
          semestres={semestres}
          selectedCarrera={selectedCarrera}
          setSelectedCarrera={setSelectedCarrera}
          selectedSemestre={selectedSemestre}
          setSelectedSemestre={setSelectedSemestre}
          onDocenteClick={setDocenteModal}
        />
      )}
      {tab === "espacio" && (
        <EspacioView
          asignaciones={asignaciones}
          espacios={espaciosUsados}
          selectedEspacio={selectedEspacio}
          setSelectedEspacio={setSelectedEspacio}
        />
      )}
      {tab === "lista" && <ListView asignaciones={asignaciones} />}
      {tab === "conflictos" && <ConflictosView conflictos={conflictos} />}

      {/* Modal de disponibilidad docente */}
      {docenteModal && (
        <DocenteDisponibilidadModal nombre={docenteModal} onClose={() => setDocenteModal(null)} />
      )}
    </div>
  );
}

// ─── VIEW: POR SEMESTRE ─────────────────────────────────────────────────────

function SemestreView({
  asignaciones, carreras, semestres, selectedCarrera, setSelectedCarrera, selectedSemestre, setSelectedSemestre, onDocenteClick,
}: {
  asignaciones: Asig[]; carreras: string[]; semestres: string[];
  selectedCarrera: string; setSelectedCarrera: (v: string) => void;
  selectedSemestre: string; setSelectedSemestre: (v: string) => void;
  onDocenteClick?: (nombre: string) => void;
}) {
  // Filter
  let filtered = asignaciones;
  if (selectedCarrera !== "todas") filtered = filtered.filter((a) => a.carrera === selectedCarrera);
  if (selectedSemestre !== "todos") filtered = filtered.filter((a) => a.semestre === selectedSemestre);

  // Group by carrera + semestre + grupoCodigo (each student group gets its own grid)
  // Normalize grupoCodigo to handle inconsistencies in Excel data
  const groups = new Map<string, Asig[]>();
  for (const a of filtered) {
    const normalizedGrupo = a.grupoCodigo.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const key = `${a.carrera} — ${a.semestre}|${normalizedGrupo}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-gray-500" />
        <select value={selectedCarrera} onChange={(e) => setSelectedCarrera(e.target.value)} className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white">
          <option value="todas">Todas las carreras</option>
          {carreras.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={selectedSemestre} onChange={(e) => setSelectedSemestre(e.target.value)} className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white">
          <option value="todos">Todos los semestres</option>
          {semestres.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-xs text-gray-500">{filtered.length} sesiones en {groups.size} grupos</span>
      </div>

      {/* One grid per group */}
      {Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([groupKey, asigs]) => {
        const [carreraSemestre, grupoCodigo] = groupKey.split("|");
        return (
        <div key={groupKey} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white">{carreraSemestre}</h3>
            <p className="text-[11px] text-gray-400">{asigs.length} sesiones · Grupo: {grupoCodigo}</p>
          </div>
          <div className="p-3">
            <TimetableGrid asignaciones={asigs} showDocente={true} onDocenteClick={onDocenteClick} />
          </div>
        </div>
        );
      })}

      {groups.size === 0 && (
        <div className="text-center py-8 text-gray-500">No hay asignaciones con los filtros seleccionados.</div>
      )}
    </div>
  );
}

// ─── VIEW: POR ESPACIO ──────────────────────────────────────────────────────

function EspacioView({
  asignaciones, espacios, selectedEspacio, setSelectedEspacio,
}: {
  asignaciones: Asig[]; espacios: string[];
  selectedEspacio: string; setSelectedEspacio: (v: string) => void;
}) {
  // If "todos", show one grid per espacio
  const espaciosToShow = selectedEspacio === "todos" ? espacios : [selectedEspacio];

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <Building className="w-4 h-4 text-gray-500" />
        <select value={selectedEspacio} onChange={(e) => setSelectedEspacio(e.target.value)} className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white">
          <option value="todos">Todos los espacios ({espacios.length})</option>
          {espacios.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {/* One grid per espacio */}
      {espaciosToShow.map((espacio) => {
        const asigs = asignaciones.filter((a) => a.espacioCodigo === espacio);
        if (asigs.length === 0) return null;

        // Determine tipo from first assignment
        const tipo = asigs[0].tipoEspacio;
        const tipoColor = tipo === "LABORATORIO" ? "text-blue-400" : tipo === "TALLER" ? "text-purple-400" : "text-gray-300";

        return (
          <div key={espacio} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">{espacio}</h3>
                <p className="text-[11px] text-gray-400">{asigs.length} sesiones programadas</p>
              </div>
              <span className={`text-xs font-medium ${tipoColor}`}>{tipo}</span>
            </div>
            <div className="p-3">
              <TimetableGrid asignaciones={asigs} showDocente={false} showCarrera={true} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── SHARED TIMETABLE GRID ──────────────────────────────────────────────────

function TimetableGrid({ asignaciones, showDocente = false, showCarrera = false, onDocenteClick }: { asignaciones: Asig[]; showDocente?: boolean; showCarrera?: boolean; onDocenteClick?: (nombre: string) => void }) {
  // Determine which slots have data to avoid showing empty rows
  const usedSlots = new Set<string>();
  for (const a of asignaciones) {
    for (const s of a.slots) usedSlots.add(s);
  }
  const visibleSlots = SLOTS.filter((s) => usedSlots.has(s));

  if (visibleSlots.length === 0) {
    return <p className="text-xs text-gray-500 text-center py-4">Sin sesiones asignadas.</p>;
  }

  // Build a lookup: for each (dia, slot) → the assignment that STARTS there
  const startingAt = new Map<string, Asig[]>();
  for (const a of asignaciones) {
    const key = `${a.dia}|${a.slots[0]}`;
    if (!startingAt.has(key)) startingAt.set(key, []);
    startingAt.get(key)!.push(a);
  }

  // Track which cells are consumed by a rowSpan from a previous row
  const spannedCells = new Set<string>();

  // Pre-calculate spans: for each assignment starting at (dia, slot), 
  // calculate how many VISIBLE rows it spans
  const getVisibleSpan = (a: Asig): number => {
    let span = 0;
    for (const s of a.slots) {
      if (visibleSlots.includes(s)) span++;
    }
    return Math.max(span, 1);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse table-fixed">
        <thead>
          <tr>
            <th className="px-2 py-1.5 text-left text-gray-500 font-medium w-14 border-b border-gray-800">Hora</th>
            {DIAS.map((d) => (
              <th key={d} className="px-2 py-1.5 text-center text-gray-400 font-medium border-b border-gray-800">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleSlots.map((slot) => (
            <tr key={slot} style={{ height: "36px" }}>
              <td className="px-2 py-1 text-gray-600 font-mono text-[10px] border-r border-gray-800 align-top">{slot}</td>
              {DIAS.map((dia) => {
                const cellKey = `${dia}|${slot}`;

                // If this cell is consumed by a rowSpan from above, skip rendering it
                if (spannedCells.has(cellKey)) return null;

                const startingHere = startingAt.get(cellKey) || [];

                if (startingHere.length === 0) {
                  return <td key={cellKey} className="px-1 py-0.5 border-b border-gray-800/50" />;
                }

                // Use the max span among all assignments starting here
                // (normally should be 1 assignment per cell after HC-05 fix)
                const maxSpan = Math.max(...startingHere.map(getVisibleSpan));

                // Mark all future cells in this column as spanned
                const slotIdx = visibleSlots.indexOf(slot);
                for (let i = 1; i < maxSpan; i++) {
                  if (slotIdx + i < visibleSlots.length) {
                    spannedCells.add(`${dia}|${visibleSlots[slotIdx + i]}`);
                  }
                }

                return (
                  <td
                    key={cellKey}
                    rowSpan={maxSpan}
                    className="px-1 py-0.5 align-top border-b border-gray-800/50"
                  >
                    {startingHere.map((a) => (
                      <div
                        key={a.id}
                        className={`px-2 py-1.5 rounded text-[10px] leading-tight mb-0.5 h-full ${
                          a.esAIR ? "bg-amber-900/40 border border-amber-700/60 text-amber-200" :
                          a.esSinDocente ? "bg-orange-900/40 border border-orange-700/60 text-orange-200" :
                          a.tipoEspacio === "LABORATORIO" ? "bg-blue-900/30 border border-blue-800/60 text-blue-200" :
                          a.tipoEspacio === "TALLER" ? "bg-purple-900/30 border border-purple-800/60 text-purple-200" :
                          "bg-gray-800 border border-gray-700 text-gray-200"
                        }`}
                      >
                        <div className="font-bold">{a.materiaCodigo}</div>
                        <div className="truncate opacity-80">{a.materiaNombre}</div>
                        {showDocente && <div className="text-[9px] opacity-70 mt-0.5 cursor-pointer hover:underline" onClick={() => onDocenteClick?.(a.docenteNombre)}>{"\u{1F464}"} {a.docenteNombre}</div>}
                        {showCarrera && <div className="text-[9px] opacity-70 mt-0.5">{"\u{1F4DA}"} {a.carrera.split(" ").slice(0,3).join(" ")}</div>}
                        <div className="text-[9px] opacity-60 mt-0.5">
                          {!showCarrera && `\u{1F4CD} ${a.espacioCodigo}`}
                          {showCarrera && `\u{1F464} ${a.docenteNombre?.split(" ").slice(0,2).join(" ")}`}
                          {` \u00B7 ${a.slots[0]}-${calcEndTime(a.slots[a.slots.length-1])}`}
                        </div>
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

// ─── VIEW: LISTA ────────────────────────────────────────────────────────────

function ListView({ asignaciones }: { asignaciones: Asig[] }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-800/50 border-b border-gray-800">
            <th className="px-3 py-2.5 text-left text-gray-400">Codigo</th>
            <th className="px-3 py-2.5 text-left text-gray-400">Materia</th>
            <th className="px-3 py-2.5 text-left text-gray-400">Grupo</th>
            <th className="px-3 py-2.5 text-left text-gray-400">Semestre</th>
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
              <td className="px-3 py-2 text-white max-w-[160px] truncate">{a.materiaNombre}</td>
              <td className="px-3 py-2 text-gray-300">{a.grupoCodigo}</td>
              <td className="px-3 py-2 text-gray-400">{a.semestre}</td>
              <td className="px-3 py-2 text-gray-300 max-w-[130px] truncate">{a.docenteNombre}</td>
              <td className="px-3 py-2 text-gray-400 font-mono">{a.espacioCodigo}</td>
              <td className="px-3 py-2 text-gray-300">{a.dia}</td>
              <td className="px-3 py-2 text-gray-400 font-mono">{a.slots[0]}-{calcEndTime(a.slots[a.slots.length - 1])}</td>
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

// ─── VIEW: CONFLICTOS ───────────────────────────────────────────────────────

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
            <th className="px-3 py-2.5 text-left text-gray-400">Semestre</th>
            <th className="px-3 py-2.5 text-left text-gray-400">Motivo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {conflictos.map((c) => (
            <tr key={c.id} className="hover:bg-gray-800/50">
              <td className="px-3 py-2 font-mono text-red-400">{c.materiaCodigo}</td>
              <td className="px-3 py-2 text-white">{c.materiaNombre}</td>
              <td className="px-3 py-2 text-gray-300">{c.grupoCodigo}</td>
              <td className="px-3 py-2 text-gray-400 max-w-[140px] truncate">{c.carrera}</td>
              <td className="px-3 py-2 text-gray-400">{c.semestre}</td>
              <td className="px-3 py-2 text-red-300 max-w-[200px]">{c.motivo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── STAT ───────────────────────────────────────────────────────────────────

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

// ─── MODAL: DISPONIBILIDAD DOCENTE ──────────────────────────────────────────

const MODAL_DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MODAL_SLOTS = ["07:45","08:30","09:15","10:00","10:45","11:30","12:15","13:00","13:45","14:30","15:15","16:00","16:45","17:30","18:15","19:00","19:45","20:30","21:15","22:00"];

function DocenteDisponibilidadModal({ nombre, onClose }: { nombre: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ docente: { nombre: string; ci: string }; totalSlots: number; disponibilidad: { dia: string; slot: string }[] } | null>(null);

  useEffect(() => {
    fetch(`/api/docentes/disponibilidad?nombre=${encodeURIComponent(nombre)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [nombre]);

  const isAvailable = (dia: string, slot: string) =>
    data?.disponibilidad.some((d) => d.dia === dia && d.slot === slot) || false;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-4xl w-full max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <div>
            <h3 className="text-sm font-bold text-white">Disponibilidad: {nombre}</h3>
            {data && <p className="text-[11px] text-gray-400">{data.totalSlots} slots disponibles</p>}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded"><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        <div className="p-4 overflow-x-auto">
          {loading && <p className="text-center text-gray-400 py-8">Cargando disponibilidad...</p>}
          {error && <p className="text-center text-red-400 py-8">{error}</p>}
          {data && (
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr>
                  <th className="px-1 py-1 text-gray-500 w-12">Hora</th>
                  {MODAL_DIAS.map((d) => (
                    <th key={d} className="px-1 py-1 text-gray-400 text-center">{d.slice(0, 3)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODAL_SLOTS.map((slot) => (
                  <tr key={slot}>
                    <td className="px-1 py-0.5 text-gray-600 font-mono">{slot}</td>
                    {MODAL_DIAS.map((dia) => (
                      <td key={`${dia}|${slot}`} className="px-0.5 py-0.5 text-center">
                        <div className={`w-full h-4 rounded-sm ${isAvailable(dia, slot) ? "bg-emerald-600/60" : "bg-gray-800"}`} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

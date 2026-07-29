import type {
  Docente,
  MateriaCatalogo,
  Espacio,
  ReservaExterna,
  SchedulerConfig,
  UnidadTrabajo,
  Dia,
  Turno,
  TipoEspacio,
} from "@/types/scheduler";
import { SLOTS, TURNOS_SLOTS, DIAS } from "@/types/scheduler";

// ======================================================================
// SHARED HELPERS - Used by all scheduler algorithms
// ======================================================================

// --- String & Key helpers ---

export function normalizeStr(s: string): string {
  return s.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

export function buildStudentGroupKey(carrera: string, semestre: string, grupoCodigo: string): string {
  return normalizeStr(carrera) + "|" + normalizeStr(semestre) + "|" + normalizeStr(grupoCodigo);
}

export function inferirTurno(turno: string): Turno {
  const t = turno.toLowerCase();
  if (t.includes("noche") || turno.endsWith("N")) return "Noche";
  if (t.includes("tarde") || turno.endsWith("T")) return "Tarde";
  return "Mañana";
}

export function esPracticaLaboral(materia: MateriaCatalogo): boolean {
  const nombre = normalizeStr(materia.nombreAsignatura);
  const codigo = materia.codigo.toUpperCase();
  const keywords = [
    "PRACTICA LABORAL", "PRACTICAS LABORALES", "PRACTICA PROFESIONAL",
    "PASANTIA", "TRABAJO DIRIGIDO", "PROYECTO DE GRADO",
  ];
  return keywords.some((kw) => nombre.includes(kw)) ||
    codigo.startsWith("PRL") || codigo.startsWith("PRP") || codigo.startsWith("PAS");
}

export function repartirEnSesiones(horas: number, maxPorSesion: number, _tipo: TipoEspacio | null): number[] {
  if (horas <= 0) return [];
  if (horas === 1) horas = 2;

  const minPorSesion = 2;
  const max = Math.max(maxPorSesion, minPorSesion);

  if (horas <= max) return [horas];

  const numSesiones = Math.ceil(horas / max);
  const sesiones: number[] = [];
  let remaining = horas;

  for (let i = 0; i < numSesiones; i++) {
    const left = numSesiones - i;
    const base = Math.floor(remaining / left);
    const thisSession = Math.min(base, max);
    sesiones.push(thisSession);
    remaining -= thisSession;
  }

  // Distribute remainder
  for (let i = 0; i < sesiones.length && remaining > 0; i++) {
    const add = Math.min(remaining, max - sesiones[i]);
    sesiones[i] += add;
    remaining -= add;
  }

  // Ensure no session < 2
  for (let i = 0; i < sesiones.length; i++) {
    if (sesiones[i] < minPorSesion) {
      sesiones[i] = minPorSesion;
    }
  }

  // Sort descending
  sesiones.sort((a, b) => b - a);
  return sesiones;
}

export function crearEspacioAIR(): Espacio {
  return { id: -1, codigo: "AIR", tipo: "AULA", aforo: 9999, escuela: 0 };
}

// --- Occupancy state management ---

export interface OccupancyState {
  docenteOcupado: Map<string, boolean>;
  espacioOcupado: Map<string, boolean>;
  estudiantesOcupados: Map<string, boolean>;
  grupoCargaDiaria: Map<string, number>;
  groupDaySlots: Map<string, number[]>;
}

export function createOccupancyState(reservas: ReservaExterna[]): OccupancyState {
  const state: OccupancyState = {
    docenteOcupado: new Map(),
    espacioOcupado: new Map(),
    estudiantesOcupados: new Map(),
    grupoCargaDiaria: new Map(),
    groupDaySlots: new Map(),
  };

  for (const r of reservas) {
    state.espacioOcupado.set(`${r.espacioId}|${r.dia}|${r.slot}`, true);
  }

  return state;
}

export function cloneOccupancyState(state: OccupancyState): OccupancyState {
  return {
    docenteOcupado: new Map(state.docenteOcupado),
    espacioOcupado: new Map(state.espacioOcupado),
    estudiantesOcupados: new Map(state.estudiantesOcupados),
    grupoCargaDiaria: new Map(state.grupoCargaDiaria),
    groupDaySlots: new Map(
      Array.from(state.groupDaySlots.entries()).map(([k, v]) => [k, [...v]])
    ),
  };
}

// --- Constraint checking ---

export function isValid(
  state: OccupancyState,
  docenteId: number | null,
  espacioId: number | null,
  studentKey: string,
  dia: Dia,
  slots: string[],
  capacidad: number,
  proyeccion: number,
  tipoEspacio: TipoEspacio | null,
  materiaEscuela: number,
  espacio: Espacio | null,
  esAIR: boolean
): boolean {
  for (const slot of slots) {
    // HC-01: docente overlap
    if (docenteId !== null && state.docenteOcupado.has(`${docenteId}|${dia}|${slot}`)) return false;
    // HC-02: space overlap
    if (espacioId !== null && espacioId !== -1 && state.espacioOcupado.has(`${espacioId}|${dia}|${slot}`)) return false;
    // HC-05: student group overlap
    if (state.estudiantesOcupados.has(`${studentKey}|${dia}|${slot}`)) return false;
  }
  // HC-06: capacity
  if (!esAIR && capacidad < proyeccion) return false;
  // HC-08: max 7 periods per day per student group
  const currentLoad = state.grupoCargaDiaria.get(`${studentKey}|${dia}`) || 0;
  if (currentLoad + slots.length > 7) return false;
  // HC-09: space type must match
  if (!esAIR && espacio && tipoEspacio && espacio.tipo !== tipoEspacio) return false;
  // HC-SCHOOL: space school must match
  if (!esAIR && espacio && espacio.escuela !== materiaEscuela && espacio.escuela !== 0) return false;
  return true;
}

export function applyAssignment(
  state: OccupancyState,
  docenteId: number | null,
  espacioId: number | null,
  studentKey: string,
  dia: Dia,
  slots: string[]
): void {
  for (const slot of slots) {
    if (docenteId !== null) state.docenteOcupado.set(`${docenteId}|${dia}|${slot}`, true);
    if (espacioId !== null && espacioId !== -1) state.espacioOcupado.set(`${espacioId}|${dia}|${slot}`, true);
    state.estudiantesOcupados.set(`${studentKey}|${dia}|${slot}`, true);
  }
  const key = `${studentKey}|${dia}`;
  state.grupoCargaDiaria.set(key, (state.grupoCargaDiaria.get(key) || 0) + slots.length);

  // Track for adjacency
  const gdKey = `${studentKey}|${dia}`;
  const existing = state.groupDaySlots.get(gdKey) || [];
  for (const slot of slots) {
    existing.push(SLOTS.indexOf(slot));
  }
  existing.sort((a, b) => a - b);
  state.groupDaySlots.set(gdKey, existing);
}

// --- Window helpers ---

export function getWindows(nBloques: number, turno: Turno): string[][] {
  const turnoKey = turno as keyof typeof TURNOS_SLOTS;
  const turnoSlots = TURNOS_SLOTS[turnoKey];
  if (!turnoSlots || turnoSlots.length < nBloques) return [];
  const windows: string[][] = [];
  for (let i = 0; i <= turnoSlots.length - nBloques; i++) {
    windows.push(turnoSlots.slice(i, i + nBloques));
  }
  return windows;
}

export function calcGap(state: OccupancyState, studentKey: string, dia: Dia, windowSlots: string[]): number {
  const gdKey = `${studentKey}|${dia}`;
  const existing = state.groupDaySlots.get(gdKey);
  if (!existing || existing.length === 0) return 999; // No existing classes, neutral

  const windowIndices = windowSlots.map((s) => SLOTS.indexOf(s));
  const wMin = Math.min(...windowIndices);
  const wMax = Math.max(...windowIndices);
  const eMin = Math.min(...existing);
  const eMax = Math.max(...existing);

  if (wMax < eMin) return eMin - wMax - 1;
  if (wMin > eMax) return wMin - eMax - 1;
  return 0; // overlapping range = adjacent/inside
}

export function orderWindowsByAdjacency(
  windows: string[][],
  state: OccupancyState,
  studentKey: string,
  dia: Dia
): string[][] {
  return [...windows].sort((a, b) => {
    const gapA = calcGap(state, studentKey, dia, a);
    const gapB = calcGap(state, studentKey, dia, b);
    return gapA - gapB;
  });
}

export function getDaysOrdered(
  state: OccupancyState,
  config: SchedulerConfig,
  studentKey: string,
  usedDays: Dia[],
  materTurno?: Turno
): Dia[] {
  const diaIndex: Record<string, number> = {
    "Lunes": 0, "Martes": 1, "Miércoles": 2, "Jueves": 3, "Viernes": 4, "Sábado": 5,
  };
  const available = DIAS.filter((d) => {
    if (d === "Sábado") {
      if (!materTurno) return config.sabadoManana || config.sabadoTarde || config.sabadoNoche;
      if (materTurno === "Mañana") return config.sabadoManana;
      if (materTurno === "Tarde") return config.sabadoTarde;
      if (materTurno === "Noche") return config.sabadoNoche;
      return false;
    }
    return true;
  });

  return [...available].sort((a, b) => {
    const loadA = state.grupoCargaDiaria.get(`${studentKey}|${a}`) || 0;
    const loadB = state.grupoCargaDiaria.get(`${studentKey}|${b}`) || 0;
    if (loadA !== loadB) return loadA - loadB;

    if (usedDays.length > 0) {
      const idxA = diaIndex[a] ?? 0;
      const idxB = diaIndex[b] ?? 0;
      const minDistA = Math.min(...usedDays.map((d) => Math.abs(idxA - (diaIndex[d] ?? 0))));
      const minDistB = Math.min(...usedDays.map((d) => Math.abs(idxB - (diaIndex[d] ?? 0))));
      return minDistB - minDistA;
    }
    return 0;
  });
}

// --- Work unit building ---

export function buildWorkUnits(
  materias: MateriaCatalogo[],
  espacios: Espacio[],
  docentes: Docente[],
  config: SchedulerConfig
): UnidadTrabajo[] {
  let materiasActivas = materias.filter((m) => m.horasPorSemana > 0 && m.tipoAula !== null);
  if (config.carrerasAProgramar.length > 0) {
    materiasActivas = materiasActivas.filter((m) =>
      config.carrerasAProgramar.some((c) => m.carrera.toLowerCase().includes(c.toLowerCase()))
    );
  }

  const unidades: UnidadTrabajo[] = materiasActivas.map((materia) => {
    const tipo = materia.tipoAula;
    const maxPorSesion = tipo === "AULA" ? 3 : tipo === "TALLER" ? config.maxPerSesionTaller : config.maxPerSesionLab;
    const sesiones = repartirEnSesiones(materia.horasPorSemana, maxPorSesion, tipo);
    const practica = esPracticaLaboral(materia);

    // Difficulty score
    let dificultad = materia.horasPorSemana * 3;
    if (tipo === "LABORATORIO") dificultad += 35;
    else if (tipo === "TALLER") dificultad += 25;
    const espaciosDisp = espacios.filter((e) => e.tipo === tipo && e.escuela === materia.escuela && e.aforo >= (materia.proyeccionInscritos || 0));
    if (espaciosDisp.length === 0) dificultad += 60;
    else if (espaciosDisp.length === 1) dificultad += 40;
    else if (espaciosDisp.length <= 3) dificultad += 20;
    const docentesDisp = docentes.filter((d) => d.materiasHabilitadas.some((mh) => mh.sigla === materia.codigo));
    if (docentesDisp.length === 0) dificultad += 50;
    else if (docentesDisp.length === 1) dificultad += 30;

    const esPrioritaria = config.docentesPrioritarios.length > 0 && docentes.some(
      (d) => config.docentesPrioritarios.includes(d.ci) && d.materiasHabilitadas.some((mh) => mh.sigla === materia.codigo)
    );

    const grupoKey = materia.carrera + "|" + materia.semestre + "|" + materia.codigo + "|" + materia.grupoCodigo;

    return { materia, sesiones, dificultad, esPrioritaria, esPractica: practica, grupoKey };
  });

  // Sort by difficulty (practicas last, priority first, most constrained first)
  unidades.sort((a, b) => {
    if (a.esPractica !== b.esPractica) return a.esPractica ? 1 : -1;
    if (a.esPrioritaria !== b.esPrioritaria) return a.esPrioritaria ? -1 : 1;
    return b.dificultad - a.dificultad;
  });

  return unidades;
}

// --- Candidate helpers ---

export function getCandidateDocentes(
  unidad: UnidadTrabajo,
  docentes: Docente[]
): Docente[] {
  if (unidad.esPractica) return [];
  return docentes.filter((d) =>
    d.materiasHabilitadas.some((mh) => mh.sigla === unidad.materia.codigo)
  );
}

export function getCandidateEspacios(
  unidad: UnidadTrabajo,
  espacios: Espacio[]
): Espacio[] {
  if (unidad.esPractica) return [];
  const materia = unidad.materia;
  // Primary: type + school + capacity
  let espaciosCand = espacios.filter((e) =>
    e.tipo === materia.tipoAula && e.escuela === materia.escuela && e.aforo >= (materia.proyeccionInscritos || 0)
  );
  // Fallback: any of correct type (ignore school)
  if (espaciosCand.length === 0) {
    espaciosCand = espacios.filter((e) =>
      e.tipo === materia.tipoAula && e.aforo >= (materia.proyeccionInscritos || 0)
    );
  }
  return espaciosCand;
}

export function isDocenteDisponible(doc: Docente, dia: Dia, slots: string[]): boolean {
  return slots.every((slot) =>
    doc.disponibilidad.some((ds) => ds.dia === dia && ds.slot === slot)
  );
}

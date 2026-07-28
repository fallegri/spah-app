import type {
  Docente,
  MateriaCatalogo,
  Espacio,
  ReservaExterna,
  SchedulerConfig,
  SchedulerResult,
  UnidadTrabajo,
  Asignacion,
  Conflicto,
  Ventana,
  Dia,
  TipoEspacio,
} from "@/types/scheduler";
import { SLOTS, TURNOS_SLOTS, DIAS } from "@/types/scheduler";

// ─── STATE ──────────────────────────────────────────────────────────────────

interface SchedulerState {
  docentes: Docente[];
  materias: MateriaCatalogo[];
  espacios: Espacio[];
  reservas: ReservaExterna[];
  config: SchedulerConfig;
  asignaciones: Asignacion[];
  conflictos: Conflicto[];
  log: string[];
  // === INDEXES FOR FAST LOOKUP ===
  // HC-01: Docente can't be in two places at once
  docenteOcupado: Map<string, boolean>;       // `${docenteId}|${dia}|${slot}`
  // HC-02: Space can't be double-booked
  espacioOcupado: Map<string, boolean>;       // `${espacioId}|${dia}|${slot}`
  // HC-05: Students of same carrera+semestre+grupo can't have overlapping classes
  // KEY: `${carrera}|${semestre}|${grupoCodigo}|${dia}|${slot}`
  estudiantesOcupados: Map<string, boolean>;
  // HC-08: Max 8 periods per day for a student group
  // KEY: `${carrera}|${semestre}|${grupoCodigo}|${dia}`
  grupoCargaDiaria: Map<string, number>;
  // HC-13: Docente can't teach 2 different subjects to the same grupoCodigo
  // KEY: `${docenteId}|${grupoCodigo}` -> materiaCodigo (first assigned)
  docenteGrupoMateria: Map<string, string>;
  backtrackCount: number;
}

// ─── MAIN ENTRY POINT ───────────────────────────────────────────────────────

export function ejecutarScheduler(
  docentes: Docente[],
  materias: MateriaCatalogo[],
  espacios: Espacio[],
  reservas: ReservaExterna[],
  config: SchedulerConfig
): SchedulerResult {
  const startTime = Date.now();

  const state: SchedulerState = {
    docentes,
    materias,
    espacios,
    reservas,
    config,
    asignaciones: [],
    conflictos: [],
    log: [],
    docenteOcupado: new Map(),
    espacioOcupado: new Map(),
    estudiantesOcupados: new Map(),
    grupoCargaDiaria: new Map(),
    docenteGrupoMateria: new Map(),
    backtrackCount: 0,
  };

  // Pre-index external reservations as occupied spaces
  for (const r of reservas) {
    state.espacioOcupado.set(`${r.espacioId}|${r.dia}|${r.slot}`, true);
  }

  // Phase 1: Build work units
  const unidades = construirUnidadesDeTrabajo(state);
  state.log.push(`[FASE 1] ${unidades.length} unidades de trabajo construidas`);
  state.log.push(`[INFO] Docentes: ${docentes.length}, Espacios: ${espacios.length}, Reservas: ${reservas.length}`);

  // Phase 2: Main scheduling loop
  for (const unidad of unidades) {
    for (let sesIdx = 0; sesIdx < unidad.sesiones.length; sesIdx++) {
      const nBloques = unidad.sesiones[sesIdx];
      const resultado = intentarConBacktracking(state, unidad, nBloques, sesIdx);

      if (resultado) {
        registrarAsignacion(state, resultado);
        state.log.push(
          `[OK] ${resultado.materiaCodigo} (${resultado.grupoCodigo}) → ${resultado.dia} ${resultado.slots[0]}-${resultado.slots[resultado.slots.length-1]} | ${resultado.docenteNombre} | ${resultado.espacioCodigo}`
        );
      } else {
        state.conflictos.push({
          materiaCodigo: unidad.materia.codigo,
          materiaNombre: unidad.materia.nombreAsignatura,
          grupoCodigo: unidad.materia.grupoCodigo,
          carrera: unidad.materia.carrera,
          semestre: unidad.materia.semestre,
          sesionIndex: sesIdx,
          motivo: `No se encontró combinación válida después de ${state.backtrackCount} intentos de backtracking`,
        });
        state.log.push(
          `[FAIL] ${unidad.materia.codigo} (${unidad.materia.grupoCodigo}) sesión ${sesIdx} — sin combinación válida`
        );
      }
    }
  }

  const duracion = Date.now() - startTime;
  state.log.push(
    `[FIN] Completado en ${duracion}ms. Asignadas: ${state.asignaciones.length}, Conflictos: ${state.conflictos.length}`
  );

  return {
    asignaciones: state.asignaciones,
    conflictos: state.conflictos,
    totalAsignadas: state.asignaciones.length,
    totalConflictos: state.conflictos.length,
    totalAIR: state.asignaciones.filter((a) => a.esAIR).length,
    totalSinDocente: state.asignaciones.filter((a) => a.esSinDocente).length,
    duracionMs: duracion,
    log: state.log,
  };
}

// ─── PHASE 1: BUILD WORK UNITS ─────────────────────────────────────────────

function construirUnidadesDeTrabajo(state: SchedulerState): UnidadTrabajo[] {
  const { materias, config } = state;

  let materiasActivas = materias.filter((m) => m.horasPorSemana > 0 && m.tipoAula !== null);
  if (config.carrerasAProgramar.length > 0) {
    materiasActivas = materiasActivas.filter((m) =>
      config.carrerasAProgramar.some((c) => m.carrera.toLowerCase().includes(c.toLowerCase()))
    );
  }

  const unidades: UnidadTrabajo[] = materiasActivas.map((materia) => {
    const tipo = materia.tipoAula;
    const maxPorSesion =
      tipo === "AULA" ? 3 : tipo === "TALLER" ? config.maxPerSesionTaller : config.maxPerSesionLab;

    const sesiones = repartirEnSesiones(materia.horasPorSemana, maxPorSesion);
    const dificultad = calcularDificultad(materia, state);
    const esPrioritaria = tieneDocentePrioritario(materia, state);
    // grupoKey for the work unit (includes materia code for internal tracking)
    const grupoKey = `${materia.carrera}|${materia.semestre}|${materia.codigo}|${materia.grupoCodigo}`;

    return { materia, sesiones, dificultad, esPrioritaria, grupoKey };
  });

  unidades.sort((a, b) => {
    if (a.esPrioritaria !== b.esPrioritaria) return a.esPrioritaria ? -1 : 1;
    return b.dificultad - a.dificultad;
  });

  return unidades;
}

function calcularDificultad(materia: MateriaCatalogo, state: SchedulerState): number {
  let score = materia.horasPorSemana * 2;
  if (materia.tipoAula === "LABORATORIO") score += 30;
  else if (materia.tipoAula === "TALLER") score += 20;
  const espaciosDisp = state.espacios.filter(
    (e) => e.tipo === materia.tipoAula && e.escuela === materia.escuela && e.aforo >= (materia.proyeccionInscritos || 0)
  );
  if (espaciosDisp.length <= 2) score += 15;
  if (espaciosDisp.length === 0) score += 50;
  return score;
}

function tieneDocentePrioritario(materia: MateriaCatalogo, state: SchedulerState): boolean {
  if (state.config.docentesPrioritarios.length === 0) return false;
  return state.docentes.some(
    (d) => state.config.docentesPrioritarios.includes(d.ci) &&
      d.materiasHabilitadas.some((mh) => mh.sigla === materia.codigo)
  );
}

function repartirEnSesiones(horas: number, maxPorSesion: number): number[] {
  if (horas <= 0) return [];
  if (horas <= maxPorSesion) return [horas];
  const numSesiones = Math.ceil(horas / maxPorSesion);
  const base = Math.floor(horas / numSesiones);
  const extra = horas % numSesiones;
  const sesiones: number[] = [];
  for (let i = 0; i < numSesiones; i++) {
    sesiones.push(base + (i < extra ? 1 : 0));
  }
  sesiones.sort((a, b) => b - a);
  return sesiones;
}

// ─── PHASE 2: BACKTRACKING ──────────────────────────────────────────────────

function intentarConBacktracking(
  state: SchedulerState, unidad: UnidadTrabajo, nBloques: number, sesionIndex: number
): Asignacion | null {
  const ordenDias = calcularOrdenDias(state, unidad, sesionIndex);

  // Try 1: Greedy
  let resultado = intentarAsignarSesion(state, unidad, nBloques, sesionIndex, ordenDias, false, false);
  if (resultado) return resultado;

  // Tries 2+: Permutations
  for (let i = 0; i < 5 && state.backtrackCount < state.config.maxBacktrack; i++) {
    state.backtrackCount++;
    const permuted = shuffleArray([...ordenDias]);
    resultado = intentarAsignarSesion(state, unidad, nBloques, sesionIndex, permuted, false, false);
    if (resultado) return resultado;
  }

  // Fallback 1: AIR (fictitious space)
  if (state.config.permitirAIR) {
    resultado = intentarAsignarSesion(state, unidad, nBloques, sesionIndex, ordenDias, true, false);
    if (resultado) return resultado;
  }

  // Fallback 2: Sin Docente
  if (state.config.permitirSinDocente) {
    resultado = intentarAsignarSesion(state, unidad, nBloques, sesionIndex, ordenDias, false, true);
    if (resultado) return resultado;
  }

  // Fallback 3: Both comodines
  if (state.config.permitirAIR && state.config.permitirSinDocente) {
    resultado = intentarAsignarSesion(state, unidad, nBloques, sesionIndex, ordenDias, true, true);
    if (resultado) return resultado;
  }

  return null;
}

function calcularOrdenDias(state: SchedulerState, unidad: UnidadTrabajo, sesionIndex: number): Dia[] {
  const dias = DIAS.filter((d) => d !== "Sábado" || tieneSabadoHabilitado(state));
  const studentKey = `${unidad.materia.carrera}|${unidad.materia.semestre}|${unidad.materia.grupoCodigo}`;

  // Sort by least loaded day for this student group
  const cargaPorDia = dias.map((dia) => ({
    dia,
    carga: state.grupoCargaDiaria.get(`${studentKey}|${dia}`) || 0,
  }));
  cargaPorDia.sort((a, b) => a.carga - b.carga);

  // SC-04: Move days already used by THIS materia to the end (different sessions on different days)
  const diasUsados = state.asignaciones
    .filter((a) => a.materiaCodigo === unidad.materia.codigo && a.grupoCodigo === unidad.materia.grupoCodigo)
    .map((a) => a.dia);

  const ordenado = cargaPorDia.map((c) => c.dia);
  const sinUsar = ordenado.filter((d) => !diasUsados.includes(d));
  const usados = ordenado.filter((d) => diasUsados.includes(d));
  return [...sinUsar, ...usados];
}

function tieneSabadoHabilitado(state: SchedulerState): boolean {
  return state.config.sabadoManana || state.config.sabadoTarde || state.config.sabadoNoche;
}

// ─── PHASE 3: ASSIGNMENT ATTEMPT ────────────────────────────────────────────

function intentarAsignarSesion(
  state: SchedulerState, unidad: UnidadTrabajo, nBloques: number,
  sesionIndex: number, ordenDias: Dia[], usarAIR: boolean, usarSinDocente: boolean
): Asignacion | null {
  const materia = unidad.materia;
  const docentesCand = usarSinDocente ? [null] : docentesCandidatos(state, materia);
  const espaciosCand = usarAIR ? [crearEspacioAIR()] : espaciosCandidatos(state, materia);
  const ventanas = generarVentanas(nBloques, materia.turno, state);

  // Student group key (carrera + semestre + grupoCodigo) — NOT including materia
  const studentGroupKey = `${materia.carrera}|${materia.semestre}|${materia.grupoCodigo}`;

  for (const dia of ordenDias) {
    if (dia === "Sábado" && !esVentanaSabadoValida(materia.turno, state)) continue;

    for (const ventana of ventanas) {
      if (dia === "Sábado" && !slotEnTurnoSabado(ventana.slots, state)) continue;

      // ═══ HC-05: Check student group overlap FIRST (cheapest check) ═══
      // Students in the same carrera+semestre+grupo cannot have two classes at the same time
      const estudiantesConflicto = ventana.slots.some((slot) =>
        state.estudiantesOcupados.has(`${studentGroupKey}|${dia}|${slot}`)
      );
      if (estudiantesConflicto) continue;

      // ═══ HC-08: Max 8 periods per day for student group ═══
      const cargaDiariaKey = `${studentGroupKey}|${dia}`;
      const cargaActual = state.grupoCargaDiaria.get(cargaDiariaKey) || 0;
      if (cargaActual + nBloques > 8) continue;

      for (const docente of docentesCand) {
        if (docente !== null) {
          // HC-03: Docente must be available in ALL slots of the window
          if (!verificarDisponibilidad(docente, dia, ventana.slots)) continue;
          // HC-04: Docente must be habilitado for this materia
          if (!verificarHabilitacion(docente, materia.codigo)) continue;
          // HC-01: Docente can't be in two places at once
          if (verificarSolapamientoDocente(state, docente.id, dia, ventana.slots)) continue;
          // HC-13: Docente can't teach 2 different subjects to same grupoCodigo
          if (verificarDocenteGrupo(state, docente.id, materia.grupoCodigo, materia.codigo)) continue;
        }

        for (const espacio of espaciosCand) {
          if (!usarAIR) {
            // HC-06: Room capacity >= projected students
            if (espacio.aforo < (materia.proyeccionInscritos || 0)) continue;
            // HC-09: Space type must match (AULA→AULA, TALLER→TALLER, LAB→LAB)
            if (espacio.tipo !== materia.tipoAula) continue;
            // HC-02: Space can't be double-booked
            if (verificarSolapamientoEspacio(state, espacio.id, dia, ventana.slots)) continue;
          }

          // ═══ ALL CONSTRAINTS PASSED — valid assignment found ═══
          return {
            materiaCodigo: materia.codigo,
            materiaNombre: materia.nombreAsignatura,
            grupoCodigo: materia.grupoCodigo,
            carrera: materia.carrera,
            semestre: materia.semestre,
            docenteId: docente?.id ?? null,
            docenteNombre: docente?.nombre ?? "Sin Docente",
            espacioId: usarAIR ? null : espacio.id,
            espacioCodigo: usarAIR ? "AIR" : espacio.codigo,
            dia,
            slots: ventana.slots,
            turno: materia.turno,
            tipoEspacio: materia.tipoAula,
            esAIR: usarAIR,
            esSinDocente: usarSinDocente,
            sesionIndex,
          };
        }
      }
    }
  }

  return null;
}

// ─── CONSTRAINT VERIFICATION FUNCTIONS ──────────────────────────────────────

function verificarDisponibilidad(docente: Docente, dia: Dia, slots: string[]): boolean {
  return slots.every((slot) =>
    docente.disponibilidad.some((d) => d.dia === dia && d.slot === slot)
  );
}

function verificarHabilitacion(docente: Docente, codigo: string): boolean {
  return docente.materiasHabilitadas.some((mh) => mh.sigla === codigo);
}

function verificarSolapamientoDocente(state: SchedulerState, docenteId: number, dia: Dia, slots: string[]): boolean {
  return slots.some((slot) => state.docenteOcupado.has(`${docenteId}|${dia}|${slot}`));
}

function verificarSolapamientoEspacio(state: SchedulerState, espacioId: number, dia: Dia, slots: string[]): boolean {
  return slots.some((slot) => state.espacioOcupado.has(`${espacioId}|${dia}|${slot}`));
}

function verificarDocenteGrupo(state: SchedulerState, docenteId: number, grupoCodigo: string, materiaCodigo: string): boolean {
  const key = `${docenteId}|${grupoCodigo}`;
  const existente = state.docenteGrupoMateria.get(key);
  // Returns true (= conflict) if docente already teaches a DIFFERENT subject to this grupo
  return existente !== undefined && existente !== materiaCodigo;
}

// ─── REGISTRATION (updates all indexes) ─────────────────────────────────────

function registrarAsignacion(state: SchedulerState, asig: Asignacion): void {
  state.asignaciones.push(asig);

  const studentGroupKey = `${asig.carrera}|${asig.semestre}|${asig.grupoCodigo}`;

  for (const slot of asig.slots) {
    // Mark docente as occupied
    if (asig.docenteId !== null) {
      state.docenteOcupado.set(`${asig.docenteId}|${asig.dia}|${slot}`, true);
    }
    // Mark space as occupied
    if (asig.espacioId !== null && !asig.esAIR) {
      state.espacioOcupado.set(`${asig.espacioId}|${asig.dia}|${slot}`, true);
    }
    // Mark student group time as occupied (THIS is the key fix)
    state.estudiantesOcupados.set(`${studentGroupKey}|${asig.dia}|${slot}`, true);
  }

  // Update daily load for the student group
  const cargaKey = `${studentGroupKey}|${asig.dia}`;
  const actual = state.grupoCargaDiaria.get(cargaKey) || 0;
  state.grupoCargaDiaria.set(cargaKey, actual + asig.slots.length);

  // Track docente-grupo assignment (HC-13)
  if (asig.docenteId !== null) {
    state.docenteGrupoMateria.set(`${asig.docenteId}|${asig.grupoCodigo}`, asig.materiaCodigo);
  }
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function docentesCandidatos(state: SchedulerState, materia: MateriaCatalogo): Docente[] {
  // Only docentes who are habilitados for this specific materia code
  let candidatos = state.docentes.filter((d) =>
    d.materiasHabilitadas.some((mh) => mh.sigla === materia.codigo)
  );

  if (candidatos.length === 0) return [];

  // Prioritarios first, then sort by load (SC-02)
  candidatos.sort((a, b) => {
    const aPrio = state.config.docentesPrioritarios.includes(a.ci) ? 0 : 1;
    const bPrio = state.config.docentesPrioritarios.includes(b.ci) ? 0 : 1;
    if (aPrio !== bPrio) return aPrio - bPrio;
    return countDocenteLoad(state, a.id) - countDocenteLoad(state, b.id);
  });

  return candidatos;
}

function countDocenteLoad(state: SchedulerState, docenteId: number): number {
  return state.asignaciones
    .filter((a) => a.docenteId === docenteId)
    .reduce((sum, a) => sum + a.slots.length, 0);
}

function espaciosCandidatos(state: SchedulerState, materia: MateriaCatalogo): Espacio[] {
  return state.espacios
    .filter((e) =>
      e.tipo === materia.tipoAula &&
      e.aforo >= (materia.proyeccionInscritos || 0)
    )
    .sort((a, b) => {
      // Prefer same school first
      const aSchool = a.escuela === materia.escuela ? 0 : 1;
      const bSchool = b.escuela === materia.escuela ? 0 : 1;
      if (aSchool !== bSchool) return aSchool - bSchool;
      // Then prefer smallest room that fits (minimize waste)
      return a.aforo - b.aforo;
    });
}

function generarVentanas(nBloques: number, turno: string, state: SchedulerState): Ventana[] {
  const slotsDelTurno = TURNOS_SLOTS[turno as keyof typeof TURNOS_SLOTS];
  if (!slotsDelTurno || slotsDelTurno.length === 0) return [];

  const ventanas: Ventana[] = [];
  for (let i = 0; i <= slotsDelTurno.length - nBloques; i++) {
    const slotWindow = slotsDelTurno.slice(i, i + nBloques);
    ventanas.push({ slots: slotWindow, inicio: SLOTS.indexOf(slotWindow[0]) });
  }
  return ventanas;
}

function crearEspacioAIR(): Espacio {
  return { id: -1, codigo: "AIR", tipo: "AULA", aforo: 50, escuela: 0 };
}

function esVentanaSabadoValida(turnoMateria: string, state: SchedulerState): boolean {
  return state.config.sabadoManana || state.config.sabadoTarde || state.config.sabadoNoche;
}

function slotEnTurnoSabado(slots: string[], state: SchedulerState): boolean {
  const { config } = state;
  const firstSlot = slots[0];
  if (config.sabadoManana && TURNOS_SLOTS["Mañana"].includes(firstSlot)) return true;
  if (config.sabadoTarde && TURNOS_SLOTS["Tarde"].includes(firstSlot)) return true;
  if (config.sabadoNoche && TURNOS_SLOTS["Noche"].includes(firstSlot)) return true;
  return false;
}

function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

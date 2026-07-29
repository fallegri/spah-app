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
  Turno,
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
  // KEY: `${carrera}|${semestre}|${grupoBase}|${dia}|${slot}`
  // grupoBase extracts the core group identifier (e.g., "2AM" from "2AM", "2A" from "2A")
  // to handle cases where same students appear under slightly different grupoCodigo in the catalog
  estudiantesOcupados: Map<string, boolean>;
  // HC-08: Max 7 periods per day for a student group
  // KEY: `${carrera}|${semestre}|${grupoBase}|${dia}`
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

  // Log student groups for debugging
  const studentGroups = new Map<string, string[]>();
  for (const u of unidades) {
    const sgk = `${u.materia.carrera}|${u.materia.semestre}|${u.materia.grupoCodigo}`;
    if (!studentGroups.has(sgk)) studentGroups.set(sgk, []);
    studentGroups.get(sgk)!.push(`${u.materia.codigo}(${u.sesiones.join("+")}h)`);
  }
  for (const [key, materias] of studentGroups) {
    state.log.push(`[GRUPO] ${key} → ${materias.length} materias: ${materias.join(", ")}`);
  }

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

  // ═══ POST-GENERATION VALIDATION ═══
  // Detect any HC-05 violations (student group overlaps) that might have slipped through
  const overlapCheck = new Map<string, string>(); // `${studentGroupKey}|${dia}|${slot}` -> materiaCodigo
  for (const a of state.asignaciones) {
    const sgk = buildStudentGroupKey(a.carrera, a.semestre, a.grupoCodigo);
    for (const slot of a.slots) {
      const key = `${sgk}|${a.dia}|${slot}`;
      const existing = overlapCheck.get(key);
      if (existing && existing !== a.materiaCodigo) {
        state.log.push(
          `[WARN-HC05] CRUCE DETECTADO: Grupo ${a.grupoCodigo} (${a.carrera}|${a.semestre}) tiene ${existing} y ${a.materiaCodigo} en ${a.dia} ${slot}`
        );
      }
      overlapCheck.set(key, a.materiaCodigo);
    }
  }

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
    // HC-07: Materias teóricas (AULA) max 3 horas continuas = 4 bloques de 45min
    // Talleres y Labs usan configuración del usuario
    const maxPorSesion =
      tipo === "AULA" ? 4 : tipo === "TALLER" ? config.maxPerSesionTaller : config.maxPerSesionLab;

    const sesiones = repartirEnSesiones(materia.horasPorSemana, maxPorSesion, materia.tipoAula);
    const dificultad = calcularDificultad(materia, state);
    const esPrioritaria = tieneDocentePrioritario(materia, state);
    const esPractica = esPracticaLaboral(materia);
    // grupoKey for the work unit (includes materia code for internal tracking)
    const grupoKey = `${materia.carrera}|${materia.semestre}|${materia.codigo}|${materia.grupoCodigo}`;

    return { materia, sesiones, dificultad, esPrioritaria, esPractica, grupoKey };
  });

  unidades.sort((a, b) => {
    // Prácticas go last (they always get AIR, easy to schedule)
    if (a.esPractica !== b.esPractica) return a.esPractica ? 1 : -1;
    // Priority docentes first
    if (a.esPrioritaria !== b.esPrioritaria) return a.esPrioritaria ? -1 : 1;
    // Most constrained first (highest difficulty)
    return b.dificultad - a.dificultad;
  });

  return unidades;
}

function calcularDificultad(materia: MateriaCatalogo, state: SchedulerState): number {
  let score = 0;

  // More weekly hours = harder to fit
  score += materia.horasPorSemana * 3;

  // Practical spaces (labs/talleres) are scarcer
  if (materia.tipoAula === "LABORATORIO") score += 35;
  else if (materia.tipoAula === "TALLER") score += 25;

  // Count available spaces (same school + same type + sufficient capacity)
  const espaciosDisp = state.espacios.filter(
    (e) => e.tipo === materia.tipoAula && e.escuela === materia.escuela && e.aforo >= (materia.proyeccionInscritos || 0)
  );
  if (espaciosDisp.length === 0) score += 60;
  else if (espaciosDisp.length === 1) score += 40;
  else if (espaciosDisp.length <= 3) score += 20;

  // Count available docentes (fewer = harder)
  const docentesDisp = state.docentes.filter((d) =>
    d.materiasHabilitadas.some((mh) => mh.sigla === materia.codigo)
  );
  if (docentesDisp.length === 0) score += 50;
  else if (docentesDisp.length === 1) score += 30;
  else if (docentesDisp.length <= 2) score += 15;

  // Larger groups are harder (need bigger rooms)
  if ((materia.proyeccionInscritos || 0) > 35) score += 10;

  return score;
}

function tieneDocentePrioritario(materia: MateriaCatalogo, state: SchedulerState): boolean {
  if (state.config.docentesPrioritarios.length === 0) return false;
  return state.docentes.some(
    (d) => state.config.docentesPrioritarios.includes(d.ci) &&
      d.materiasHabilitadas.some((mh) => mh.sigla === materia.codigo)
  );
}

// Detects if a subject is "Prácticas Laborales" or "Prácticas Profesionales"
// These must always be scheduled in AIR (virtual/remote)
function esPracticaLaboral(materia: MateriaCatalogo): boolean {
  const nombre = materia.nombreAsignatura.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const codigo = materia.codigo.toUpperCase();
  
  const keywords = [
    "PRACTICA LABORAL",
    "PRACTICAS LABORALES",
    "PRACTICA PROFESIONAL",
    "PRACTICAS PROFESIONALES",
    "PASANTIA",
    "PASANTIAS",
    "TRABAJO DIRIGIDO",
    "PROYECTO DE GRADO",
  ];
  
  return keywords.some((kw) => nombre.includes(kw)) || 
    codigo.startsWith("PRL") || codigo.startsWith("PRP") || codigo.startsWith("PAS");
}

/**
 * Distribuye las horas semanales de una materia en sesiones.
 * 
 * REGLAS:
 * - Mínimo 2 periodos por sesión (no se permite 1 periodo solo)
 * - AULA (teórica): máximo 4 periodos (3h) por sesión. Si tiene 4h → 2+2
 * - TALLER/LAB: pueden tener 4+ periodos continuos (configurable)
 * - Todas las horas deben programarse (no se pierden)
 */
function repartirEnSesiones(horas: number, maxPorSesion: number, tipoAula: TipoEspacio | null): number[] {
  if (horas <= 0) return [];

  // Caso especial: materias teóricas (AULA) - max 3 periodos por sesión para forzar 2+2 en vez de 4
  // La regla dice: "si una materia tiene 4h teórica → 2+2, no pueden ir 4h teóricas seguidas"
  const maxReal = tipoAula === "AULA" ? Math.min(maxPorSesion, 3) : maxPorSesion;

  if (horas <= maxReal) {
    // Si cabe en una sola sesión y tiene al menos 2 periodos, va completa
    if (horas >= 2) return [horas];
    // Si tiene exactamente 1h (raro pero posible), forzar a 2 no es posible - dejar como está
    return [horas];
  }

  // Distribuir en múltiples sesiones equilibradas
  const numSesiones = Math.ceil(horas / maxReal);
  const base = Math.floor(horas / numSesiones);
  const extra = horas % numSesiones;
  const sesiones: number[] = [];

  for (let i = 0; i < numSesiones; i++) {
    sesiones.push(base + (i < extra ? 1 : 0));
  }

  // Validar que ninguna sesión tenga menos de 2 periodos
  // Si hay una sesión de 1, fusionarla con la anterior
  for (let i = sesiones.length - 1; i >= 0; i--) {
    if (sesiones[i] < 2 && sesiones.length > 1) {
      if (i > 0) {
        sesiones[i - 1] += sesiones[i];
        sesiones.splice(i, 1);
      } else if (i < sesiones.length - 1) {
        sesiones[i + 1] += sesiones[i];
        sesiones.splice(i, 1);
      }
    }
  }

  // Re-validar que no exceda maxReal después de fusiones
  const final: number[] = [];
  for (const s of sesiones) {
    if (s > maxReal) {
      // Re-split this session
      const sub = Math.ceil(s / maxReal);
      const subBase = Math.floor(s / sub);
      const subExtra = s % sub;
      for (let j = 0; j < sub; j++) {
        final.push(subBase + (j < subExtra ? 1 : 0));
      }
    } else {
      final.push(s);
    }
  }

  final.sort((a, b) => b - a);
  return final;
}

// ─── PHASE 2: BACKTRACKING ──────────────────────────────────────────────────

function intentarConBacktracking(
  state: SchedulerState, unidad: UnidadTrabajo, nBloques: number, sesionIndex: number
): Asignacion | null {
  const ordenDias = calcularOrdenDias(state, unidad, sesionIndex);

  // Prácticas laborales/profesionales: ALWAYS use AIR (virtual)
  if (unidad.esPractica) {
    let resultado = intentarAsignarSesion(state, unidad, nBloques, sesionIndex, ordenDias, true, false);
    if (resultado) return resultado;
    // Fallback: AIR + Sin Docente
    if (state.config.permitirSinDocente) {
      resultado = intentarAsignarSesion(state, unidad, nBloques, sesionIndex, ordenDias, true, true);
      if (resultado) return resultado;
    }
    return null;
  }

  // Try 1: Greedy with optimal day order
  let resultado = intentarAsignarSesion(state, unidad, nBloques, sesionIndex, ordenDias, false, false);
  if (resultado) return resultado;

  // Tries 2+: Smart permutations that PRESERVE same-day avoidance
  // Harder subjects (higher difficulty) get more permutation attempts
  const diasUsados = state.asignaciones
    .filter((a) => a.materiaCodigo === unidad.materia.codigo && a.grupoCodigo === unidad.materia.grupoCodigo)
    .map((a) => a.dia);

  const diasNoUsados = ordenDias.filter((d) => !diasUsados.includes(d));
  const diasYaUsados = ordenDias.filter((d) => diasUsados.includes(d));

  // Adaptive: harder subjects get more attempts (5-10 based on difficulty)
  const smartAttempts = Math.min(10, 5 + Math.floor(unidad.dificultad / 30));

  for (let i = 0; i < smartAttempts && state.backtrackCount < state.config.maxBacktrack; i++) {
    state.backtrackCount++;
    const permuted = [...shuffleArray([...diasNoUsados]), ...shuffleArray([...diasYaUsados])];
    resultado = intentarAsignarSesion(state, unidad, nBloques, sesionIndex, permuted, false, false);
    if (resultado) return resultado;
  }

  // Fallback: Allow same-day (full random permutation) before resorting to AIR/SinDocente
  for (let i = 0; i < 5 && state.backtrackCount < state.config.maxBacktrack; i++) {
    state.backtrackCount++;
    const fullPermuted = shuffleArray([...ordenDias]);
    resultado = intentarAsignarSesion(state, unidad, nBloques, sesionIndex, fullPermuted, false, false);
    if (resultado) return resultado;
  }

  // Fallback 1: AIR (fictitious space) — keeps docente
  if (state.config.permitirAIR) {
    resultado = intentarAsignarSesion(state, unidad, nBloques, sesionIndex, ordenDias, true, false);
    if (resultado) return resultado;
  }

  // Fallback 2: Sin Docente — keeps physical space
  if (state.config.permitirSinDocente) {
    resultado = intentarAsignarSesion(state, unidad, nBloques, sesionIndex, ordenDias, false, true);
    if (resultado) return resultado;
  }

  // Fallback 3: Both comodines — last resort
  if (state.config.permitirAIR && state.config.permitirSinDocente) {
    resultado = intentarAsignarSesion(state, unidad, nBloques, sesionIndex, ordenDias, true, true);
    if (resultado) return resultado;
  }

  return null;
}

function calcularOrdenDias(state: SchedulerState, unidad: UnidadTrabajo, sesionIndex: number): Dia[] {
  const dias = DIAS.filter((d) => d !== "Sábado" || tieneSabadoHabilitado(state));
  const studentKey = buildStudentGroupKey(unidad.materia.carrera, unidad.materia.semestre, unidad.materia.grupoCodigo);

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

  // SC-03: Prefer non-contiguous days when distribucionNoContigua is enabled
  // E.g., if session 1 is on Monday, prefer Wednesday/Friday over Tuesday/Thursday
  if (state.config.distribucionNoContigua && diasUsados.length > 0) {
    const diaIndex: Record<Dia, number> = {
      "Lunes": 0, "Martes": 1, "Miércoles": 2, "Jueves": 3, "Viernes": 4, "Sábado": 5
    };
    const usadosIdx = diasUsados.map((d) => diaIndex[d as Dia]);

    // Separate non-contiguous and contiguous days among unused days
    const noContiguos = sinUsar.filter((d) => {
      const idx = diaIndex[d];
      return !usadosIdx.some((ui) => Math.abs(idx - ui) === 1);
    });
    const contiguos = sinUsar.filter((d) => {
      const idx = diaIndex[d];
      return usadosIdx.some((ui) => Math.abs(idx - ui) === 1);
    });

    return [...noContiguos, ...contiguos, ...usados];
  }

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
  const ventanasBase = generarVentanas(nBloques, materia.turno, state);

  // Student group key (carrera + semestre + grupoCodigo) — NOT including materia
  // Uses centralized normalization to handle inconsistencies from Excel data
  const studentGroupKey = buildStudentGroupKey(materia.carrera, materia.semestre, materia.grupoCodigo);

  for (const dia of ordenDias) {
    if (dia === "Sábado" && !esVentanaSabadoValida(materia.turno, state)) continue;

    // SC-BRIDGE: Sort windows to prefer slots adjacent to existing group assignments
    // This avoids "puentes" (gaps) in the student group's daily schedule
    const ventanas = ordenarVentanasSinPuentes(ventanasBase, state, studentGroupKey, dia);

    for (const ventana of ventanas) {
      if (dia === "Sábado" && !slotEnTurnoSabado(ventana.slots, state)) continue;

      // ═══ HC-05: Check student group overlap FIRST (cheapest check) ═══
      // Students in the same carrera+semestre+grupo cannot have two classes at the same time
      const conflictSlot = ventana.slots.find((slot) =>
        state.estudiantesOcupados.has(`${studentGroupKey}|${dia}|${slot}`)
      );
      if (conflictSlot) {
        // This window is blocked for this student group
        continue;
      }

      // ═══ HC-08: Max 7 periods per day for student group ═══
      const cargaDiariaKey = `${studentGroupKey}|${dia}`;
      const cargaActual = state.grupoCargaDiaria.get(cargaDiariaKey) || 0;
      if (cargaActual + nBloques > 7) continue;

      for (const docente of docentesCand) {
        if (docente !== null) {
          // HC-03: Docente must be available in ALL slots of the window
          if (!verificarDisponibilidad(docente, dia, ventana.slots)) continue;
          // HC-04: Docente must be habilitado for this materia
          if (!verificarHabilitacion(docente, materia.codigo)) continue;
          // HC-01: Docente can't be in two places at once
          if (verificarSolapamientoDocente(state, docente.id, dia, ventana.slots)) continue;
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

  const studentGroupKey = buildStudentGroupKey(asig.carrera, asig.semestre, asig.grupoCodigo);

  for (const slot of asig.slots) {
    // Mark docente as occupied
    if (asig.docenteId !== null) {
      state.docenteOcupado.set(`${asig.docenteId}|${asig.dia}|${slot}`, true);
    }
    // Mark space as occupied
    if (asig.espacioId !== null && !asig.esAIR) {
      state.espacioOcupado.set(`${asig.espacioId}|${asig.dia}|${slot}`, true);
    }
    // Mark student group time as occupied
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

  // Sort by soft constraint scoring: SC-01 (turno coherence) + SC-02 (weekly distribution) + priority
  candidatos.sort((a, b) => {
    const aPrio = state.config.docentesPrioritarios.includes(a.ci) ? 0 : 1;
    const bPrio = state.config.docentesPrioritarios.includes(b.ci) ? 0 : 1;
    if (aPrio !== bPrio) return aPrio - bPrio;

    // SC-01: Prefer docentes whose existing assignments are in the SAME turno as this materia
    const aCoherencia = calcularCoherenciaTurno(state, a.id, materia.turno);
    const bCoherencia = calcularCoherenciaTurno(state, b.id, materia.turno);
    if (aCoherencia !== bCoherencia) return bCoherencia - aCoherencia; // Higher coherence = better

    // SC-02: Prefer docentes with more balanced weekly distribution (less concentrated)
    const aDistribucion = calcularDistribucionSemanal(state, a.id);
    const bDistribucion = calcularDistribucionSemanal(state, b.id);
    if (aDistribucion !== bDistribucion) return aDistribucion - bDistribucion; // Lower = more balanced

    // Tiebreaker: less total load first
    return countDocenteLoad(state, a.id) - countDocenteLoad(state, b.id);
  });

  return candidatos;
}

// SC-01: Returns a coherence score (0-1) for how much of the docente's existing load
// is in the same turno as the target materia. 1 = all in same turno, 0 = all in different.
function calcularCoherenciaTurno(state: SchedulerState, docenteId: number, turnoMateria: Turno): number {
  const asigs = state.asignaciones.filter((a) => a.docenteId === docenteId);
  if (asigs.length === 0) return 1; // No existing load = perfect coherence
  const enMismoTurno = asigs.filter((a) => a.turno === turnoMateria).length;
  return enMismoTurno / asigs.length;
}

// SC-02: Returns a concentration score. Higher = more concentrated in fewer days (worse).
// Measures max slots in a single day / total slots. 0 = perfectly distributed.
function calcularDistribucionSemanal(state: SchedulerState, docenteId: number): number {
  const asigs = state.asignaciones.filter((a) => a.docenteId === docenteId);
  if (asigs.length === 0) return 0;

  const cargaPorDia = new Map<string, number>();
  for (const a of asigs) {
    const actual = cargaPorDia.get(a.dia) || 0;
    cargaPorDia.set(a.dia, actual + a.slots.length);
  }

  const totalSlots = asigs.reduce((sum, a) => sum + a.slots.length, 0);
  const maxEnUnDia = Math.max(...cargaPorDia.values());
  // Ratio: 1 = all load in one day (worst), close to 0 = well distributed (best)
  return maxEnUnDia / totalSlots;
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
      e.escuela === materia.escuela &&            // HC: School ownership — strict match
      e.aforo >= (materia.proyeccionInscritos || 0)
    )
    .sort((a, b) => {
      // Prefer smallest room that fits (minimize waste)
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

// SC-BRIDGE: Orders windows to prefer those adjacent to existing group assignments on the same day.
// This prevents "puentes" (free periods between classes) for the student group.
// Priority: gap=0 (adjacent) > gap=1 (max allowed bridge) > gap>1 (strongly penalized)
function ordenarVentanasSinPuentes(
  ventanas: Ventana[], state: SchedulerState, studentGroupKey: string, dia: Dia
): Ventana[] {
  // Find all slots already occupied by this student group on this day
  const occupiedSlotIndices: number[] = [];
  for (let i = 0; i < SLOTS.length; i++) {
    if (state.estudiantesOcupados.has(`${studentGroupKey}|${dia}|${SLOTS[i]}`)) {
      occupiedSlotIndices.push(i);
    }
  }

  // If no existing classes on this day, prefer earlier slots (fills schedule from start)
  if (occupiedSlotIndices.length === 0) {
    return [...ventanas]; // Already ordered by start time
  }

  const minOccupied = Math.min(...occupiedSlotIndices);
  const maxOccupied = Math.max(...occupiedSlotIndices);

  // Score each window by gap distance
  const scored = ventanas.map((v) => {
    const windowStart = SLOTS.indexOf(v.slots[0]);
    const windowEnd = SLOTS.indexOf(v.slots[v.slots.length - 1]);

    let gapScore: number;
    if (windowEnd < minOccupied) {
      // Window is entirely before existing classes
      gapScore = minOccupied - windowEnd - 1;
    } else if (windowStart > maxOccupied) {
      // Window is entirely after existing classes
      gapScore = windowStart - maxOccupied - 1;
    } else {
      // Window overlaps or is adjacent — perfect
      gapScore = 0;
    }

    // Strongly penalize gaps > 1 period (make them very unlikely to be chosen)
    const penalty = gapScore > 1 ? gapScore * 100 : gapScore;

    return { ventana: v, penalty };
  });

  // Sort: smallest penalty first
  scored.sort((a, b) => a.penalty - b.penalty);
  return scored.map((s) => s.ventana);
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

// ─── STUDENT GROUP KEY NORMALIZATION ────────────────────────────────────────
// Centralizes the logic for building a unique key that identifies a group of students.
// This handles inconsistencies in the Excel data where the same group might appear with
// slightly different encoding (e.g., "2AM" vs "2Am", extra spaces, accents, etc.)
//
// The key is: CARRERA|SEMESTRE|GRUPO_NORMALIZADO
// Where GRUPO_NORMALIZADO removes accents, extra spaces, and normalizes case.

function buildStudentGroupKey(carrera: string, semestre: string, grupoCodigo: string): string {
  const normalizedCarrera = normalizeString(carrera);
  const normalizedSemestre = normalizeString(semestre);
  const normalizedGrupo = normalizeString(grupoCodigo);
  return `${normalizedCarrera}|${normalizedSemestre}|${normalizedGrupo}`;
}

function normalizeString(s: string): string {
  return s
    .trim()
    .toUpperCase()
    .normalize("NFD")                    // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, "")     // Remove diacritic marks (tildes, etc.)
    .replace(/\s+/g, " ");               // Collapse multiple spaces into one
}

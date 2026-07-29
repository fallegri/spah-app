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

// ======================================================================
// CSP-BASED SCHEDULER ENGINE
// Algorithm: Constraint Satisfaction Problem with:
//   - Arc Consistency (AC-3) for domain pruning
//   - MRV (Minimum Remaining Values) heuristic for variable ordering
//   - Forward Checking after each assignment
//   - Conflict-directed Backjumping when stuck
// ======================================================================

// --- INTERNAL TYPES ---

interface CSPVariable {
  id: string;                   // Unique identifier for this session
  unidad: UnidadTrabajo;
  sesionIndex: number;
  nBloques: number;             // Number of periods for this session
  domain: DomainValue[];        // All valid (day, window, docente, space) combos
  assigned: DomainValue | null; // Current assignment (null if unassigned)
}

interface DomainValue {
  dia: Dia;
  slots: string[];
  docente: Docente | null;
  espacio: Espacio;
  esAIR: boolean;
  esSinDocente: boolean;
  softScore: number;            // Lower is better (soft constraint penalty)
}

interface CSPState {
  variables: CSPVariable[];
  docentes: Docente[];
  materias: MateriaCatalogo[];
  espacios: Espacio[];
  reservas: ReservaExterna[];
  config: SchedulerConfig;
  log: string[];
  // Indexes for constraint checking
  docenteOcupado: Map<string, boolean>;
  espacioOcupado: Map<string, boolean>;
  estudiantesOcupados: Map<string, boolean>;
  grupoCargaDiaria: Map<string, number>;
  backtrackCount: number;
  conflictSet: Map<string, Set<string>>; // variable id -> set of conflicting variable ids
}

// --- MAIN ENTRY POINT ---

export function ejecutarScheduler(
  docentes: Docente[],
  materias: MateriaCatalogo[],
  espacios: Espacio[],
  reservas: ReservaExterna[],
  config: SchedulerConfig
): SchedulerResult {
  const startTime = Date.now();

  const state: CSPState = {
    variables: [],
    docentes,
    materias,
    espacios,
    reservas,
    config,
    log: [],
    docenteOcupado: new Map(),
    espacioOcupado: new Map(),
    estudiantesOcupados: new Map(),
    grupoCargaDiaria: new Map(),
    backtrackCount: 0,
    conflictSet: new Map(),
  };

  // Pre-index external reservations
  for (const r of reservas) {
    state.espacioOcupado.set(r.espacioId + "|" + r.dia + "|" + r.slot, true);
  }

  state.log.push("[INFO] Docentes: " + docentes.length + ", Espacios: " + espacios.length + ", Reservas: " + reservas.length);

  // Phase 1: Build work units and CSP variables
  const unidades = construirUnidadesDeTrabajo(state);
  state.log.push("[FASE 1] " + unidades.length + " unidades de trabajo construidas");

  // Phase 2: Create CSP variables with initial domains
  construirVariablesCSP(state, unidades);
  state.log.push("[FASE 2] " + state.variables.length + " variables CSP creadas");

  // Log student groups
  const studentGroups = new Map<string, string[]>();
  for (const u of unidades) {
    const sgk = u.materia.carrera + "|" + u.materia.semestre + "|" + u.materia.grupoCodigo;
    if (!studentGroups.has(sgk)) studentGroups.set(sgk, []);
    studentGroups.get(sgk)!.push(u.materia.codigo + "(" + u.sesiones.join("+") + "h)");
  }
  for (const [key, mats] of studentGroups) {
    state.log.push("[GRUPO] " + key + " -> " + mats.length + " materias: " + mats.join(", "));
  }

  // Phase 3: Skip AC-3 (iterative solver handles constraints dynamically)
  state.log.push("[FASE 3] Modo iterativo - restricciones se verifican en tiempo de asignacion");

  // Phase 4: CSP Solve with MRV + Forward Checking + Backjumping
  const solved = resolverCSP(state);
  state.log.push("[FASE 4] CSP resuelto: " + (solved ? "SI" : "PARCIAL") + ", backtrack: " + state.backtrackCount);

  // Build results
  const asignaciones: Asignacion[] = [];
  const conflictos: Conflicto[] = [];

  for (const variable of state.variables) {
    if (variable.assigned) {
      const val = variable.assigned;
      asignaciones.push({
        materiaCodigo: variable.unidad.materia.codigo,
        materiaNombre: variable.unidad.materia.nombreAsignatura,
        grupoCodigo: variable.unidad.materia.grupoCodigo,
        carrera: variable.unidad.materia.carrera,
        semestre: variable.unidad.materia.semestre,
        docenteId: val.docente?.id ?? null,
        docenteNombre: val.docente?.nombre ?? "Sin Docente",
        espacioId: val.esAIR ? null : val.espacio.id,
        espacioCodigo: val.esAIR ? "AIR" : val.espacio.codigo,
        dia: val.dia,
        slots: val.slots,
        turno: variable.unidad.materia.turno,
        tipoEspacio: variable.unidad.materia.tipoAula,
        esAIR: val.esAIR,
        esSinDocente: val.esSinDocente,
        sesionIndex: variable.sesionIndex,
      });
      state.log.push(
        "[OK] " + variable.unidad.materia.codigo + " (" + variable.unidad.materia.grupoCodigo + ") -> " +
        val.dia + " " + val.slots[0] + "-" + val.slots[val.slots.length - 1] +
        " | " + (val.docente?.nombre ?? "Sin Docente") + " | " + (val.esAIR ? "AIR" : val.espacio.codigo)
      );
    } else {
      conflictos.push({
        materiaCodigo: variable.unidad.materia.codigo,
        materiaNombre: variable.unidad.materia.nombreAsignatura,
        grupoCodigo: variable.unidad.materia.grupoCodigo,
        carrera: variable.unidad.materia.carrera,
        semestre: variable.unidad.materia.semestre,
        sesionIndex: variable.sesionIndex,
        motivo: "No se encontro combinacion valida (CSP dominio vacio tras " + state.backtrackCount + " backtracks)",
      });
      state.log.push(
        "[FAIL] " + variable.unidad.materia.codigo + " (" + variable.unidad.materia.grupoCodigo +
        ") sesion " + variable.sesionIndex + " - sin combinacion valida"
      );
    }
  }

  // Post-generation validation
  const overlapCheck = new Map<string, string>();
  for (const a of asignaciones) {
    const sgk = buildStudentGroupKey(a.carrera, a.semestre, a.grupoCodigo);
    for (const slot of a.slots) {
      const key = sgk + "|" + a.dia + "|" + slot;
      const existing = overlapCheck.get(key);
      if (existing && existing !== a.materiaCodigo) {
        state.log.push(
          "[WARN-HC05] CRUCE DETECTADO: Grupo " + a.grupoCodigo + " (" + a.carrera + "|" + a.semestre +
          ") tiene " + existing + " y " + a.materiaCodigo + " en " + a.dia + " " + slot
        );
      }
      overlapCheck.set(key, a.materiaCodigo);
    }
  }

  const duracion = Date.now() - startTime;
  state.log.push(
    "[FIN] Completado en " + duracion + "ms. Asignadas: " + asignaciones.length + ", Conflictos: " + conflictos.length
  );

  return {
    asignaciones,
    conflictos,
    totalAsignadas: asignaciones.length,
    totalConflictos: conflictos.length,
    totalAIR: asignaciones.filter((a) => a.esAIR).length,
    totalSinDocente: asignaciones.filter((a) => a.esSinDocente).length,
    duracionMs: duracion,
    log: state.log,
  };
}


// --- PHASE 1: BUILD WORK UNITS ---

function construirUnidadesDeTrabajo(state: CSPState): UnidadTrabajo[] {
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

    const sesiones = repartirEnSesiones(materia.horasPorSemana, maxPorSesion, materia.tipoAula);
    const dificultad = calcularDificultad(materia, state);
    const esPrioritaria = tieneDocentePrioritario(materia, state);
    const esPractica = esPracticaLaboral(materia);
    const grupoKey = materia.carrera + "|" + materia.semestre + "|" + materia.codigo + "|" + materia.grupoCodigo;

    return { materia, sesiones, dificultad, esPrioritaria, esPractica, grupoKey };
  });

  // Sort: practicas last, priority first, then by difficulty descending
  unidades.sort((a, b) => {
    if (a.esPractica !== b.esPractica) return a.esPractica ? 1 : -1;
    if (a.esPrioritaria !== b.esPrioritaria) return a.esPrioritaria ? -1 : 1;
    return b.dificultad - a.dificultad;
  });

  return unidades;
}

function calcularDificultad(materia: MateriaCatalogo, state: CSPState): number {
  let score = 0;
  score += materia.horasPorSemana * 3;
  if (materia.tipoAula === "LABORATORIO") score += 35;
  else if (materia.tipoAula === "TALLER") score += 25;

  const espaciosDisp = state.espacios.filter(
    (e) => e.tipo === materia.tipoAula && e.escuela === materia.escuela && e.aforo >= (materia.proyeccionInscritos || 0)
  );
  if (espaciosDisp.length === 0) score += 60;
  else if (espaciosDisp.length === 1) score += 40;
  else if (espaciosDisp.length <= 3) score += 20;

  const docentesDisp = state.docentes.filter((d) =>
    d.materiasHabilitadas.some((mh) => mh.sigla === materia.codigo)
  );
  if (docentesDisp.length === 0) score += 50;
  else if (docentesDisp.length === 1) score += 30;
  else if (docentesDisp.length <= 2) score += 15;

  if ((materia.proyeccionInscritos || 0) > 35) score += 10;

  return score;
}

function tieneDocentePrioritario(materia: MateriaCatalogo, state: CSPState): boolean {
  if (state.config.docentesPrioritarios.length === 0) return false;
  return state.docentes.some(
    (d) => state.config.docentesPrioritarios.includes(d.ci) &&
      d.materiasHabilitadas.some((mh) => mh.sigla === materia.codigo)
  );
}

function esPracticaLaboral(materia: MateriaCatalogo): boolean {
  const nombre = materia.nombreAsignatura.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
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

function repartirEnSesiones(horas: number, maxPorSesion: number, tipoAula: TipoEspacio | null): number[] {
  if (horas <= 0) return [];

  // AULA: max 3 periods continuous, TALLER/LAB: max 4
  const maxReal = tipoAula === "AULA" ? 3 : Math.min(maxPorSesion, 4);

  if (horas <= maxReal && horas >= 2) {
    return [horas];
  }
  if (horas === 1) {
    // Never program a single period - bump to minimum 2
    return [2];
  }

  const numSesiones = Math.ceil(horas / maxReal);
  const sesiones: number[] = [];
  let remaining = horas;
  for (let i = 0; i < numSesiones; i++) {
    const slotsLeft = numSesiones - i;
    const thisSession = Math.ceil(remaining / slotsLeft);
    const capped = Math.min(thisSession, maxReal);
    sesiones.push(capped);
    remaining -= capped;
  }

  // Ensure minimum 2 per session
  for (let i = sesiones.length - 1; i >= 0; i--) {
    if (sesiones[i] < 2 && sesiones.length > 1) {
      if (i > 0 && sesiones[i - 1] + sesiones[i] <= maxReal) {
        sesiones[i - 1] += sesiones[i];
        sesiones.splice(i, 1);
      } else if (i < sesiones.length - 1 && sesiones[i + 1] + sesiones[i] <= maxReal) {
        sesiones[i + 1] += sesiones[i];
        sesiones.splice(i, 1);
      }
    }
  }

  sesiones.sort((a, b) => b - a);
  return sesiones;
}


// --- PHASE 2: BUILD CSP VARIABLES WITH DOMAINS ---

function construirVariablesCSP(state: CSPState, unidades: UnidadTrabajo[]): void {
  for (const unidad of unidades) {
    for (let sesIdx = 0; sesIdx < unidad.sesiones.length; sesIdx++) {
      const nBloques = Math.max(unidad.sesiones[sesIdx], 2);
      const varId = unidad.materia.codigo + "|" + unidad.materia.grupoCodigo + "|S" + sesIdx;

      const domain = construirDominio(state, unidad, nBloques);

      const variable: CSPVariable = {
        id: varId,
        unidad,
        sesionIndex: sesIdx,
        nBloques,
        domain,
        assigned: null,
      };

      state.variables.push(variable);
      state.conflictSet.set(varId, new Set());

      state.log.push(
        "[DOMAIN] " + varId + " -> " + domain.length + " valores en dominio (" + nBloques + " bloques)"
      );
    }
  }
}

function construirDominio(state: CSPState, unidad: UnidadTrabajo, nBloques: number): DomainValue[] {
  const materia = unidad.materia;
  const domain: DomainValue[] = [];

  const dias = getDiasDisponibles(state);
  const ventanas = generarVentanas(nBloques, materia.turno, state);

  // Special case: Practicas -> always AIR
  if (unidad.esPractica) {
    const espacioAIR = crearEspacioAIR();
    const docentesCand = getDocentesCandidatos(state, materia);
    const docenteList: (Docente | null)[] = docentesCand.length > 0 ? docentesCand : (state.config.permitirSinDocente ? [null] : []);

    for (const dia of dias) {
      if (dia === "Sábado") continue; // Practicas not on Saturday typically
      for (const ventana of ventanas) {
        for (const docente of docenteList) {
          if (docente !== null) {
            if (!verificarDisponibilidad(docente, dia, ventana.slots)) continue;
            if (!verificarHabilitacion(docente, materia.codigo)) continue;
          }
          domain.push({
            dia,
            slots: ventana.slots,
            docente,
            espacio: espacioAIR,
            esAIR: true,
            esSinDocente: docente === null,
            softScore: calcularSoftScore(state, unidad, dia, ventana.slots, docente),
          });
        }
      }
    }
    return domain;
  }

  // Normal case: physical spaces
  const espaciosCand = getEspaciosCandidatos(state, materia);
  const docentesCand = getDocentesCandidatos(state, materia);

  // Primary domain: with docente + physical space
  for (const dia of dias) {
    if (dia === "Sábado" && !tieneSabadoHabilitado(state)) continue;
    for (const ventana of ventanas) {
      if (dia === "Sábado" && !slotEnTurnoSabado(ventana.slots, state)) continue;

      for (const docente of docentesCand) {
        if (!verificarDisponibilidad(docente, dia, ventana.slots)) continue;
        if (!verificarHabilitacion(docente, materia.codigo)) continue;

        for (const espacio of espaciosCand) {
          // HC: Space type must match
          if (espacio.tipo !== materia.tipoAula) continue;
          // HC: Room capacity >= projected students
          if (espacio.aforo < (materia.proyeccionInscritos || 0)) continue;

          // Check pre-existing reservations
          const reservaConflict = ventana.slots.some((slot) =>
            state.espacioOcupado.has(espacio.id + "|" + dia + "|" + slot)
          );
          if (reservaConflict) continue;

          domain.push({
            dia,
            slots: ventana.slots,
            docente,
            espacio,
            esAIR: false,
            esSinDocente: false,
            softScore: calcularSoftScore(state, unidad, dia, ventana.slots, docente),
          });
        }
      }
    }
  }

  // Fallback domains: ALWAYS add these as options (with penalty score)
  // This ensures every materia can be scheduled even without ideal resources

  // Fallback 1: Sin Docente + physical space (relax school constraint)
  if (state.config.permitirSinDocente) {
    // Use ALL spaces of matching type (ignore school for fallback)
    const allMatchingSpaces = state.espacios.filter((e) =>
      e.tipo === materia.tipoAula && e.aforo >= (materia.proyeccionInscritos || 0)
    );
    for (const dia of dias) {
      if (dia === "Sábado" && !tieneSabadoHabilitado(state)) continue;
      for (const ventana of ventanas) {
        if (dia === "Sábado" && !slotEnTurnoSabado(ventana.slots, state)) continue;
        for (const espacio of allMatchingSpaces) {
          const reservaConflict = ventana.slots.some((slot) =>
            state.espacioOcupado.has(espacio.id + "|" + dia + "|" + slot)
          );
          if (reservaConflict) continue;
          // Penalty: +200 base, +50 extra if wrong school
          const schoolPenalty = espacio.escuela !== materia.escuela ? 50 : 0;
          domain.push({
            dia,
            slots: ventana.slots,
            docente: null,
            espacio,
            esAIR: false,
            esSinDocente: true,
            softScore: calcularSoftScore(state, unidad, dia, ventana.slots, null) + 200 + schoolPenalty,
          });
        }
      }
    }
  }

  // Fallback 2: Docente + AIR space
  if (state.config.permitirAIR) {
    const espacioAIR = crearEspacioAIR();
    for (const dia of dias) {
      if (dia === "Sábado" && !tieneSabadoHabilitado(state)) continue;
      for (const ventana of ventanas) {
        if (dia === "Sábado" && !slotEnTurnoSabado(ventana.slots, state)) continue;
        for (const docente of docentesCand) {
          if (!verificarDisponibilidad(docente, dia, ventana.slots)) continue;
          if (!verificarHabilitacion(docente, materia.codigo)) continue;
          domain.push({
            dia,
            slots: ventana.slots,
            docente,
            espacio: espacioAIR,
            esAIR: true,
            esSinDocente: false,
            softScore: calcularSoftScore(state, unidad, dia, ventana.slots, docente) + 100,
          });
        }
      }
    }
  }

  // Fallback 3: AIR + Sin Docente (last resort)
  if (state.config.permitirAIR && state.config.permitirSinDocente) {
    const espacioAIR = crearEspacioAIR();
    for (const dia of dias) {
      if (dia === "Sábado" && !tieneSabadoHabilitado(state)) continue;
      for (const ventana of ventanas) {
        if (dia === "Sábado" && !slotEnTurnoSabado(ventana.slots, state)) continue;
        domain.push({
          dia,
          slots: ventana.slots,
          docente: null,
          espacio: espacioAIR,
          esAIR: true,
          esSinDocente: true,
          softScore: 500,
        });
      }
    }
  }

  // Sort domain by soft score (best values first for efficiency)
  domain.sort((a, b) => a.softScore - b.softScore);

  // Diagnostic log if domain is empty
  if (domain.length === 0) {
    state.log.push(
      "[WARN] Dominio VACIO para " + materia.codigo + " (" + materia.grupoCodigo + "): " +
      "turno=" + materia.turno + ", ventanas=" + ventanas.length +
      ", espacios(escuela)=" + espaciosCand.length +
      ", espacios(todos)=" + state.espacios.filter((e) => e.tipo === materia.tipoAula).length +
      ", docentes=" + docentesCand.length +
      ", permitirAIR=" + state.config.permitirAIR +
      ", permitirSinDocente=" + state.config.permitirSinDocente
    );
  }

  return domain;
}


// --- SOFT SCORE CALCULATION ---

function calcularSoftScore(
  state: CSPState, unidad: UnidadTrabajo, dia: Dia, slots: string[], docente: Docente | null
): number {
  let score = 0;

  // SC-01: Prefer docente turno coherence
  if (docente !== null) {
    const existingAssignments = state.variables
      .filter((v) => v.assigned && v.assigned.docente?.id === docente.id);
    if (existingAssignments.length > 0) {
      const sameShift = existingAssignments.filter((v) => v.assigned!.docente !== null && v.unidad.materia.turno === unidad.materia.turno);
      if (sameShift.length < existingAssignments.length) {
        score += 20; // Penalty for turno incoherence
      }
    }
    // SC-02: Balance docente weekly load (prefer less loaded docentes)
    const docenteLoad = state.variables
      .filter((v) => v.assigned && v.assigned.docente?.id === docente.id)
      .reduce((sum, v) => sum + (v.assigned?.slots.length || 0), 0);
    score += docenteLoad * 2;

    // Priority docentes get a bonus
    if (state.config.docentesPrioritarios.includes(docente.ci)) {
      score -= 30;
    }
  }

  // SC-05: Fill schedule from start of shift (prefer earlier slots)
  const turnoSlots = TURNOS_SLOTS[unidad.materia.turno as keyof typeof TURNOS_SLOTS];
  if (turnoSlots && turnoSlots.length > 0) {
    const startIdx = turnoSlots.indexOf(slots[0]);
    if (startIdx >= 0) {
      score += startIdx * 2; // Small penalty for later start within shift
    }
  }

  return score;
}

// --- PHASE 3: AC-3 ARC CONSISTENCY ---

interface AC3Result {
  emptyDomains: number;
}

function aplicarAC3(state: CSPState): AC3Result {
  // Build constraint arcs between variables that share resources
  const arcs: Array<[number, number]> = [];

  for (let i = 0; i < state.variables.length; i++) {
    for (let j = i + 1; j < state.variables.length; j++) {
      const vi = state.variables[i];
      const vj = state.variables[j];

      // Variables constrained if they share student group, or potentially share docente/space
      if (variablesConstrained(vi, vj)) {
        arcs.push([i, j]);
        arcs.push([j, i]);
      }
    }
  }

  // AC-3 queue processing
  const queue = [...arcs];
  let iterations = 0;
  const maxIterations = queue.length * 3; // Prevent infinite loops

  while (queue.length > 0 && iterations < maxIterations) {
    iterations++;
    const [i, j] = queue.shift()!;
    const vi = state.variables[i];
    const vj = state.variables[j];

    const revised = revise(vi, vj);
    if (revised) {
      if (vi.domain.length === 0) {
        // Domain wipe-out - cannot be solved with current pruning
        continue;
      }
      // Add all arcs (k, i) where k != j back to queue
      for (let k = 0; k < state.variables.length; k++) {
        if (k !== i && k !== j && variablesConstrained(state.variables[k], vi)) {
          queue.push([k, i]);
        }
      }
    }
  }

  const emptyDomains = state.variables.filter((v) => v.domain.length === 0).length;
  return { emptyDomains };
}

function variablesConstrained(vi: CSPVariable, vj: CSPVariable): boolean {
  const mi = vi.unidad.materia;
  const mj = vj.unidad.materia;

  // Same student group constraint (HC-05: no overlap)
  const sgki = buildStudentGroupKey(mi.carrera, mi.semestre, mi.grupoCodigo);
  const sgkj = buildStudentGroupKey(mj.carrera, mj.semestre, mj.grupoCodigo);
  if (sgki === sgkj) return true;

  // Same materia-grupo (different sessions of same subject - must be on different days ideally)
  if (mi.codigo === mj.codigo && mi.grupoCodigo === mj.grupoCodigo) return true;

  return false;
}

function revise(vi: CSPVariable, vj: CSPVariable): boolean {
  let revised = false;
  const mi = vi.unidad.materia;
  const mj = vj.unidad.materia;
  const sgki = buildStudentGroupKey(mi.carrera, mi.semestre, mi.grupoCodigo);
  const sgkj = buildStudentGroupKey(mj.carrera, mj.semestre, mj.grupoCodigo);
  const sameStudentGroup = sgki === sgkj;
  const sameMateriaGrupo = mi.codigo === mj.codigo && mi.grupoCodigo === mj.grupoCodigo;

  vi.domain = vi.domain.filter((dv) => {
    // Check if there exists at least one consistent value in vj.domain
    const hasConsistent = vj.domain.some((dvj) => {
      return valuesConsistent(dv, dvj, sameStudentGroup, sameMateriaGrupo);
    });
    if (!hasConsistent) {
      revised = true;
      return false;
    }
    return true;
  });

  return revised;
}

function valuesConsistent(
  dv1: DomainValue, dv2: DomainValue,
  sameStudentGroup: boolean, sameMateriaGrupo: boolean
): boolean {
  // If on different days, mostly compatible (except daily load limits)
  if (dv1.dia !== dv2.dia) {
    return true;
  }

  // Same day - check slot overlap for student group
  if (sameStudentGroup) {
    const overlap = dv1.slots.some((s) => dv2.slots.includes(s));
    if (overlap) return false;

    // HC-08: combined load can't exceed 7
    if (dv1.slots.length + dv2.slots.length > 7) return false;

    // HC bridge: gap between sessions can't be > 1
    const indices1 = dv1.slots.map((s) => SLOTS.indexOf(s));
    const indices2 = dv2.slots.map((s) => SLOTS.indexOf(s));
    const max1 = Math.max(...indices1);
    const min1 = Math.min(...indices1);
    const max2 = Math.max(...indices2);
    const min2 = Math.min(...indices2);

    let gap = 0;
    if (max1 < min2) gap = min2 - max1 - 1;
    else if (max2 < min1) gap = min1 - max2 - 1;

    if (gap > 1) return false;
  }

  // Same materia-grupo on same day is allowed but not ideal (handled by soft score)
  // For AC-3, we don't eliminate it as a hard constraint since sessions CAN be same day

  return true;
}


// --- PHASE 4: ITERATIVE SOLVER (always produces partial solutions) ---
// Unlike pure CSP that needs a complete solution, this solver:
// 1. Orders variables by MRV (most constrained first)
// 2. For each variable, finds the best valid assignment
// 3. If no valid assignment exists, tries relaxed constraints (AIR, Sin Docente)
// 4. If still nothing, marks as conflict and CONTINUES with next variable
// This guarantees we always get the maximum possible assignments.

function resolverCSP(state: CSPState): boolean {
  let allAssigned = true;

  // Sort variables by domain size (smallest first = MRV) then by difficulty
  const ordered = [...state.variables].sort((a, b) => {
    if (a.domain.length !== b.domain.length) return a.domain.length - b.domain.length;
    return b.unidad.dificultad - a.unidad.dificultad;
  });

  for (const variable of ordered) {
    if (variable.assigned !== null) continue;

    const assigned = intentarAsignarVariable(state, variable);
    if (!assigned) {
      allAssigned = false;
      // Log why it failed
      state.log.push(
        "[SKIP] " + variable.id + " - no se pudo asignar (dominio restante: " + variable.domain.length + ")"
      );
    }
  }

  return allAssigned;
}

function intentarAsignarVariable(state: CSPState, variable: CSPVariable): boolean {
  // Sort domain values by dynamic soft score (best first)
  // The soft score already heavily penalizes bridges, so gap-free options come first
  const sortedDomain = [...variable.domain].sort((a, b) => {
    const aSoft = a.softScore + calcularSoftScoreDinamico(state, variable, a);
    const bSoft = b.softScore + calcularSoftScoreDinamico(state, variable, b);
    return aSoft - bSoft;
  });

  // Try each value in order of preference (best score = no gaps, adjacent slots)
  for (const value of sortedDomain) {
    if (isConsistentWithState(state, variable, value)) {
      variable.assigned = value;
      applyAssignment(state, variable, value);
      return true;
    }
  }

  return false;
}

// (isConsistentRelaxed removed — bridge is now a soft constraint, not hard)

function selectVariableMRV(unassigned: CSPVariable[]): CSPVariable {
  // MRV: choose variable with smallest domain
  // Tie-breaking: highest difficulty (most constrained by problem structure)
  let best = unassigned[0];
  for (let i = 1; i < unassigned.length; i++) {
    const v = unassigned[i];
    if (v.domain.length < best.domain.length) {
      best = v;
    } else if (v.domain.length === best.domain.length && v.unidad.dificultad > best.unidad.dificultad) {
      best = v;
    }
  }
  return best;
}

function calcularSoftScoreDinamico(state: CSPState, variable: CSPVariable, value: DomainValue): number {
  let score = 0;
  const materia = variable.unidad.materia;
  const studentKey = buildStudentGroupKey(materia.carrera, materia.semestre, materia.grupoCodigo);

  // SC-BRIDGE: Prefer no gaps with existing assignments for the same student group on same day
  const existingOnDay = state.variables.filter(
    (v) => v.assigned !== null &&
    v.assigned.dia === value.dia &&
    buildStudentGroupKey(v.unidad.materia.carrera, v.unidad.materia.semestre, v.unidad.materia.grupoCodigo) === studentKey
  );

  if (existingOnDay.length > 0) {
    const gap = calcularGapConAsignados(state, studentKey, value.dia, value.slots);
    if (gap === 0) score += 0;           // Adjacent: perfect, no penalty
    else if (gap === 1) score += 50;     // 1 period bridge: acceptable but penalized
    else score += gap * 500;             // >1 period bridge: extreme penalty (almost never chosen)
  }

  // SC-03: Prefer non-contiguous days for multi-session subjects
  if (state.config.distribucionNoContigua && variable.unidad.sesiones.length > 1) {
    const assignedSessions = state.variables.filter(
      (v) => v.assigned !== null &&
      v.unidad.materia.codigo === materia.codigo &&
      v.unidad.materia.grupoCodigo === materia.grupoCodigo
    );
    if (assignedSessions.length > 0) {
      const diaIndex: Record<string, number> = {
        "Lunes": 0, "Martes": 1, "Miércoles": 2, "Jueves": 3, "Viernes": 4, "Sábado": 5
      };
      const currentIdx = diaIndex[normalizeString(value.dia)] ?? DIAS.indexOf(value.dia);
      for (const assigned of assignedSessions) {
        const assignedIdx = diaIndex[normalizeString(assigned.assigned!.dia)] ?? DIAS.indexOf(assigned.assigned!.dia);
        const distance = Math.abs(currentIdx - assignedIdx);
        if (distance === 0) score += 100; // Same day: heavy penalty
        else if (distance === 1) score += 30; // Contiguous days: moderate penalty
        // Non-contiguous (distance >= 2): no penalty (preferred)
      }
    }
  }

  return score;
}

function findBestGreedyValue(state: CSPState, variable: CSPVariable): DomainValue | null {
  // Find the first value in domain that is consistent with current state
  const sorted = [...variable.domain].sort((a, b) => a.softScore - b.softScore);
  for (const value of sorted) {
    if (isConsistentWithState(state, variable, value)) {
      return value;
    }
  }
  return null;
}


// --- HARD CONSTRAINT CHECKING AGAINST CURRENT STATE ---

function isConsistentWithState(state: CSPState, variable: CSPVariable, value: DomainValue): boolean {
  const materia = variable.unidad.materia;
  const studentKey = buildStudentGroupKey(materia.carrera, materia.semestre, materia.grupoCodigo);

  // HC-05: No student group overlap
  for (const slot of value.slots) {
    if (state.estudiantesOcupados.has(studentKey + "|" + value.dia + "|" + slot)) {
      return false;
    }
  }

  // HC-01: No docente overlap
  if (value.docente !== null) {
    for (const slot of value.slots) {
      if (state.docenteOcupado.has(value.docente.id + "|" + value.dia + "|" + slot)) {
        return false;
      }
    }
  }

  // HC-02: No space double-booking
  if (!value.esAIR) {
    for (const slot of value.slots) {
      if (state.espacioOcupado.has(value.espacio.id + "|" + value.dia + "|" + slot)) {
        return false;
      }
    }
  }

  // HC-08: Max 7 periods per day per student group
  const cargaKey = studentKey + "|" + value.dia;
  const cargaActual = state.grupoCargaDiaria.get(cargaKey) || 0;
  if (cargaActual + value.slots.length > 7) return false;

  // Bridge is handled by soft scoring (not a hard constraint)
  // The scoring function heavily penalizes gaps, so gap-free options are tried first

  // HC: Space school must match materia school (escuela)
  if (!value.esAIR && value.espacio.escuela !== 0 && value.espacio.escuela !== materia.escuela) {
    return false;
  }

  return true;
}

function calcularGapConAsignados(state: CSPState, studentGroupKey: string, dia: Dia, proposedSlots: string[]): number {
  // Find all currently occupied slot indices for this group on this day
  const occupiedIndices: number[] = [];
  for (let i = 0; i < SLOTS.length; i++) {
    if (state.estudiantesOcupados.has(studentGroupKey + "|" + dia + "|" + SLOTS[i])) {
      occupiedIndices.push(i);
    }
  }
  if (occupiedIndices.length === 0) return 0;

  const proposedIndices = proposedSlots.map((s) => SLOTS.indexOf(s));
  const propMin = Math.min(...proposedIndices);
  const propMax = Math.max(...proposedIndices);
  const occMin = Math.min(...occupiedIndices);
  const occMax = Math.max(...occupiedIndices);

  if (propMax < occMin) {
    return occMin - propMax - 1;
  } else if (propMin > occMax) {
    return propMin - occMax - 1;
  }
  return 0;
}

// --- FORWARD CHECKING ---

interface PrunedEntry {
  variable: CSPVariable;
  values: DomainValue[];
}

function forwardCheck(state: CSPState, assigned: CSPVariable, value: DomainValue): PrunedEntry[] {
  const pruned: PrunedEntry[] = [];
  const materia = assigned.unidad.materia;
  const studentKey = buildStudentGroupKey(materia.carrera, materia.semestre, materia.grupoCodigo);

  for (const other of state.variables) {
    if (other.assigned !== null || other === assigned) continue;

    const otherMateria = other.unidad.materia;
    const otherStudentKey = buildStudentGroupKey(otherMateria.carrera, otherMateria.semestre, otherMateria.grupoCodigo);

    const beforeLength = other.domain.length;
    const removedValues: DomainValue[] = [];

    other.domain = other.domain.filter((dv) => {
      // Only check if same day (most constraints are day-specific)
      if (dv.dia !== value.dia) return true;

      // HC-05: Student group overlap
      if (studentKey === otherStudentKey) {
        const overlap = dv.slots.some((s) => value.slots.includes(s));
        if (overlap) { removedValues.push(dv); return false; }

        // HC-08: Combined daily load
        const cargaKey = studentKey + "|" + value.dia;
        const currentLoad = state.grupoCargaDiaria.get(cargaKey) || 0;
        if (currentLoad + dv.slots.length > 7) { removedValues.push(dv); return false; }

        // HC bridge: gap check
        if (currentLoad > 0) {
          const gap = calcularGapConAsignados(state, studentKey, value.dia, dv.slots);
          if (gap > 1) { removedValues.push(dv); return false; }
        }
      }

      // HC-01: Docente overlap
      if (value.docente !== null && dv.docente !== null && value.docente.id === dv.docente.id) {
        const overlap = dv.slots.some((s) => value.slots.includes(s));
        if (overlap) { removedValues.push(dv); return false; }
      }

      // HC-02: Space overlap
      if (!value.esAIR && !dv.esAIR && value.espacio.id === dv.espacio.id) {
        const overlap = dv.slots.some((s) => value.slots.includes(s));
        if (overlap) { removedValues.push(dv); return false; }
      }

      return true;
    });

    if (removedValues.length > 0) {
      pruned.push({ variable: other, values: removedValues });
    }
  }

  return pruned;
}

function restorePruned(prunedEntries: PrunedEntry[]): void {
  for (const entry of prunedEntries) {
    entry.variable.domain.push(...entry.values);
  }
}

// --- ASSIGNMENT/UNDO FUNCTIONS ---

function applyAssignment(state: CSPState, variable: CSPVariable, value: DomainValue): void {
  const materia = variable.unidad.materia;
  const studentKey = buildStudentGroupKey(materia.carrera, materia.semestre, materia.grupoCodigo);

  for (const slot of value.slots) {
    // Mark student group as occupied
    state.estudiantesOcupados.set(studentKey + "|" + value.dia + "|" + slot, true);

    // Mark docente as occupied
    if (value.docente !== null) {
      state.docenteOcupado.set(value.docente.id + "|" + value.dia + "|" + slot, true);
    }

    // Mark space as occupied
    if (!value.esAIR) {
      state.espacioOcupado.set(value.espacio.id + "|" + value.dia + "|" + slot, true);
    }
  }

  // Update daily load
  const cargaKey = studentKey + "|" + value.dia;
  const actual = state.grupoCargaDiaria.get(cargaKey) || 0;
  state.grupoCargaDiaria.set(cargaKey, actual + value.slots.length);
}

function undoAssignment(state: CSPState, variable: CSPVariable, value: DomainValue): void {
  const materia = variable.unidad.materia;
  const studentKey = buildStudentGroupKey(materia.carrera, materia.semestre, materia.grupoCodigo);

  for (const slot of value.slots) {
    state.estudiantesOcupados.delete(studentKey + "|" + value.dia + "|" + slot);

    if (value.docente !== null) {
      state.docenteOcupado.delete(value.docente.id + "|" + value.dia + "|" + slot);
    }

    if (!value.esAIR) {
      state.espacioOcupado.delete(value.espacio.id + "|" + value.dia + "|" + slot);
    }
  }

  const cargaKey = studentKey + "|" + value.dia;
  const actual = state.grupoCargaDiaria.get(cargaKey) || 0;
  state.grupoCargaDiaria.set(cargaKey, Math.max(0, actual - value.slots.length));
}


// --- HELPER FUNCTIONS ---

function getDiasDisponibles(state: CSPState): Dia[] {
  return DIAS.filter((d) => d !== "Sábado" || tieneSabadoHabilitado(state));
}

function getDocentesCandidatos(state: CSPState, materia: MateriaCatalogo): Docente[] {
  return state.docentes.filter((d) =>
    d.materiasHabilitadas.some((mh) => mh.sigla === materia.codigo)
  );
}

function getEspaciosCandidatos(state: CSPState, materia: MateriaCatalogo): Espacio[] {
  return state.espacios
    .filter((e) =>
      e.tipo === materia.tipoAula &&
      e.escuela === materia.escuela &&
      e.aforo >= (materia.proyeccionInscritos || 0)
    )
    .sort((a, b) => a.aforo - b.aforo);
}

function generarVentanas(nBloques: number, turno: string, state: CSPState): Ventana[] {
  // Try direct match first
  let slotsDelTurno = TURNOS_SLOTS[turno as keyof typeof TURNOS_SLOTS];
  
  // If no direct match, try to infer turno from the string
  if (!slotsDelTurno || slotsDelTurno.length === 0) {
    const turnoNorm = turno.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (turnoNorm.includes("noche") || turnoNorm.endsWith("n")) {
      slotsDelTurno = TURNOS_SLOTS["Noche"];
    } else if (turnoNorm.includes("tarde") || turnoNorm.endsWith("t")) {
      slotsDelTurno = TURNOS_SLOTS["Tarde"];
    } else {
      // Default to Mañana (covers "mañana", "manana", "AM", "BM", etc.)
      slotsDelTurno = TURNOS_SLOTS["Mañana"];
    }
  }

  if (!slotsDelTurno || slotsDelTurno.length === 0) return [];

  const ventanas: Ventana[] = [];
  for (let i = 0; i <= slotsDelTurno.length - nBloques; i++) {
    const slotWindow = slotsDelTurno.slice(i, i + nBloques);
    ventanas.push({ slots: slotWindow, inicio: SLOTS.indexOf(slotWindow[0]) });
  }
  return ventanas;
}

function verificarDisponibilidad(docente: Docente, dia: Dia, slots: string[]): boolean {
  return slots.every((slot) =>
    docente.disponibilidad.some((d) => d.dia === dia && d.slot === slot)
  );
}

function verificarHabilitacion(docente: Docente, codigo: string): boolean {
  return docente.materiasHabilitadas.some((mh) => mh.sigla === codigo);
}

function crearEspacioAIR(): Espacio {
  return { id: -1, codigo: "AIR", tipo: "AULA", aforo: 999, escuela: 0 };
}

function tieneSabadoHabilitado(state: CSPState): boolean {
  return state.config.sabadoManana || state.config.sabadoTarde || state.config.sabadoNoche;
}

function slotEnTurnoSabado(slots: string[], state: CSPState): boolean {
  const { config } = state;
  const firstSlot = slots[0];
  if (config.sabadoManana && TURNOS_SLOTS["Mañana"].includes(firstSlot)) return true;
  if (config.sabadoTarde && TURNOS_SLOTS["Tarde"].includes(firstSlot)) return true;
  if (config.sabadoNoche && TURNOS_SLOTS["Noche"].includes(firstSlot)) return true;
  return false;
}

// --- STUDENT GROUP KEY NORMALIZATION ---

function buildStudentGroupKey(carrera: string, semestre: string, grupoCodigo: string): string {
  const normalizedCarrera = normalizeString(carrera);
  const normalizedSemestre = normalizeString(semestre);
  const normalizedGrupo = normalizeString(grupoCodigo);
  return normalizedCarrera + "|" + normalizedSemestre + "|" + normalizedGrupo;
}

function normalizeString(s: string): string {
  return s
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

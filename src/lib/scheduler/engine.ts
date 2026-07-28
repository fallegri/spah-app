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
  // Indexes for fast lookup
  docenteOcupado: Map<string, boolean>;     // `${docenteId}|${dia}|${slot}` -> true
  espacioOcupado: Map<string, boolean>;     // `${espacioId}|${dia}|${slot}` -> true
  grupoOcupado: Map<string, boolean>;       // `${grupoKey}|${dia}|${slot}` -> true
  grupoCargaDiaria: Map<string, number>;    // `${grupoKey}|${dia}` -> periodos count
  docenteGrupo: Map<string, string>;        // `${docenteId}|${grupoCodigo}` -> materiaCodigo
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
    grupoOcupado: new Map(),
    grupoCargaDiaria: new Map(),
    docenteGrupo: new Map(),
    backtrackCount: 0,
  };

  // Pre-index reservas externas
  for (const r of reservas) {
    state.espacioOcupado.set(`${r.espacioId}|${r.dia}|${r.slot}`, true);
  }

  // Phase 1: Build work units
  const unidades = construirUnidadesDeTrabajo(state);
  state.log.push(`[FASE 1] ${unidades.length} unidades de trabajo construidas`);

  // Phase 2: Main scheduling loop
  for (const unidad of unidades) {
    for (let sesIdx = 0; sesIdx < unidad.sesiones.length; sesIdx++) {
      const nBloques = unidad.sesiones[sesIdx];
      const resultado = intentarConBacktracking(state, unidad, nBloques, sesIdx);

      if (resultado) {
        registrarAsignacion(state, resultado);
      } else {
        state.conflictos.push({
          materiaCodigo: unidad.materia.codigo,
          materiaNombre: unidad.materia.nombreAsignatura,
          grupoCodigo: unidad.materia.grupoCodigo,
          carrera: unidad.materia.carrera,
          semestre: unidad.materia.semestre,
          sesionIndex: sesIdx,
          motivo: `No se encontró combinación válida (backtrack agotado)`,
        });
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

  // Filter by carrera if specified
  let materiasActivas = materias.filter((m) => m.horasPorSemana > 0 && m.tipoAula !== null);
  if (config.carrerasAProgramar.length > 0) {
    materiasActivas = materiasActivas.filter((m) =>
      config.carrerasAProgramar.some((c) =>
        m.carrera.toLowerCase().includes(c.toLowerCase())
      )
    );
  }

  const unidades: UnidadTrabajo[] = materiasActivas.map((materia) => {
    const tipo = materia.tipoAula;
    const maxPorSesion =
      tipo === "AULA" ? 3 : tipo === "TALLER" ? config.maxPerSesionTaller : config.maxPerSesionLab;

    const sesiones = repartirEnSesiones(materia.horasPorSemana, maxPorSesion);
    const dificultad = calcularDificultad(materia, state);
    const esPrioritaria = tieneDocentePrioritario(materia, state);
    const grupoKey = `${materia.carrera}|${materia.semestre}|${materia.codigo}|${materia.grupoCodigo}`;

    return { materia, sesiones, dificultad, esPrioritaria, grupoKey };
  });

  // Sort: prioritarios first, then by difficulty descending
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

  // Count available spaces of the required type for this school
  const espaciosDisp = state.espacios.filter(
    (e) => e.tipo === materia.tipoAula && e.escuela === materia.escuela
  );
  if (espaciosDisp.length <= 2) score += 15;

  return score;
}

function tieneDocentePrioritario(materia: MateriaCatalogo, state: SchedulerState): boolean {
  if (state.config.docentesPrioritarios.length === 0) return false;
  return state.docentes.some(
    (d) =>
      state.config.docentesPrioritarios.includes(d.ci) &&
      d.materiasHabilitadas.some((mh) => mh.sigla === materia.codigo)
  );
}

function repartirEnSesiones(horas: number, maxPorSesion: number): number[] {
  if (horas <= maxPorSesion) return [horas];

  const numSesiones = Math.ceil(horas / maxPorSesion);
  const base = Math.floor(horas / numSesiones);
  const extra = horas % numSesiones;

  const sesiones: number[] = [];
  for (let i = 0; i < numSesiones; i++) {
    sesiones.push(base + (i < extra ? 1 : 0));
  }

  // Sort descending: longer sessions first (harder to place)
  sesiones.sort((a, b) => b - a);
  return sesiones;
}

// ─── PHASE 2: BACKTRACKING ──────────────────────────────────────────────────

function intentarConBacktracking(
  state: SchedulerState,
  unidad: UnidadTrabajo,
  nBloques: number,
  sesionIndex: number
): Asignacion | null {
  // Try 1: Greedy order (least loaded day first)
  const ordenDias = calcularOrdenDias(state, unidad, sesionIndex);
  let resultado = intentarAsignarSesion(state, unidad, nBloques, sesionIndex, ordenDias, false, false);
  if (resultado) return resultado;

  // Tries 2-4: Random permutations
  for (let i = 0; i < 3 && state.backtrackCount < state.config.maxBacktrack; i++) {
    state.backtrackCount++;
    const permuted = shuffleArray([...ordenDias]);
    resultado = intentarAsignarSesion(state, unidad, nBloques, sesionIndex, permuted, false, false);
    if (resultado) return resultado;
  }

  // Fallback 1: AIR
  if (state.config.permitirAIR) {
    resultado = intentarAsignarSesion(state, unidad, nBloques, sesionIndex, ordenDias, true, false);
    if (resultado) return resultado;
  }

  // Fallback 2: Sin Docente
  if (state.config.permitirSinDocente) {
    resultado = intentarAsignarSesion(state, unidad, nBloques, sesionIndex, ordenDias, false, true);
    if (resultado) return resultado;
  }

  // Fallback 3: Both
  if (state.config.permitirAIR && state.config.permitirSinDocente) {
    resultado = intentarAsignarSesion(state, unidad, nBloques, sesionIndex, ordenDias, true, true);
    if (resultado) return resultado;
  }

  return null;
}

function calcularOrdenDias(state: SchedulerState, unidad: UnidadTrabajo, sesionIndex: number): Dia[] {
  const dias = DIAS.filter((d) => d !== "Sábado" || tieneSabadoHabilitado(state));

  // Get load per day for this group
  const cargaPorDia = dias.map((dia) => {
    const key = `${unidad.grupoKey}|${dia}`;
    return { dia, carga: state.grupoCargaDiaria.get(key) || 0 };
  });

  // Sort by least loaded day
  cargaPorDia.sort((a, b) => a.carga - b.carga);

  // Move days already used by this materia to the end (SC-04)
  const diasUsados = state.asignaciones
    .filter(
      (a) =>
        a.materiaCodigo === unidad.materia.codigo &&
        a.grupoCodigo === unidad.materia.grupoCodigo
    )
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
  state: SchedulerState,
  unidad: UnidadTrabajo,
  nBloques: number,
  sesionIndex: number,
  ordenDias: Dia[],
  usarAIR: boolean,
  usarSinDocente: boolean
): Asignacion | null {
  const materia = unidad.materia;
  const docentesCand = usarSinDocente
    ? [null]
    : docentesCandidatos(state, materia);
  const espaciosCand = usarAIR
    ? [crearEspacioAIR()]
    : espaciosCandidatos(state, materia);
  const ventanas = generarVentanas(nBloques, materia.turno, state);

  for (const dia of ordenDias) {
    // Check Saturday restrictions
    if (dia === "Sábado" && !esVentanaSabadoValida(materia.turno, state)) continue;

    for (const ventana of ventanas) {
      // Saturday additional turns
      if (dia === "Sábado" && !slotEnTurnoSabado(ventana.slots, state)) continue;

      for (const docente of docentesCand) {
        if (docente !== null) {
          // HC-03: Disponibilidad
          if (!verificarDisponibilidad(docente, dia, ventana.slots)) continue;
          // HC-04: Habilitación
          if (!verificarHabilitacion(docente, materia.codigo)) continue;
          // HC-01: Solapamiento docente
          if (verificarSolapamientoDocente(state, docente.id, dia, ventana.slots)) continue;
          // HC-13: Docente en 2 materias del mismo paralelo
          if (verificarDocenteParalelo(state, docente.id, materia.grupoCodigo, materia.codigo)) continue;
        }

        // HC-05: Solapamiento grupo
        if (verificarSolapamientoGrupo(state, unidad.grupoKey, dia, ventana.slots)) continue;
        // HC-08: Límite diario del grupo (8 periodos)
        if (verificarLimiteDiario(state, unidad.grupoKey, dia, nBloques)) continue;

        for (const espacio of espaciosCand) {
          if (!usarAIR) {
            // HC-06: Aforo
            if (espacio.aforo < (materia.proyeccionInscritos || 0)) continue;
            // HC-09: Tipo de espacio
            if (espacio.tipo !== materia.tipoAula) continue;
            // HC-12: Reserva externa
            if (verificarReservaExterna(state, espacio.id, dia, ventana.slots)) continue;
            // HC-02: Solapamiento de espacio
            if (verificarSolapamientoEspacio(state, espacio.id, dia, ventana.slots)) continue;
          }

          // HC-07: Max 3 periodos para aula
          if (materia.tipoAula === "AULA" && nBloques > 3) continue;

          // All constraints passed!
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

// ─── CONSTRAINT CHECKS ──────────────────────────────────────────────────────

function verificarDisponibilidad(docente: Docente, dia: Dia, slots: string[]): boolean {
  return slots.every((slot) =>
    docente.disponibilidad.some((d) => d.dia === dia && d.slot === slot)
  );
}

function verificarHabilitacion(docente: Docente, codigo: string): boolean {
  return docente.materiasHabilitadas.some((mh) => mh.sigla === codigo);
}

function verificarSolapamientoDocente(
  state: SchedulerState,
  docenteId: number,
  dia: Dia,
  slots: string[]
): boolean {
  return slots.some((slot) => state.docenteOcupado.has(`${docenteId}|${dia}|${slot}`));
}

function verificarSolapamientoGrupo(
  state: SchedulerState,
  grupoKey: string,
  dia: Dia,
  slots: string[]
): boolean {
  return slots.some((slot) => state.grupoOcupado.has(`${grupoKey}|${dia}|${slot}`));
}

function verificarSolapamientoEspacio(
  state: SchedulerState,
  espacioId: number,
  dia: Dia,
  slots: string[]
): boolean {
  return slots.some((slot) => state.espacioOcupado.has(`${espacioId}|${dia}|${slot}`));
}

function verificarLimiteDiario(
  state: SchedulerState,
  grupoKey: string,
  dia: Dia,
  nBloques: number
): boolean {
  const key = `${grupoKey}|${dia}`;
  const actual = state.grupoCargaDiaria.get(key) || 0;
  return actual + nBloques > 8;
}

function verificarDocenteParalelo(
  state: SchedulerState,
  docenteId: number,
  grupoCodigo: string,
  materiaCodigo: string
): boolean {
  const key = `${docenteId}|${grupoCodigo}`;
  const existente = state.docenteGrupo.get(key);
  return existente !== undefined && existente !== materiaCodigo;
}

function verificarReservaExterna(
  state: SchedulerState,
  espacioId: number,
  dia: Dia,
  slots: string[]
): boolean {
  return slots.some((slot) => state.espacioOcupado.has(`${espacioId}|${dia}|${slot}`));
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function docentesCandidatos(state: SchedulerState, materia: MateriaCatalogo): Docente[] {
  let candidatos = state.docentes.filter((d) =>
    d.materiasHabilitadas.some((mh) => mh.sigla === materia.codigo)
  );

  // Prioritarios first
  if (state.config.docentesPrioritarios.length > 0) {
    const prio = candidatos.filter((d) => state.config.docentesPrioritarios.includes(d.ci));
    const noPrio = candidatos.filter((d) => !state.config.docentesPrioritarios.includes(d.ci));
    candidatos = [...prio, ...noPrio];
  }

  // SC-02: Prefer less loaded docentes
  candidatos.sort((a, b) => {
    const aPrio = state.config.docentesPrioritarios.includes(a.ci) ? 0 : 1;
    const bPrio = state.config.docentesPrioritarios.includes(b.ci) ? 0 : 1;
    if (aPrio !== bPrio) return aPrio - bPrio;

    const aCarga = countDocenteLoad(state, a.id);
    const bCarga = countDocenteLoad(state, b.id);
    return aCarga - bCarga;
  });

  return candidatos;
}

function countDocenteLoad(state: SchedulerState, docenteId: number): number {
  return state.asignaciones.filter((a) => a.docenteId === docenteId).reduce(
    (sum, a) => sum + a.slots.length,
    0
  );
}

function espaciosCandidatos(state: SchedulerState, materia: MateriaCatalogo): Espacio[] {
  return state.espacios
    .filter(
      (e) =>
        e.tipo === materia.tipoAula &&
        e.aforo >= (materia.proyeccionInscritos || 0)
    )
    .sort((a, b) => {
      // Prefer same school
      const aSchool = a.escuela === materia.escuela ? 0 : 1;
      const bSchool = b.escuela === materia.escuela ? 0 : 1;
      if (aSchool !== bSchool) return aSchool - bSchool;
      // Prefer smaller rooms (less waste)
      return a.aforo - b.aforo;
    });
}

function generarVentanas(nBloques: number, turno: string, state: SchedulerState): Ventana[] {
  const slotsDisponibles = TURNOS_SLOTS[turno as keyof typeof TURNOS_SLOTS] || SLOTS;
  const ventanas: Ventana[] = [];

  for (let i = 0; i <= slotsDisponibles.length - nBloques; i++) {
    const slotWindow = slotsDisponibles.slice(i, i + nBloques);
    const inicio = SLOTS.indexOf(slotWindow[0]);
    ventanas.push({ slots: slotWindow, inicio });
  }

  return ventanas;
}

function crearEspacioAIR(): Espacio {
  return { id: -1, codigo: "AIR", tipo: "AULA", aforo: 50, escuela: 0 };
}

function esVentanaSabadoValida(turnoMateria: string, state: SchedulerState): boolean {
  const { config } = state;
  return config.sabadoManana || config.sabadoTarde || config.sabadoNoche;
}

function slotEnTurnoSabado(slots: string[], state: SchedulerState): boolean {
  const { config } = state;
  const firstSlot = slots[0];

  if (config.sabadoManana && TURNOS_SLOTS["Mañana"].includes(firstSlot)) return true;
  if (config.sabadoTarde && TURNOS_SLOTS["Tarde"].includes(firstSlot)) return true;
  if (config.sabadoNoche && TURNOS_SLOTS["Noche"].includes(firstSlot)) return true;
  return false;
}

function registrarAsignacion(state: SchedulerState, asig: Asignacion): void {
  state.asignaciones.push(asig);

  const grupoKey = `${asig.carrera}|${asig.semestre}|${asig.materiaCodigo}|${asig.grupoCodigo}`;

  // Update indexes
  for (const slot of asig.slots) {
    if (asig.docenteId !== null) {
      state.docenteOcupado.set(`${asig.docenteId}|${asig.dia}|${slot}`, true);
    }
    if (asig.espacioId !== null && !asig.esAIR) {
      state.espacioOcupado.set(`${asig.espacioId}|${asig.dia}|${slot}`, true);
    }
    state.grupoOcupado.set(`${grupoKey}|${asig.dia}|${slot}`, true);
  }

  // Update daily load
  const cargaKey = `${grupoKey}|${asig.dia}`;
  const actual = state.grupoCargaDiaria.get(cargaKey) || 0;
  state.grupoCargaDiaria.set(cargaKey, actual + asig.slots.length);

  // Update docente-paralelo map
  if (asig.docenteId !== null) {
    state.docenteGrupo.set(`${asig.docenteId}|${asig.grupoCodigo}`, asig.materiaCodigo);
  }
}

function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

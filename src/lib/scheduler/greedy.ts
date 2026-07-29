import type {
  Docente,
  MateriaCatalogo,
  Espacio,
  ReservaExterna,
  SchedulerConfig,
  SchedulerResult,
  Asignacion,
  Conflicto,
  Dia,
  Turno,
} from "@/types/scheduler";
import {
  buildStudentGroupKey,
  inferirTurno,
  buildWorkUnits,
  createOccupancyState,
  isValid,
  applyAssignment,
  getWindows,
  calcGap,
  getDaysOrdered,
  getCandidateDocentes,
  getCandidateEspacios,
  isDocenteDisponible,
  OccupancyState,
} from "./shared";

// ======================================================================
// GREEDY ALGORITHM
// Evaluates ALL valid (day, window, docente, espacio) combinations for
// each session, scores them, and picks the best-scoring option.
// Same hard constraints as iterative.
// ======================================================================

interface ScoredOption {
  dia: Dia;
  slots: string[];
  docenteId: number | null;
  docenteNombre: string;
  espacioId: number | null;
  espacioCodigo: string;
  esAIR: boolean;
  esSinDocente: boolean;
  score: number;
}

function scoreOption(
  state: OccupancyState,
  studentKey: string,
  dia: Dia,
  slots: string[],
  esAIR: boolean,
  esSinDocente: boolean,
  espacioSchoolMatch: boolean
): number {
  let score = 100; // Base score

  // Penalty for AIR (no physical space)
  if (esAIR) score -= 30;

  // Penalty for Sin Docente
  if (esSinDocente) score -= 25;

  // Reward for adjacency (no gaps with existing classes)
  const gap = calcGap(state, studentKey, dia, slots);
  if (gap === 0) {
    score += 15; // Adjacent or overlapping range
  } else if (gap === 999) {
    score += 5; // First class of the day - neutral
  } else {
    score -= gap * 10; // Penalize gaps proportionally
  }

  // Reward for matching school on espacio
  if (!esAIR && espacioSchoolMatch) {
    score += 10;
  }

  // Penalty for high daily load (prefer spreading across days)
  const currentLoad = state.grupoCargaDiaria.get(`${studentKey}|${dia}`) || 0;
  if (currentLoad > 4) {
    score -= (currentLoad - 4) * 5;
  }

  // Prefer earlier slots slightly (for predictability)
  score += (20 - slots.length) * 0.5;

  return score;
}

export function ejecutarGreedy(
  docentes: Docente[],
  materias: MateriaCatalogo[],
  espacios: Espacio[],
  reservas: ReservaExterna[],
  config: SchedulerConfig
): SchedulerResult {
  const startTime = Date.now();
  const log: string[] = [];

  const state = createOccupancyState(reservas);

  log.push(`[INFO] Algoritmo: Greedy con scoring`);
  log.push(`[INFO] Docentes: ${docentes.length}, Espacios: ${espacios.length}, Reservas: ${reservas.length}`);

  // Step 1: Build work units
  const unidades = buildWorkUnits(materias, espacios, docentes, config);
  log.push(`[FASE 1] ${unidades.length} unidades de trabajo construidas`);

  const asignaciones: Asignacion[] = [];
  const conflictos: Conflicto[] = [];

  // Step 2: For each session, evaluate all valid options and pick best
  for (const unidad of unidades) {
    const materia = unidad.materia;
    const studentKey = buildStudentGroupKey(materia.carrera, materia.semestre, materia.grupoCodigo);
    const turno = inferirTurno(materia.turno as string);
    const usedDaysForMateria: Dia[] = [];

    const docentesCand = getCandidateDocentes(unidad, docentes);
    const espaciosCand = getCandidateEspacios(unidad, espacios);

    for (let sesIdx = 0; sesIdx < unidad.sesiones.length; sesIdx++) {
      const nBloques = Math.max(unidad.sesiones[sesIdx], 2);
      const windows = getWindows(nBloques, turno);

      if (windows.length === 0) {
        conflictos.push({
          materiaCodigo: materia.codigo,
          materiaNombre: materia.nombreAsignatura,
          grupoCodigo: materia.grupoCodigo,
          carrera: materia.carrera,
          semestre: materia.semestre,
          sesionIndex: sesIdx,
          motivo: `No hay ventanas de ${nBloques} bloques en turno ${turno}`,
        });
        continue;
      }

      const days = getDaysOrdered(state, config, studentKey, usedDaysForMateria, turno);
      const candidates: ScoredOption[] = [];

      // Evaluate all valid combinations
      for (const dia of days) {
        for (const w of windows) {
          // Option type 1: Docente + Physical space
          if (!unidad.esPractica && docentesCand.length > 0 && espaciosCand.length > 0) {
            for (const doc of docentesCand) {
              if (!isDocenteDisponible(doc, dia, w)) continue;
              for (const esp of espaciosCand) {
                if (isValid(state, doc.id, esp.id, studentKey, dia, w, esp.aforo, materia.proyeccionInscritos || 0, materia.tipoAula, materia.escuela, esp, false)) {
                  const schoolMatch = esp.escuela === materia.escuela;
                  candidates.push({
                    dia, slots: w,
                    docenteId: doc.id, docenteNombre: doc.nombre,
                    espacioId: esp.id, espacioCodigo: esp.codigo,
                    esAIR: false, esSinDocente: false,
                    score: scoreOption(state, studentKey, dia, w, false, false, schoolMatch),
                  });
                }
              }
            }
          }

          // Option type 2: Sin Docente + Physical space
          if (!unidad.esPractica && espaciosCand.length > 0) {
            for (const esp of espaciosCand) {
              if (isValid(state, null, esp.id, studentKey, dia, w, esp.aforo, materia.proyeccionInscritos || 0, materia.tipoAula, materia.escuela, esp, false)) {
                const schoolMatch = esp.escuela === materia.escuela;
                candidates.push({
                  dia, slots: w,
                  docenteId: null, docenteNombre: "Sin Docente",
                  espacioId: esp.id, espacioCodigo: esp.codigo,
                  esAIR: false, esSinDocente: true,
                  score: scoreOption(state, studentKey, dia, w, false, true, schoolMatch),
                });
              }
            }
          }

          // Option type 3: Docente + AIR
          if (!unidad.esPractica && docentesCand.length > 0) {
            for (const doc of docentesCand) {
              if (!isDocenteDisponible(doc, dia, w)) continue;
              if (isValid(state, doc.id, null, studentKey, dia, w, 9999, materia.proyeccionInscritos || 0, materia.tipoAula, materia.escuela, null, true)) {
                candidates.push({
                  dia, slots: w,
                  docenteId: doc.id, docenteNombre: doc.nombre,
                  espacioId: null, espacioCodigo: "AIR",
                  esAIR: true, esSinDocente: false,
                  score: scoreOption(state, studentKey, dia, w, true, false, false),
                });
              }
            }
          }

          // Option type 4: AIR + Sin Docente (last resort / practicas)
          if (isValid(state, null, null, studentKey, dia, w, 9999, materia.proyeccionInscritos || 0, materia.tipoAula, materia.escuela, null, true)) {
            candidates.push({
              dia, slots: w,
              docenteId: null, docenteNombre: "Sin Docente",
              espacioId: null, espacioCodigo: "AIR",
              esAIR: true, esSinDocente: true,
              score: scoreOption(state, studentKey, dia, w, true, true, false),
            });
          }
        }
      }

      if (candidates.length === 0) {
        conflictos.push({
          materiaCodigo: materia.codigo,
          materiaNombre: materia.nombreAsignatura,
          grupoCodigo: materia.grupoCodigo,
          carrera: materia.carrera,
          semestre: materia.semestre,
          sesionIndex: sesIdx,
          motivo: "No se encontro combinacion valida incluso con AIR + Sin Docente",
        });
        log.push(`[FAIL] ${materia.codigo} (${materia.grupoCodigo}) sesion ${sesIdx} - sin combinacion valida`);
        continue;
      }

      // Pick the best-scoring option
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];

      applyAssignment(state, best.docenteId, best.espacioId, studentKey, best.dia, best.slots);
      asignaciones.push({
        materiaCodigo: materia.codigo, materiaNombre: materia.nombreAsignatura,
        grupoCodigo: materia.grupoCodigo, carrera: materia.carrera, semestre: materia.semestre,
        docenteId: best.docenteId, docenteNombre: best.docenteNombre,
        espacioId: best.espacioId, espacioCodigo: best.espacioCodigo,
        dia: best.dia, slots: best.slots, turno, tipoEspacio: materia.tipoAula,
        esAIR: best.esAIR, esSinDocente: best.esSinDocente, sesionIndex: sesIdx,
      });
      usedDaysForMateria.push(best.dia);
      log.push(`[OK] ${materia.codigo} (${materia.grupoCodigo}) S${sesIdx} -> ${best.dia} ${best.slots[0]}-${best.slots[best.slots.length - 1]} | ${best.docenteNombre} | ${best.espacioCodigo} (score: ${best.score.toFixed(1)})`);
    }
  }

  const duracion = Date.now() - startTime;
  log.push(`[FIN] Greedy completado en ${duracion}ms. Asignadas: ${asignaciones.length}, Conflictos: ${conflictos.length}`);

  return {
    asignaciones,
    conflictos,
    totalAsignadas: asignaciones.length,
    totalConflictos: conflictos.length,
    totalAIR: asignaciones.filter((a) => a.esAIR).length,
    totalSinDocente: asignaciones.filter((a) => a.esSinDocente).length,
    duracionMs: duracion,
    log,
  };
}
